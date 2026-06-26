import { NavLink, useNavigate } from 'react-router-dom'
import {
  CheckSquare, BookOpen, Target, Timer, BarChart2,
  LogOut, Sun, Moon, Flame, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { useState, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'

const NAV = [
  { to: '/habits',   label: 'Alışkanlık', icon: Flame },
  { to: '/todos',    label: 'Görevler',   icon: CheckSquare },
  { to: '/journal',  label: 'Günlük',     icon: BookOpen },
  { to: '/goals',    label: 'Hedefler',   icon: Target },
  { to: '/pomodoro', label: 'Pomodoro',   icon: Timer },
  { to: '/stats',    label: 'İstatistik', icon: BarChart2 },
]

const bottomLinkClass = ({ isActive }) =>
  `flex flex-col items-center gap-0.5 text-xs font-medium transition-colors ${
    isActive ? 'text-primary-600 dark:text-primary-400' : 'text-slate-500 dark:text-slate-400'
  }`

/* ── Shared sidebar body (used in both expanded + preview) ── */
function SidebarBody({ user, dark, toggle, handleSignOut }) {
  return (
    <div className="flex flex-col h-full" style={{ width: '224px', minWidth: '224px' }}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 shrink-0">
        <h1 className="text-sm font-bold text-slate-800 dark:text-white leading-tight">
          EF Komuta Merkezi
        </h1>
        <p className="text-xs text-slate-400 truncate mt-0.5">{user?.email}</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary-600 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`
            }
          >
            <Icon size={18} className="shrink-0" />
            <span className="truncate">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-700 flex items-center gap-2 shrink-0">
        <button
          onClick={toggle}
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 transition-colors"
        >
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex-1 whitespace-nowrap"
        >
          <LogOut size={16} className="shrink-0" /> Çıkış Yap
        </button>
      </div>
    </div>
  )
}

export default function Layout({ children }) {
  const { user, signOut } = useAuth()
  const { dark, toggle } = useTheme()
  const navigate = useNavigate()
  const leaveTimer = useRef(null)

  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('sidebar-collapsed') === 'true'
  )
  // Controls whether the hover preview is in its "visible" CSS state
  const [previewVisible, setPreviewVisible] = useState(false)

  function toggleCollapsed() {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('sidebar-collapsed', String(next))
    if (next) setPreviewVisible(false)
  }

  function onEnter() {
    clearTimeout(leaveTimer.current)
    setPreviewVisible(true)
  }

  function onLeave() {
    // Small delay so mouse can travel between the tab and the panel without closing
    leaveTimer.current = setTimeout(() => setPreviewVisible(false), 140)
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden">

      {/* ── Desktop sidebar (expanded) ──────────────────────────────── */}
      <aside
        className={`hidden md:block relative shrink-0 bg-white dark:bg-slate-800 ${
          !collapsed ? 'border-r border-slate-200 dark:border-slate-700' : ''
        }`}
        style={{
          width: collapsed ? 0 : '224px',
          overflow: 'hidden',
          transition: 'width 260ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <SidebarBody user={user} dark={dark} toggle={toggle} handleSignOut={handleSignOut} />

        {/* Collapse button — floats on the right edge */}
        <button
          onClick={toggleCollapsed}
          title="Küçült"
          className="
            absolute -right-3 top-14 z-10
            w-6 h-6 rounded-full
            bg-white dark:bg-slate-700
            border border-slate-200 dark:border-slate-600
            shadow-sm flex items-center justify-center
            text-slate-400 hover:text-slate-600 dark:hover:text-slate-200
            hover:bg-slate-50 dark:hover:bg-slate-600
            transition-colors
          "
        >
          <ChevronLeft size={13} />
        </button>
      </aside>

      {/* ── Collapsed state: edge tab + slide-in preview (desktop) ──── */}
      {/*
        pointer-events: none on the wrapper so it doesn't block the main content.
        Each interactive child opts back in with pointer-events: auto.
      */}
      <div
        className="hidden md:block"
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          width: collapsed ? '224px' : 0,
          zIndex: 50,
          pointerEvents: 'none',
          overflow: 'visible',
        }}
      >
        {/* Edge toggle tab — always visible when collapsed */}
        {collapsed && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'auto',
              zIndex: 52,
            }}
            onMouseEnter={onEnter}
            onMouseLeave={onLeave}
          >
            <button
              onClick={toggleCollapsed}
              title="Genişlet"
              className="
                w-5 h-10 rounded-r-lg
                bg-white dark:bg-slate-800
                border border-l-0 border-slate-200 dark:border-slate-700
                shadow-md
                flex items-center justify-center
                text-slate-400 hover:text-primary-600 dark:hover:text-primary-400
                hover:bg-slate-50 dark:hover:bg-slate-700
                transition-colors
              "
            >
              <ChevronRight size={12} />
            </button>
          </div>
        )}

        {/* Slide-in preview panel */}
        {collapsed && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: '224px',
              zIndex: 51,
              pointerEvents: previewVisible ? 'auto' : 'none',
              /* Slide in from the left + fade */
              opacity: previewVisible ? 1 : 0,
              transform: previewVisible ? 'translateX(0)' : 'translateX(-18px)',
              transition: previewVisible
                ? 'opacity 230ms ease-out, transform 230ms ease-out'
                : 'opacity 180ms ease-in, transform 180ms ease-in',
            }}
            onMouseEnter={onEnter}
            onMouseLeave={onLeave}
          >
            <div className="h-full bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 shadow-2xl">
              <SidebarBody user={user} dark={dark} toggle={toggle} handleSignOut={handleSignOut} />
            </div>
          </div>
        )}
      </div>

      {/* ── Mobile Header ───────────────────────────────────────────── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-4 h-14">
        <h1 className="text-base font-bold text-slate-800 dark:text-white">EF Komuta Merkezi</h1>
        <div className="flex items-center gap-2">
          <button onClick={toggle} className="p-2 text-slate-500 dark:text-slate-400">
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button onClick={handleSignOut} className="p-2 text-red-400">
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {/* ── Main content ────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto md:pt-0 pt-14 pb-20 md:pb-0">
        <div className="max-w-4xl mx-auto p-4 md:p-6">
          {children}
        </div>
      </main>

      {/* ── Mobile Bottom Nav ───────────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={bottomLinkClass}
            style={{ flex: 1, padding: '8px 0 6px' }}
          >
            <Icon size={20} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
