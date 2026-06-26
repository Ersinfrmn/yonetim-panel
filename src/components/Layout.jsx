import { NavLink, useNavigate } from 'react-router-dom'
import {
  CheckSquare, BookOpen, Target, Timer, BarChart2,
  LogOut, Sun, Moon, Flame, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { useState } from 'react'
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

const SIDEBAR_W = 220
const EASE = '260ms cubic-bezier(0.4, 0, 0.2, 1)'

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

  function toggleCollapsed() {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('sidebar-collapsed', String(next))
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden">

      {/* ─────────────────────────────────────────────────────────────
       *  SIDEBAR
       *  A plain flex item — no position, no z-index, no stacking
       *  context. Width transitions 0 ↔ 220px. overflow:hidden clips
       *  content during animation.
       * ───────────────────────────────────────────────────────────── */}
      <aside
        className="hidden md:flex flex-col shrink-0 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700"
        style={{
          width: collapsed ? 0 : SIDEBAR_W,
          overflow: 'hidden',
          transition: `width ${EASE}`,
        }}
      >
        {/* Inner div keeps fixed width so content never reflows */}
        <div className="flex flex-col h-full" style={{ width: SIDEBAR_W, minWidth: SIDEBAR_W }}>

          {/* Header — pl-10 leaves room for the toggle button */}
          <div className="pl-10 pr-4 py-3 border-b border-slate-200 dark:border-slate-700 shrink-0">
            <h1 className="text-sm font-bold text-slate-800 dark:text-white truncate">
              EF Komuta Merkezi
            </h1>
            <p className="text-xs text-slate-400 truncate mt-0.5">{user?.email}</p>
          </div>

          {/* Nav links */}
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
      </aside>

      {/* ─────────────────────────────────────────────────────────────
       *  TOGGLE BUTTON
       *
       *  Completely independent of the sidebar — not inside it, not
       *  relative to it. position:fixed keeps it in the viewport.
       *
       *  top: 16px  left: 16px  — always the same, never moves.
       *  z-index: 99999 — above every other element in the page.
       *
       *  Because the sidebar is position:static (a normal flex item),
       *  it has no stacking context and cannot ever paint above a
       *  position:fixed element regardless of transitions or repaints.
       * ───────────────────────────────────────────────────────────── */}
      <button
        onClick={toggleCollapsed}
        title={collapsed ? 'Genişlet' : 'Küçült'}
        aria-label={collapsed ? 'Genişlet' : 'Küçült'}
        className="hidden md:flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-500 transition-colors"
        style={{
          position: 'fixed',
          top: 16,
          left: 16,
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

      {/* ─────────────────────────────────────────────────────────────
       *  MAIN CONTENT  (desktop + mobile, rendered once)
       * ───────────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto pt-14 md:pt-0 pb-20 md:pb-0">
        <div className="max-w-4xl mx-auto p-4 md:p-6">
          {children}
        </div>
      </main>

      {/* ─────────────────────────────────────────────────────────────
       *  MOBILE HEADER
       * ───────────────────────────────────────────────────────────── */}
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

      {/* ─────────────────────────────────────────────────────────────
       *  MOBILE BOTTOM NAV
       * ───────────────────────────────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
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
