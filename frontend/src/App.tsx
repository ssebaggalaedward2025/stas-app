import React, { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { useAppStore } from './store/useAppStore'
import { getSocket } from './api/socket'
import { mapIncident, mapPrediction } from './api/mappers'
import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'
import MapPage from './pages/MapPage'
import IncidentReportPage from './pages/IncidentReportPage'
import AnalyticsPage from './pages/AnalyticsPage'
import RegisterPage from './pages/RegisterPage'
import RoutePlannerPage from './pages/RoutePlannerPage'
import AlertsPage from './pages/AlertsPage'
import SettingsPage from './pages/SettingsPage'
import AdminPage from './pages/AdminPage'
import AdminDashboardPage from './pages/AdminDashboardPage'
import OfficerDashboardPage from './pages/OfficerDashboardPage'
import AnalystDashboardPage from './pages/AnalystDashboardPage'

// ── Error Boundary ─────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#080D1A', color: '#E8EDF5', fontFamily: 'sans-serif', padding: 32,
        }}>
          <div style={{ maxWidth: 560, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠</div>
            <h2 style={{ color: '#FF2D2D', marginBottom: 12 }}>Something went wrong</h2>
            <pre style={{
              background: '#0F1628', border: '1px solid rgba(255,45,45,0.3)',
              borderRadius: 8, padding: 16, fontSize: 12, textAlign: 'left',
              overflowX: 'auto', color: '#FF6B6B', whiteSpace: 'pre-wrap',
            }}>
              {this.state.error.message}
            </pre>
            <button
              onClick={() => { this.setState({ error: null }); window.location.href = '/login' }}
              style={{
                marginTop: 20, padding: '10px 24px', background: 'rgba(0,212,255,0.12)',
                border: '1px solid rgba(0,212,255,0.4)', borderRadius: 8,
                color: '#00D4FF', cursor: 'pointer', fontSize: 14,
              }}
            >
              Back to Login
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user?.role !== 'ADMIN') return <Navigate to="/" replace />
  return <>{children}</>
}

function OfficerRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user?.role !== 'OFFICER') return <Navigate to="/" replace />
  return <>{children}</>
}

function AnalystRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user?.role !== 'ANALYST') return <Navigate to="/" replace />
  return <>{children}</>
}

/** At the root path, redirect each role to their own dashboard. */
function RootRoute() {
  const { isAuthenticated, user } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user?.role === 'ADMIN')   return <Navigate to="/admin/dashboard"   replace />
  if (user?.role === 'OFFICER') return <Navigate to="/officer/dashboard" replace />
  if (user?.role === 'ANALYST') return <Navigate to="/analyst/dashboard" replace />
  return <DashboardPage />
}

/** Fetch initial data and wire real-time socket events after authentication. */
function DataSync() {
  const { isAuthenticated, user } = useAuth()
  const { fetchIncidents, fetchPredictions, setPredictions, addIncident, updateIncident, setConnected } = useAppStore()

  useEffect(() => {
    if (!isAuthenticated) return

    // Initial fetch
    fetchIncidents()
    fetchPredictions()

    // Attach socket event listeners
    const socket = getSocket()
    if (!socket) return

    function onConnect()    { setConnected(true) }
    function onDisconnect() { setConnected(false) }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function onPredictions({ predictions }: any) {
      setPredictions(predictions.map(mapPrediction))
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function onIncidentNew({ incident }: any) {
      addIncident(mapIncident(incident))
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function onIncidentUpdated({ incident }: any) {
      updateIncident(incident.id, mapIncident(incident))
    }

    socket.on('connect',            onConnect)
    socket.on('disconnect',         onDisconnect)
    socket.on('prediction:updated', onPredictions)
    socket.on('incident:new',       onIncidentNew)
    socket.on('incident:updated',   onIncidentUpdated)

    // If already connected before listeners attached, mark connected
    if (socket.connected) setConnected(true)

    return () => {
      socket.off('connect',            onConnect)
      socket.off('disconnect',         onDisconnect)
      socket.off('prediction:updated', onPredictions)
      socket.off('incident:new',       onIncidentNew)
      socket.off('incident:updated',   onIncidentUpdated)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id])

  return null
}

function AppRoutes() {
  return (
    <>
      <DataSync />
      <Routes>
        <Route path="/login"    element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/"                    element={<RootRoute />} />
        <Route path="/admin/dashboard"   element={<AdminRoute><AdminDashboardPage /></AdminRoute>} />
        <Route path="/officer/dashboard" element={<OfficerRoute><OfficerDashboardPage /></OfficerRoute>} />
        <Route path="/analyst/dashboard" element={<AnalystRoute><AnalystDashboardPage /></AnalystRoute>} />
        <Route path="/map"               element={<ProtectedRoute><MapPage /></ProtectedRoute>} />
        <Route path="/report"   element={<ProtectedRoute><IncidentReportPage /></ProtectedRoute>} />
        <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
        <Route path="/planner"   element={<ProtectedRoute><RoutePlannerPage /></ProtectedRoute>} />
        <Route path="/alerts"    element={<ProtectedRoute><AlertsPage /></ProtectedRoute>} />
        <Route path="/settings"  element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        <Route path="/admin"     element={<AdminRoute><AdminPage /></AdminRoute>} />
        <Route path="*"          element={<Navigate to="/login" replace />} />
      </Routes>
    </>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}
