import { NavLink, useNavigate } from 'react-router-dom'
import {
  CheckSquare, BookOpen, Target, Timer, BarChart2,
  LogOut, Sun, Moon, Flame, ChevronLeft, ChevronRight, Home,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'

const NAV = [
  { to: '/dashboard', label: 'Dashboard',  icon: Home },
  { to: '/habits',   label: 'Alışkanlık', icon: Flame },
  { to: '/todos',    label: 'Görevler',   icon: CheckSquare },
  { to: '/journal',  label: 'Günlük',     icon: BookOpen },
  { to: '/goals',    label: 'Hedefler',   icon: Target },
  { to: '/pomodoro', label: 'Pomodoro',   icon: Timer },
  { to: '/stats',    label: 'İstatistik', icon: BarChart2 },
]

const SIDEBAR_W = 220
const EASE = '260ms cubic-bezier(0.4, 0, 0.2, 1)'

const navLinkClass = ({ isActive }) =>
  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
    isActive
      ? 'bg-primary-600 text-white'
      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
  }`

const bottomLinkClass = ({ isActive }) =>
  `flex flex-col items-center gap-0.5 text-xs font-medium transition-colors ${
    isActive ? 'text-primary-600 dark:text-primary-400' : 'text-slate-500 dark:text-slate-400'
  }`

export default function Layout({ children }) {
  const { user, signOut } = useAuth()
  const { dark, toggle } = useTheme()
  const navigate = useNavigate()

  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('sidebar-collapsed') === 'true'
  )
  const [preview, setPreview] = useState(false)
  const leaveTimer = useRef(null)

  function toggleCollapsed() {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('sidebar-collapsed', String(next))
    if (next) setPreview(false)
  }

  function onEnter() {
    clearTimeout(leaveTimer.current)
    if (collapsed) setPreview(true)
  }

  // 140ms grace period lets the mouse travel from button → panel without hiding
  function onLeave() {
    leaveTimer.current = setTimeout(() => setPreview(false), 140)
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  // Called as a function (not a component) so each call site gets its own
  // React element tree — avoids placing the same JSX object in two positions.
  function renderSidebarBody() {
    return (
      <div className="flex flex-col h-full" style={{ width: SIDEBAR_W, minWidth: SIDEBAR_W }}>
        <div className="pl-8 pr-4 py-3 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <h1 className="text-sm font-bold text-slate-800 dark:text-white truncate">
            EF Komuta Merkezi
          </h1>
          <p className="text-xs text-slate-400 truncate mt-0.5">{user?.email}</p>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={navLinkClass}>
              <Icon size={18} className="shrink-0" />
              <span className="truncate">{label}</span>
            </NavLink>
          ))}
        </nav>

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

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden">

      {/* ── Sidebar (flex item, position:static, no stacking context) ── */}
      <aside
        className="hidden md:flex flex-col shrink-0 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700"
        style={{
          width: collapsed ? 0 : SIDEBAR_W,
          overflow: 'hidden',
          transition: `width ${EASE}`,
        }}
      >
        {renderSidebarBody()}
      </aside>

      {/* ── Toggle button ──────────────────────────────────────────────
       *  Always at top:16 left:4 z-index:99999. Never moves.
       *  onEnter/onLeave only wired when collapsed so hovering an open
       *  sidebar doesn't accidentally show the (unmounted) preview.
       * ─────────────────────────────────────────────────────────────── */}
      <button
        onClick={toggleCollapsed}
        onMouseEnter={collapsed ? onEnter : undefined}
        onMouseLeave={collapsed ? onLeave : undefined}
        title={collapsed ? 'Genişlet' : 'Küçült'}
        aria-label={collapsed ? 'Genişlet' : 'Küçült'}
        className="hidden md:flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-500 transition-colors"
        style={{
          position: 'fixed',
          top: 16,
          left: 4,
          width: 24,
          height: 24,
          padding: 0,
          zIndex: 99999,
          boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
          cursor: 'pointer',
        }}
      >
        {collapsed
          ? <ChevronRight size={13} strokeWidth={2.5} />
          : <ChevronLeft  size={13} strokeWidth={2.5} />
        }
      </button>

      {/* ── Hover preview panel (only when sidebar is collapsed) ───────
       *  position:fixed so it floats above the main content without
       *  affecting flex layout. z-index:50 — visible above main content
       *  but below the toggle button (z-index:99999).
       *
       *  Slide + fade: translateX(-220px)→0 / opacity 0→1 on enter,
       *  reversed on leave. pointerEvents:none when hidden so it never
       *  intercepts clicks while invisible.
       * ─────────────────────────────────────────────────────────────── */}
      {collapsed && (
        <div
          className="hidden md:block"
          onMouseEnter={onEnter}
          onMouseLeave={onLeave}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            bottom: 0,
            width: SIDEBAR_W,
            zIndex: 50,
            opacity: preview ? 1 : 0,
            transform: preview ? 'translateX(0)' : `translateX(-${SIDEBAR_W}px)`,
            transition: preview
              ? 'opacity 230ms ease-out, transform 230ms ease-out'
              : 'opacity 170ms ease-in, transform 170ms ease-in',
            pointerEvents: preview ? 'auto' : 'none',
          }}
        >
          <div className="h-full bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
            {renderSidebarBody()}
          </div>
        </div>
      )}

      {/* ── Main content ────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto pt-14 md:pt-0 pb-20 md:pb-0">
        <div className="max-w-4xl mx-auto p-4 md:p-6">
          {children}
        </div>
      </main>

      {/* ── Mobile header ───────────────────────────────────────────── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 flex items-center justify-between px-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
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

      {/* ── Mobile bottom nav ───────────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={bottomLinkClass} style={{ flex: 1, padding: '8px 0 6px' }}>
            <Icon size={20} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
