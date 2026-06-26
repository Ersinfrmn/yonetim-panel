import { createPortal } from 'react-dom'
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

const SIDEBAR_W   = 224
const EASING      = '260ms cubic-bezier(0.4, 0, 0.2, 1)'
// Button anchored at left:8 always. translateX moves it to the sidebar edge.
const BTN_LEFT    = 8
const BTN_SIZE    = 22
// When expanded, center the button on the sidebar's right edge:
//   8 + tx = SIDEBAR_W - BTN_SIZE/2  →  tx = 224 - 11 - 8 = 205
const BTN_OPEN_TX = SIDEBAR_W - BTN_SIZE / 2 - BTN_LEFT

const bottomLinkClass = ({ isActive }) =>
  `flex flex-col items-center gap-0.5 text-xs font-medium transition-colors ${
    isActive ? 'text-primary-600 dark:text-primary-400' : 'text-slate-500 dark:text-slate-400'
  }`

function SidebarBody({ user, dark, toggle, handleSignOut }) {
  return (
    <div className="flex flex-col h-full" style={{ width: SIDEBAR_W, minWidth: SIDEBAR_W }}>
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 shrink-0">
        <h1 className="text-sm font-bold text-slate-800 dark:text-white leading-tight">
          EF Komuta Merkezi
        </h1>
        <p className="text-xs text-slate-400 truncate mt-0.5">{user?.email}</p>
      </div>

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
    leaveTimer.current = setTimeout(() => setPreviewVisible(false), 140)
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  /*
   * ── Portal toggle button ─────────────────────────────────────────
   *
   * Rendered via createPortal directly into document.body — completely
   * outside the component tree's DOM hierarchy.
   *
   * Why this matters:
   *   position:fixed elements are supposed to be viewport-relative, but
   *   any ancestor with transform/filter/will-change creates a new
   *   containing block and breaks that guarantee. Portaling to <body>
   *   means NO ancestor can interfere — not the sidebar, not the flex
   *   layout wrapper, not anything.
   *
   * z-index: 99999 on a <body>-level fixed element wins every stacking
   * context battle in the document.
   *
   * Movement uses transform:translateX so the animation is GPU-composited
   * and never triggers layout or paint on the sidebar.
   */
  const toggleButton = createPortal(
    <button
      onClick={toggleCollapsed}
      onMouseEnter={collapsed ? onEnter : undefined}
      onMouseLeave={collapsed ? onLeave : undefined}
      title={collapsed ? 'Genişlet' : 'Küçült'}
      aria-label={collapsed ? 'Genişlet' : 'Küçült'}
      className="hidden md:flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-500"
      style={{
        position:  'fixed',
        top:       16,
        left:      BTN_LEFT,
        width:     BTN_SIZE,
        height:    BTN_SIZE,
        padding:   0,
        zIndex:    99999,
        boxShadow: '0 1px 4px rgba(0,0,0,0.13)',
        cursor:    'pointer',
        transform: collapsed
          ? 'translateX(0)'
          : `translateX(${BTN_OPEN_TX}px)`,
        transition: [
          `transform ${EASING}`,
          'background-color 150ms',
          'color 150ms',
          'border-color 150ms',
        ].join(', '),
      }}
    >
      {collapsed
        ? <ChevronRight size={12} strokeWidth={2.5} />
        : <ChevronLeft  size={12} strokeWidth={2.5} />
      }
    </button>,
    document.body
  )

  return (
    <>
      {/* Toggle button lives in document.body — outside all stacking contexts */}
      {toggleButton}

      <div className="flex h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden">

        {/* ── Desktop sidebar ──────────────────────────────────────── */}
        <aside
          className={`hidden md:block shrink-0 bg-white dark:bg-slate-800 ${
            collapsed ? '' : 'border-r border-slate-200 dark:border-slate-700'
          }`}
          style={{
            width:      collapsed ? 0 : SIDEBAR_W,
            overflow:   'hidden',
            transition: `width ${EASING}`,
          }}
        >
          <SidebarBody user={user} dark={dark} toggle={toggle} handleSignOut={handleSignOut} />
        </aside>

        {/* ── Slide-in preview panel (collapsed, desktop only) ──────── */}
        {collapsed && (
          <div
            className="hidden md:block"
            style={{
              position:      'fixed',
              left:          0,
              top:           0,
              bottom:        0,
              width:         SIDEBAR_W,
              zIndex:        100,
              opacity:       previewVisible ? 1 : 0,
              transform:     previewVisible ? 'translateX(0)' : 'translateX(-20px)',
              pointerEvents: previewVisible ? 'auto' : 'none',
              transition:    previewVisible
                ? `opacity 230ms ease-out, transform 230ms ease-out`
                : `opacity 170ms ease-in,  transform 170ms ease-in`,
            }}
            onMouseEnter={onEnter}
            onMouseLeave={onLeave}
          >
            <div className="h-full bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 shadow-2xl">
              <SidebarBody user={user} dark={dark} toggle={toggle} handleSignOut={handleSignOut} />
            </div>
          </div>
        )}

        {/* ── Mobile Header ─────────────────────────────────────────── */}
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

        {/* ── Main content ──────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto md:pt-0 pt-14 pb-20 md:pb-0">
          <div className="max-w-4xl mx-auto p-4 md:p-6">
            {children}
          </div>
        </main>

        {/* ── Mobile Bottom Nav ─────────────────────────────────────── */}
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
    </>
  )
}
