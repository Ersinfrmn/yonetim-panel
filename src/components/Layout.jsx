import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  Home, Repeat, CheckSquare, BookOpen, Target,
  Timer, BarChart2, LogOut,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

// ─── Top Bar ──────────────────────────────────────────────────────────────────

const TR_MONTHS = ['OCA','ŞUB','MAR','NİS','MAY','HAZ','TEM','AĞU','EYL','EKİ','KAS','ARA']

function formatClock(d) {
  const day = String(d.getDate()).padStart(2, '0')
  const mon = TR_MONTHS[d.getMonth()]
  const yr  = d.getFullYear()
  const hh  = String(d.getHours()).padStart(2, '0')
  const mm  = String(d.getMinutes()).padStart(2, '0')
  const ss  = String(d.getSeconds()).padStart(2, '0')
  return `${day} ${mon} ${yr} ${hh}:${mm}:${ss}`
}

function TopBar() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const lbl = {
    fontSize: 11, color: '#444444',
    letterSpacing: '0.1em', textTransform: 'uppercase',
    fontFamily: 'inherit', whiteSpace: 'nowrap',
  }

  return (
    <div style={{
      height: 32, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 16px',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#b91c1c', display: 'inline-block', flexShrink: 0 }} />
        <span style={lbl}>SİSTEM AKTİF</span>
      </div>
      <span style={{ ...lbl, textTransform: 'none' }}>{formatClock(now)}</span>
      <span style={lbl}>EF KOMUTA / V.01</span>
    </div>
  )
}

// ─── Nav items ────────────────────────────────────────────────────────────────

const NAV = [
  { to: '/dashboard', icon: Home        },
  { to: '/habits',    icon: Repeat      },
  { to: '/todos',     icon: CheckSquare },
  { to: '/journal',   icon: BookOpen    },
  { to: '/goals',     icon: Target      },
  { to: '/pomodoro',  icon: Timer       },
  { to: '/stats',     icon: BarChart2   },
]

function NavItem({ to, icon: Icon, mobile = false }) {
  if (mobile) {
    return (
      <NavLink to={to} className={({ isActive }) =>
        `flex-1 flex items-center justify-center transition-colors duration-150 ${
          isActive ? 'text-white' : 'text-ink-muted hover:text-ink-secondary'
        }`
      }>
        <Icon size={20} strokeWidth={1.5} />
      </NavLink>
    )
  }

  return (
    <NavLink to={to}>
      {({ isActive }) => (
        <div
          className={`w-10 h-10 flex items-center justify-center transition-all duration-150 ${
            isActive ? 'text-white' : 'text-ink-muted hover:text-ink-secondary hover:bg-white/5'
          }`}
          style={isActive ? { background: 'rgba(255,255,255,0.04)', borderLeft: '2px solid #b91c1c' } : undefined}
        >
          <Icon size={20} strokeWidth={1.5} />
        </div>
      )}
    </NavLink>
  )
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function Layout({ children }) {
  const { signOut } = useAuth()
  const navigate     = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'transparent' }}>

      {/* ── Top bar — full width ──────────────────────────────────────────── */}
      <TopBar />

      {/* ── Sidebar + content row ─────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Desktop sidebar ────────────────────────────────────────────── */}
        <aside
          className="hidden md:flex flex-col items-center shrink-0 w-16"
          style={{ background: 'transparent' }}
        >
          {/* Monogram */}
          <div className="h-16 flex items-center justify-center shrink-0">
            <span className="font-bold text-lg leading-none select-none" style={{ color: '#b91c1c' }}>EF</span>
          </div>

          {/* Nav */}
          <nav className="flex-1 flex flex-col items-center gap-1 pt-1">
            {NAV.map(item => <NavItem key={item.to} {...item} />)}
          </nav>

          {/* Logout */}
          <div className="h-16 flex items-center justify-center shrink-0">
            <button
              onClick={handleSignOut}
              className="w-10 h-10 flex items-center justify-center text-ink-muted hover:text-white hover:bg-white/5 transition-colors duration-150"
            >
              <LogOut size={20} strokeWidth={1.5} />
            </button>
          </div>
        </aside>

        {/* ── Main content ──────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto pb-14 md:pb-0" style={{ position: 'relative', zIndex: 1 }}>
          <div className="max-w-4xl mx-auto p-4 md:p-6">
            {children}
          </div>
        </main>

      </div>

      {/* ── Mobile bottom nav ─────────────────────────────────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-14 flex items-center"
        style={{ background: '#0d0d0d', borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        {NAV.map(item => <NavItem key={item.to} {...item} mobile />)}
        <button
          onClick={handleSignOut}
          className="flex-1 flex items-center justify-center text-ink-muted hover:text-white transition-colors duration-150"
        >
          <LogOut size={20} strokeWidth={1.5} />
        </button>
      </nav>
    </div>
  )
}
