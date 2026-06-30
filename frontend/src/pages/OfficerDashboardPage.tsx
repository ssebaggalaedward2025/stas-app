import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle, Bell, CheckCircle,
  Clock, Cog, FileDown, Home, Map as MapIcon, Navigation,
  ShieldCheck, TriangleAlert, XCircle,
} from 'lucide-react'
import { NavLink, Link } from 'react-router-dom'
import GlassCard from '../components/layout/GlassCard'
import Navbar from '../components/layout/Navbar'
import MobileBottomNav from '../components/layout/MobileBottomNav'
import MapView from '../components/map/MapView'
import PredictionFeed from '../components/dashboard/PredictionFeed'
import WeatherWidget from '../components/dashboard/WeatherWidget'
import { useAppStore } from '../store/useAppStore'
import { api } from '../api/client'

// ── Types ──────────────────────────────────────────────────────────────────

type IncidentStatus = 'PENDING' | 'VERIFIED' | 'RESOLVED' | 'REJECTED'

// ── Count-up hook ──────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1200) {
  const [value, setValue] = useState(0)
  const raf = useRef<number>(0)
  useEffect(() => {
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1)
      setValue(Math.round(p * target))
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [target, duration])
  return value
}

// ── KPI Card ───────────────────────────────────────────────────────────────

function KPICard({ label, target, icon, accentVar, sub }: {
  label: string; target: number; icon: React.ReactNode; accentVar: string; sub?: string
}) {
  const count = useCountUp(target)
  return (
    <GlassCard className="p-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-xs text-(--text-secondary) truncate">{label}</div>
        <div className="mt-1.5 text-2xl font-bold text-(--text-primary)" style={{ fontFamily: 'var(--font-display)' }}>
          {count}
        </div>
        {sub && <div className="mt-0.5 text-xs text-(--text-tertiary)">{sub}</div>}
      </div>
      <div className="h-10 w-10 shrink-0 rounded-lg flex items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.2)', border: `1px solid ${accentVar}`, boxShadow: `0 0 16px ${accentVar}55` }}>
        {icon}
      </div>
    </GlassCard>
  )
}

// ── Officer Sidebar ────────────────────────────────────────────────────────

function OfficerSidebar() {
  const incidents = useAppStore((s) => s.incidents)
  const pendingCount = incidents.filter((i) => i.status === 'PENDING').length

  const items = [
    { to: '/officer/dashboard', label: 'Dashboard',    icon: <Home          className="h-4 w-4" />, end: true },
    { to: '/map',               label: 'Live Map',      icon: <MapIcon       className="h-4 w-4" /> },
    { to: '/planner',           label: 'Route Planner', icon: <Navigation    className="h-4 w-4" /> },
    { to: '/alerts',            label: 'Alerts',        icon: <Bell          className="h-4 w-4" />, badge: pendingCount },
    { to: '/settings',          label: 'Settings',      icon: <Cog           className="h-4 w-4" /> },
  ]

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    ['flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
      isActive
        ? 'bg-[rgba(59,130,246,0.12)] border border-[rgba(59,130,246,0.4)] text-[#3b82f6]'
        : 'hover:bg-[rgba(255,255,255,0.04)] text-(--text-secondary)',
    ].join(' ')

  return (
    <aside className="p-3 glass-card flex flex-col gap-1 self-start sticky top-4">
      <div className="flex items-center gap-2 px-3 py-2 mb-1">
        <ShieldCheck className="h-4 w-4 text-[#3b82f6]" />
        <span className="text-xs font-bold uppercase tracking-widest text-[#3b82f6]">Officer</span>
      </div>
      {items.map((item) => (
        <NavLink key={item.label} to={item.to} end={item.end} className={linkClass}>
          {({ isActive }) => (
            <>
              <span style={{ color: isActive ? '#3b82f6' : undefined }}>{item.icon}</span>
              <span className="text-sm">{item.label}</span>
              {item.badge != null && item.badge > 0 && (
                <span className="ml-auto text-[10px] font-bold rounded-full px-1.5 py-0.5"
                  style={{ background: 'rgba(255,45,45,0.15)', color: 'var(--status-critical)', border: '1px solid rgba(255,45,45,0.3)' }}>
                  {item.badge}
                </span>
              )}
            </>
          )}
        </NavLink>
      ))}
    </aside>
  )
}

// ── Status badge ───────────────────────────────────────────────────────────

const STATUS_STYLE: Record<IncidentStatus, { bg: string; color: string }> = {
  PENDING:  { bg: 'rgba(249,115,22,0.15)',  color: '#f97316' },
  VERIFIED: { bg: 'rgba(59,130,246,0.15)',  color: '#3b82f6' },
  RESOLVED: { bg: 'rgba(34,197,94,0.15)',   color: '#22c55e' },
  REJECTED: { bg: 'rgba(107,114,128,0.15)', color: '#6b7280' },
}

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#eab308', LOW: '#22c55e',
}

// ── Incident Queue ─────────────────────────────────────────────────────────

function downloadIncidentsPDF(incidents: ReturnType<typeof useAppStore.getState>['incidents']) {
  const SEV_COLOR: Record<string,string> = { CRITICAL:'#C62828', HIGH:'#E65100', MEDIUM:'#F57F17', LOW:'#2E7D32' }
  const STA_BG:   Record<string,string> = { PENDING:'#FFF3E0', VERIFIED:'#E3F2FD', RESOLVED:'#E8F5E9', REJECTED:'#F5F5F5' }
  const STA_COL:  Record<string,string> = { PENDING:'#E65100', VERIFIED:'#1565C0', RESOLVED:'#2E7D32', REJECTED:'#616161' }

  const rows = incidents.map((inc, i) => `
    <div class="card">
      <div class="row">
        <span class="num">#${i + 1}</span>
        <span class="type">${inc.type}</span>
        <span class="badge" style="background:${SEV_COLOR[inc.severity] ?? '#888'}22;color:${SEV_COLOR[inc.severity] ?? '#888'}">${inc.severity}</span>
        <span class="badge" style="background:${STA_BG[inc.status] ?? '#eee'};color:${STA_COL[inc.status] ?? '#666'}">${inc.status}</span>
        <span class="time">${new Date(inc.createdAt).toLocaleString()}</span>
      </div>
      <div class="addr">${inc.address}</div>
      <div class="desc">${inc.description}</div>
      <div class="coords">GPS: ${inc.latitude.toFixed(4)}, ${inc.longitude.toFixed(4)}</div>
    </div>`).join('')

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>STAS Incident Report — ${new Date().toLocaleDateString()}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;color:#222;padding:32px;font-size:13px}
  .logo-row{display:flex;align-items:center;margin-bottom:4px}
  .tl-icon{flex-shrink:0;display:block}
  h1{font-size:28px;letter-spacing:0.5px;margin-left:-14px;position:relative;z-index:1;
     background:#ffffff;padding-left:10px}
  h1 .brand{font-weight:900}
  h1 .s1{color:#FF2D2D}
  h1 .t{color:#FFB800}
  h1 .a{color:#00C853}
  h1 .s2{color:#00B4E8}
  h1 .rest{color:#0D1F4C;font-weight:normal}
  .sub{color:#555;font-size:12px;margin-bottom:6px}
  .divider{border:none;border-top:2px solid #00C8FF;margin:12px 0 20px}
  .summary{display:flex;gap:24px;margin-bottom:20px}
  .sbox{border:1px solid #ddd;border-radius:6px;padding:10px 16px;text-align:center}
  .sbox .val{font-size:20px;font-weight:bold;color:#0D1F4C}
  .sbox .lbl{font-size:10px;color:#888;margin-top:2px}
  .card{border:1px solid #e0e0e0;border-radius:8px;padding:12px 14px;margin-bottom:12px;page-break-inside:avoid}
  .row{display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap}
  .num{font-size:11px;color:#999;min-width:22px}
  .type{font-weight:bold;font-size:13px;color:#1A5FC8}
  .badge{padding:2px 8px;border-radius:20px;font-size:10px;font-weight:bold}
  .time{margin-left:auto;font-size:10px;color:#888}
  .addr{font-size:12px;color:#555;margin-bottom:4px}
  .desc{font-size:12px;margin-bottom:4px}
  .coords{font-size:10px;color:#aaa}
  footer{margin-top:28px;border-top:1px solid #eee;padding-top:10px;font-size:10px;color:#aaa;text-align:center}
  @media print{body{padding:20px}button{display:none}}
</style></head><body>
<div class="logo-row">
  <svg class="tl-icon" width="52" height="74" viewBox="0 0 52 74" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="4" width="44" height="66" rx="11" fill="#0D1F4C" stroke="#00B4E8" stroke-width="2.5"/>
    <circle cx="26" cy="21" r="11.5" fill="#FF2D2D"/>
    <circle cx="26" cy="37" r="11.5" fill="#FFB800"/>
    <circle cx="26" cy="53" r="11.5" fill="#00C853"/>
  </svg>
  <h1><span class="brand"><span class="s1">S</span><span class="t">T</span><span class="a">A</span><span class="s2">S</span></span><span class="rest"> — Incident Report</span></h1>
</div>
<div class="sub">Smart Traffic Alert System | Kampala Metropolitan Area</div>
<div class="sub">Generated by Traffic Officer Dashboard on ${new Date().toLocaleString()}</div>
<hr class="divider">
<div class="summary">
  <div class="sbox"><div class="val">${incidents.length}</div><div class="lbl">Total Incidents</div></div>
  <div class="sbox"><div class="val">${incidents.filter(i=>i.status==='PENDING').length}</div><div class="lbl">Pending</div></div>
  <div class="sbox"><div class="val">${incidents.filter(i=>i.status==='VERIFIED').length}</div><div class="lbl">Verified</div></div>
  <div class="sbox"><div class="val">${incidents.filter(i=>i.status==='RESOLVED').length}</div><div class="lbl">Resolved</div></div>
  <div class="sbox"><div class="val">${incidents.filter(i=>i.severity==='CRITICAL').length}</div><div class="lbl">Critical</div></div>
</div>
${rows}
<footer>STAS — Smart Traffic Alert System | Muteesa 1 Royal University | https://stas-app.vercel.app</footer>
</body></html>`

  const win = window.open('', '_blank')
  if (!win) { alert('Please allow pop-ups to download the PDF.'); return }
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 600)
}

type IncidentType = 'ALL' | 'JAM' | 'ACCIDENT' | 'WORKS' | 'FLOODING' | 'LIGHT' | 'CONVOY' | 'OTHER'

const TYPE_FILTERS: { key: IncidentType; label: string; color: string }[] = [
  { key: 'ALL',      label: 'All',      color: '#6b7280' },
  { key: 'ACCIDENT', label: 'Accident', color: '#ef4444' },
  { key: 'FLOODING', label: 'Flooding', color: '#3b82f6' },
  { key: 'JAM',      label: 'Jam',      color: '#f97316' },
  { key: 'WORKS',    label: 'Works',    color: '#eab308' },
  { key: 'LIGHT',    label: 'Light',    color: '#a855f7' },
  { key: 'CONVOY',   label: 'Convoy',   color: '#14b8a6' },
  { key: 'OTHER',    label: 'Other',    color: '#6b7280' },
]

function IncidentQueue({ onUpdate }: { onUpdate: () => void }) {
  const storeIncidents = useAppStore((s) => s.incidents)
  const updateIncident = useAppStore((s) => s.updateIncident)
  const [loading,    setLoading]    = useState<string | null>(null)
  const [toast,      setToast]      = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<IncidentType>('ALL')

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  async function setStatus(id: string, status: IncidentStatus) {
    setLoading(id + status)
    try {
      const { data } = await api.patch(`/incidents/${id}/status`, { status })
      updateIncident(id, { status: data.status })
      showToast(`Incident marked as ${status}`)
      onUpdate()
    } catch {
      showToast('Action failed — check your connection')
    } finally {
      setLoading(null)
    }
  }

  async function verify(id: string) {
    setLoading(id + 'VERIFY')
    try {
      const { data } = await api.post(`/incidents/${id}/verify`)
      updateIncident(id, { status: data.status })
      showToast('Incident verified')
      onUpdate()
    } catch {
      showToast('Verification failed')
    } finally {
      setLoading(null)
    }
  }

  // Active queue = PENDING + VERIFIED, then filtered by incident type
  const activeQueue = storeIncidents.filter((i) => i.status === 'PENDING' || i.status === 'VERIFIED')
  const queue = typeFilter === 'ALL'
    ? activeQueue
    : activeQueue.filter((i) => i.type === typeFilter)

  const activeColor = TYPE_FILTERS.find((f) => f.key === typeFilter)?.color ?? '#6b7280'

  return (
    <GlassCard className="overflow-hidden">
      {toast && (
        <div className="mx-4 mt-4 px-3 py-2 rounded-lg text-xs text-center"
          style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.3)', color: 'var(--accent-primary)' }}>
          {toast}
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-(--border-subtle)">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-[#f97316]" />
          <span className="text-sm font-semibold text-(--text-primary)">Incident Queue</span>
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
            style={{ background: activeColor + '22', color: activeColor }}
          >
            {queue.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => downloadIncidentsPDF(queue)}
            title={`Download ${typeFilter === 'ALL' ? 'all' : typeFilter} incidents as PDF`}
            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded transition-colors"
            style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e' }}
          >
            <FileDown className="h-3 w-3" />
            {typeFilter === 'ALL' ? 'Download PDF' : `Download ${typeFilter} PDF`}
          </button>
        </div>
      </div>

      {/* ── Type filter tabs ── */}
      <div className="px-3 py-2 flex flex-wrap gap-1.5 border-b border-(--border-subtle)"
        style={{ background: 'rgba(0,0,0,0.1)' }}>
        {TYPE_FILTERS.map(({ key, label, color }) => {
          const count = key === 'ALL'
            ? activeQueue.length
            : activeQueue.filter((i) => i.type === key).length
          const active = typeFilter === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTypeFilter(key)}
              className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full transition-all"
              style={{
                background:  active ? color + '22' : 'transparent',
                border:      `1px solid ${active ? color : 'var(--border-subtle)'}`,
                color:       active ? color : 'var(--text-tertiary)',
                boxShadow:   active ? `0 0 8px ${color}44` : 'none',
              }}
            >
              {label}
              {count > 0 && (
                <span
                  className="rounded-full px-1 py-0 font-bold"
                  style={{ background: active ? color : 'var(--border-subtle)',
                           color: active ? '#fff' : 'var(--text-tertiary)', fontSize: 9 }}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Incident list ── */}
      <div className="divide-y divide-(--border-subtle) max-h-96 overflow-y-auto">
        {queue.length === 0 && (
          <p className="px-4 py-6 text-xs text-(--text-tertiary) text-center">
            {typeFilter === 'ALL' ? 'No active incidents' : `No active ${typeFilter} incidents`}
          </p>
        )}
        {queue.map((inc) => (
          <div key={inc.id} className="px-4 py-3">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-bold shrink-0" style={{ color: SEVERITY_COLOR[inc.severity] ?? '#6b7280' }}>
                  {inc.type}
                </span>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0"
                  style={{ background: (SEVERITY_COLOR[inc.severity] ?? '#6b7280') + '22', color: SEVERITY_COLOR[inc.severity] ?? '#6b7280' }}>
                  {inc.severity}
                </span>
                <span className="text-[10px] truncate text-(--text-tertiary)">{inc.address}</span>
              </div>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0"
                style={STATUS_STYLE[inc.status as IncidentStatus] ?? { bg: 'transparent', color: '#6b7280' }}>
                {inc.status}
              </span>
            </div>
            <p className="text-[11px] text-(--text-secondary) mb-2 line-clamp-2">{inc.description}</p>
            {/* Action buttons */}
            <div className="flex items-center gap-1.5">
              {inc.status === 'PENDING' && (
                <>
                  <button type="button"
                    disabled={loading !== null}
                    onClick={() => void verify(inc.id)}
                    className="h-6 px-2 rounded text-[10px] font-semibold flex items-center gap-1 transition-colors"
                    style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', color: '#3b82f6' }}>
                    <CheckCircle className="h-3 w-3" /> Verify
                  </button>
                  <button type="button"
                    disabled={loading !== null}
                    onClick={() => void setStatus(inc.id, 'REJECTED')}
                    className="h-6 px-2 rounded text-[10px] font-semibold flex items-center gap-1 transition-colors"
                    style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' }}>
                    <XCircle className="h-3 w-3" /> Reject
                  </button>
                </>
              )}
              {inc.status === 'VERIFIED' && (
                <>
                  <button type="button"
                    disabled={loading !== null}
                    onClick={() => void setStatus(inc.id, 'RESOLVED')}
                    className="h-6 px-2 rounded text-[10px] font-semibold flex items-center gap-1 transition-colors"
                    style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e' }}>
                    <CheckCircle className="h-3 w-3" /> Resolve
                  </button>
                  <button type="button"
                    disabled={loading !== null}
                    onClick={() => void setStatus(inc.id, 'REJECTED')}
                    className="h-6 px-2 rounded text-[10px] font-semibold flex items-center gap-1 transition-colors"
                    style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' }}>
                    <XCircle className="h-3 w-3" /> Reject
                  </button>
                </>
              )}
              <span className="ml-auto text-[10px] text-(--text-tertiary)" style={{ fontFamily: 'var(--font-mono)' }}>
                {new Date(inc.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            {/* Reporter details — shown below action buttons for officer feedback */}
            <div
              className="mt-2 pt-2 flex items-start gap-1.5 border-t"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              <ShieldCheck className="h-3 w-3 shrink-0 mt-0.5 text-(--text-tertiary)" />
              {inc.isAnonymous ? (
                <span className="text-[10px] text-(--text-tertiary) italic">
                  Anonymous submission — no contact details available
                </span>
              ) : inc.reporterName || inc.reporterEmail ? (
                <div className="flex flex-col gap-0.5">
                  {inc.reporterName && (
                    <span className="text-[10px] text-(--text-secondary) font-semibold">
                      {inc.reporterName}
                    </span>
                  )}
                  {inc.reporterEmail && (
                    <a
                      href={`mailto:${inc.reporterEmail}`}
                      className="text-[10px] transition-colors"
                      style={{ color: 'var(--accent-primary)' }}
                    >
                      {inc.reporterEmail}
                    </a>
                  )}
                </div>
              ) : (
                <span className="text-[10px] text-(--text-tertiary) italic">
                  Reporter details unavailable
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function OfficerDashboardPage() {
  const incidents = useAppStore((s) => s.incidents)
  const routes    = useAppStore((s) => s.routes)
  const { fetchIncidents } = useAppStore()

  const refresh = useCallback(() => { void fetchIncidents() }, [fetchIncidents])
  useEffect(() => { refresh() }, [refresh])

  const pending   = incidents.filter((i) => i.status === 'PENDING').length
  const verified  = incidents.filter((i) => i.status === 'VERIFIED').length
  const critical  = incidents.filter((i) => i.severity === 'CRITICAL' && i.status !== 'RESOLVED' && i.status !== 'REJECTED').length
  const affected  = routes.filter((r) => r.status === 'HEAVY' || r.status === 'CRITICAL').length

  return (
    <div className="min-h-screen bg-(--bg-primary) flex flex-col">
      <Navbar />

      {/* Body */}
      <div className="flex-1 px-3 sm:px-4 pt-4 pb-2 min-h-0">
        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_300px] gap-4 h-full">

          <div className="hidden lg:block"><OfficerSidebar /></div>

          <main className="min-w-0 flex flex-col gap-4">
            <GlassCard className="p-0 overflow-hidden shrink-0">
              <MapView height="40vh" showHeatmap pulsingHotspots showZoomControls autoPan={false} className="w-full" />
            </GlassCard>
            <IncidentQueue onUpdate={refresh} />
          </main>

          <aside className="min-w-0 flex flex-col gap-4 lg:overflow-y-auto lg:max-h-[calc(100vh-80px)]">
            <PredictionFeed />
            <WeatherWidget />
          </aside>
        </div>
      </div>

      {/* KPI bar */}
      <div className="px-3 sm:px-4 pb-4 pt-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPICard label="Pending"        target={pending}  accentVar="#f97316" icon={<Clock          className="h-5 w-5 text-[#f97316]" />} sub="awaiting review" />
        <KPICard label="Verified"       target={verified} accentVar="#3b82f6" icon={<CheckCircle    className="h-5 w-5 text-[#3b82f6]" />} sub="confirmed active" />
        <KPICard label="Critical"       target={critical} accentVar="#ef4444" icon={<TriangleAlert  className="h-5 w-5 text-[#ef4444]" />} sub="needs attention" />
        <KPICard label="Affected Routes" target={affected} accentVar="#a855f7" icon={<AlertTriangle className="h-5 w-5 text-[#a855f7]" />} sub="heavy or critical" />
      </div>

      <MobileBottomNav />
    </div>
  )
}
