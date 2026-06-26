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

function NavItem({ to, label, icon: Icon, collapsed }) {
  return (
    <NavLink
      to={to}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-200 ${
          collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5'
        } ${
          isActive
            ? 'bg-primary-600 text-white'
            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
        }`
      }
    >
      <Icon size={18} className="shrink-0" />
      {!collapsed && (
        <span className="truncate overflow-hidden whitespace-nowrap">{label}</span>
      )}
    </NavLink>
  )
}

/* Floating preview panel shown on hover when sidebar is collapsed */
function HoverPreview({ dark, toggle, handleSignOut, user }) {
  return (
    <div
      className="
        absolute left-full top-0 ml-2 z-50
        w-48 bg-white dark:bg-slate-800
        border border-slate-200 dark:border-slate-700
        rounded-xl shadow-xl overflow-hidden
        flex flex-col
        pointer-events-auto
      "
      style={{ minHeight: '100%' }}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
        <p className="text-sm font-bold text-slate-800 dark:text-white leading-tight">EF Komuta Merkezi</p>
        <p className="text-xs text-slate-400 truncate mt-0.5">{user?.email}</p>
      </div>

      {/* Nav links */}
      <nav className="flex-1 p-2 space-y-0.5">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary-600 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`
            }
          >
            <Icon size={16} className="shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-slate-200 dark:border-slate-700 flex items-center gap-1">
        <button
          onClick={toggle}
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 transition-colors"
        >
          {dark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-1.5 px-2 py-2 rounded-lg text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex-1"
        >
          <LogOut size={14} /> Çıkış Yap
        </button>
      </div>
    </div>
  )
}

export default function Layout({ children }) {
  const { user, signOut } = useAuth()
  const { dark, toggle } = useTheme()
  const navigate = useNavigate()
  const hoverTimeoutRef = useRef(null)

  const [collapsed, setCollapsed] = useState(() =>
    localStorage.getItem('sidebar-collapsed') === 'true'
  )
  const [hovered, setHovered] = useState(false)

  function toggleCollapsed() {
    setCollapsed(prev => {
      const next = !prev
      localStorage.setItem('sidebar-collapsed', String(next))
      return next
    })
    setHovered(false)
  }

  function handleMouseEnter() {
    if (!collapsed) return
    clearTimeout(hoverTimeoutRef.current)
    setHovered(true)
  }

  function handleMouseLeave() {
    hoverTimeoutRef.current = setTimeout(() => setHovered(false), 120)
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden">

      {/* ── Desktop Sidebar ─────────────────────────────────── */}
      <aside
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          width: collapsed ? '64px' : '224px',
          transition: 'width 250ms cubic-bezier(0.4,0,0.2,1)',
        }}
        className="hidden md:flex flex-col relative shrink-0 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 overflow-visible"
      >
        {/* Header */}
        <div
          className="flex items-center border-b border-slate-200 dark:border-slate-700 overflow-hidden"
          style={{ minHeight: '60px', padding: collapsed ? '0 0 0 0' : '12px 16px' }}
        >
          {collapsed ? (
            /* Collapsed: show avatar/initials centered */
            <div className="w-full flex justify-center">
              <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center">
                <span className="text-xs font-bold text-primary-600 dark:text-primary-400">EF</span>
              </div>
            </div>
          ) : (
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-bold text-slate-800 dark:text-white leading-tight whitespace-nowrap overflow-hidden">
                EF Komuta Merkezi
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{user?.email}</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav
          className="flex-1 overflow-y-auto space-y-1 overflow-hidden"
          style={{ padding: collapsed ? '12px 8px' : '12px' }}
        >
          {NAV.map(item => (
            <NavItem key={item.to} {...item} collapsed={collapsed} />
          ))}
        </nav>

        {/* Footer */}
        <div
          className="border-t border-slate-200 dark:border-slate-700 flex items-center overflow-hidden"
          style={{ padding: collapsed ? '8px' : '8px 12px', gap: collapsed ? 0 : 8 }}
        >
          {collapsed ? (
            <div className="w-full flex justify-center">
              <button
                onClick={toggle}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 transition-colors"
              >
                {dark ? <Sun size={16} /> : <Moon size={16} />}
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={toggle}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 transition-colors"
              >
                {dark ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex-1 whitespace-nowrap overflow-hidden"
              >
                <LogOut size={16} className="shrink-0" /> Çıkış Yap
              </button>
            </>
          )}
        </div>

        {/* Collapse toggle button */}
        <button
          onClick={toggleCollapsed}
          className="
            absolute -right-3 top-[58px]
            w-6 h-6 rounded-full
            bg-white dark:bg-slate-700
            border border-slate-200 dark:border-slate-600
            shadow-sm flex items-center justify-center
            text-slate-500 dark:text-slate-300
            hover:bg-slate-100 dark:hover:bg-slate-600
            transition-colors z-10
          "
          title={collapsed ? 'Genişlet' : 'Daralt'}
        >
          {collapsed
            ? <ChevronRight size={13} />
            : <ChevronLeft size={13} />
          }
        </button>

        {/* Hover preview panel (collapsed only) */}
        {collapsed && hovered && (
          <div
            className="absolute top-0 left-full h-full"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            style={{ zIndex: 50 }}
          >
            <HoverPreview
              dark={dark}
              toggle={toggle}
              handleSignOut={handleSignOut}
              user={user}
            />
          </div>
        )}
      </aside>

      {/* ── Mobile Header ───────────────────────────────────── */}
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

      {/* ── Main content ────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto md:pt-0 pt-14 pb-20 md:pb-0">
        <div className="max-w-4xl mx-auto p-4 md:p-6">
          {children}
        </div>
      </main>

      {/* ── Mobile Bottom Nav ───────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex">
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
