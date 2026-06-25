import { Activity, AlertTriangle, BarChart3, Compass, Radio, Route } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore'

const quickActions = [
  {
    to: '/report',
    label: 'Report incident',
    description: 'Log a new road event quickly',
    icon: AlertTriangle,
  },
  {
    to: '/planner',
    label: 'Plan route',
    description: 'Find the safest path ahead',
    icon: Route,
  },
  {
    to: '/analytics',
    label: 'View analytics',
    description: 'Inspect traffic trends and hotspots',
    icon: BarChart3,
  },
  {
    to: '/alerts',
    label: 'Check alerts',
    description: 'Review live notices and warnings',
    icon: Radio,
  },
]

function formatUpdated(ts: string | null) {
  if (!ts) return 'just now'
  try {
    return new Date(ts).toLocaleString([], {
      hour: 'numeric',
      minute: '2-digit',
      day: 'numeric',
      month: 'short',
    })
  } catch {
    return 'just now'
  }
}

export default function DashboardHero() {
  const isConnected = useAppStore((s) => s.isConnected)
  const lastUpdated = useAppStore((s) => s.lastUpdated)

  return (
    <section className="border-b border-(--border-subtle) bg-[rgba(255,255,255,0.03)] p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-(--border-primary) bg-(--bg-secondary)/80 px-3 py-1 text-xs font-medium text-(--accent-primary)">
            <Compass className="h-3.5 w-3.5" />
            Smart Traffic Alert System
          </div>
          <h2 className="mt-3 text-xl font-semibold text-(--text-primary)">
            Stay ahead of congestion, incidents, and route disruptions.
          </h2>
          <p className="mt-2 text-sm leading-6 text-(--text-secondary)">
            Monitor live conditions, respond faster to incidents, and keep your routes informed with a clearer picture of urban traffic.
          </p>
        </div>

        <div className="rounded-2xl border border-(--border-subtle) bg-(--bg-secondary)/70 p-3 text-sm text-(--text-secondary)">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${isConnected ? 'bg-(--status-clear)' : 'bg-(--status-moderate)'}`} />
            <span className="font-medium text-(--text-primary)">
              {isConnected ? 'Live sync active' : 'Using cached view'}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs">
            <Activity className="h-3.5 w-3.5" />
            Updated {formatUpdated(lastUpdated)}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {quickActions.map(({ to, label, description, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="group rounded-xl border border-(--border-subtle) bg-(--bg-secondary)/70 p-3 transition hover:-translate-y-0.5 hover:border-(--accent-primary)"
          >
            <div className="flex items-center gap-2 text-(--accent-primary)">
              <Icon className="h-4 w-4" />
              <span className="text-sm font-semibold text-(--text-primary)">{label}</span>
            </div>
            <p className="mt-2 text-sm text-(--text-secondary)">{description}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}
