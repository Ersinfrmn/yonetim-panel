import { NavLink, useNavigate } from 'react-router-dom'
import {
  Home, Repeat, CheckSquare, BookOpen, Target,
  Timer, BarChart2, LogOut,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

// ─── Nav items ────────────────────────────────────────────────────────────────

const NAV = [
  { to: '/dashboard', icon: Home       },
  { to: '/habits',    icon: Repeat     },
  { to: '/todos',     icon: CheckSquare },
  { to: '/journal',   icon: BookOpen   },
  { to: '/goals',     icon: Target     },
  { to: '/pomodoro',  icon: Timer      },
  { to: '/stats',     icon: BarChart2  },
]

// ─── Active / inactive styles ─────────────────────────────────────────────────

function NavItem({ to, icon: Icon, mobile = false }) {
  if (mobile) {
    return (
      <NavLink to={to} className={({ isActive }) =>
        `flex-1 flex items-center justify-center transition-colors duration-150 ${
          isActive ? 'text-primary-400' : 'text-ink-muted hover:text-ink-secondary'
        }`
      }>
        <Icon size={20} strokeWidth={1.5} />
      </NavLink>
    )
  }

  return (
    <NavLink to={to}>
      {({ isActive }) => (
        <div className={`relative w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-150 ${
          isActive
            ? 'bg-primary-500/15'
            : 'text-ink-muted hover:text-ink-secondary hover:bg-white/5'
        }`}>
          {isActive && (
            <span
              className="absolute -left-[18px] top-2 bottom-2 w-[3px] rounded-r-full"
              style={{ background: '#7c3aed' }}
            />
          )}
          <Icon
            size={20}
            strokeWidth={1.5}
            style={isActive
              ? { color: '#a78bfa', filter: 'drop-shadow(0 0 6px rgba(139,92,246,0.85))' }
              : undefined
            }
          />
        </div>
      )}
    </NavLink>
  )
}

// ─── Orbital Glow Ring ────────────────────────────────────────────────────────

function OrbitalGlow() {
  return (
    <div
      className="fixed pointer-events-none hidden md:block"
      style={{
        width: 580,
        height: 580,
        top: '50%',
        right: '10%',
        borderRadius: '50%',
        border: '1.5px solid rgba(139,92,246,0.45)',
        boxShadow: [
          '0 0 40px 6px rgba(139,92,246,0.18)',
          '0 0 100px 24px rgba(108,63,232,0.08)',
          'inset 0 0 50px rgba(108,63,232,0.06)',
        ].join(', '),
        animation: 'orbitalSpin 24s linear infinite',
        opacity: 0.55,
        zIndex: 0,
      }}
    />
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
    <div className="relative z-10 flex h-screen overflow-hidden">

      {/* ── Desktop sidebar — icon-only 64px strip ────────────────────────── */}
      <aside
        className="relative hidden md:flex flex-col items-center shrink-0 w-16"
        style={{
          background:    'rgba(8, 8, 20, 0.92)',
          backdropFilter:'blur(20px)',
          borderRight:   '1px solid rgba(139,92,246,0.1)',
        }}
      >
        {/* Subtle top gradient overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(180deg, rgba(108,63,232,0.07) 0%, transparent 40%)' }}
        />

        {/* Monogram */}
        <div className="relative h-16 flex items-center justify-center shrink-0">
          <span className="text-primary-500 font-semibold text-lg leading-none select-none">EF</span>
        </div>

        {/* Nav */}
        <nav className="relative flex-1 flex flex-col items-center gap-1 pt-1">
          {NAV.map(item => <NavItem key={item.to} {...item} />)}
        </nav>

        {/* Logout */}
        <div className="relative h-16 flex items-center justify-center shrink-0">
          <button
            onClick={handleSignOut}
            className="w-10 h-10 flex items-center justify-center rounded-lg text-ink-muted hover:text-status-error hover:bg-white/5 transition-colors duration-150"
          >
            <LogOut size={20} strokeWidth={1.5} />
          </button>
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto pb-14 md:pb-0">
        <div className="max-w-4xl mx-auto p-4 md:p-6">
          {children}
        </div>
      </main>

      {/* ── Orbital glow ring — fixed, visible on all pages ──────────────── */}
      <OrbitalGlow />

      {/* ── Mobile bottom nav — icons only, 56px ──────────────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-14 flex items-center"
        style={{
          background:    'rgba(8, 8, 20, 0.95)',
          backdropFilter:'blur(20px)',
          borderTop:     '1px solid rgba(139,92,246,0.1)',
        }}
      >
        {NAV.map(item => <NavItem key={item.to} {...item} mobile />)}
        <button
          onClick={handleSignOut}
          className="flex-1 flex items-center justify-center text-ink-muted hover:text-status-error transition-colors duration-150"
        >
          <LogOut size={20} strokeWidth={1.5} />
        </button>
      </nav>
    </div>
  )
}
