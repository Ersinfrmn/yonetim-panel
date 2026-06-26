import { NavLink, useNavigate } from 'react-router-dom'
import {
  CheckSquare, BookOpen, Target, Timer, BarChart2, LogOut, Sun, Moon, Menu, X, Flame
} from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'

const NAV = [
  { to: '/habits',   label: 'Habits',    icon: Flame },
  { to: '/todos',    label: 'To-Do',     icon: CheckSquare },
  { to: '/journal',  label: 'Journal',   icon: BookOpen },
  { to: '/goals',    label: 'Goals',     icon: Target },
  { to: '/pomodoro', label: 'Pomodoro',  icon: Timer },
  { to: '/stats',    label: 'Stats',     icon: BarChart2 },
]

const linkClass = ({ isActive }) =>
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
  const [mobileOpen, setMobileOpen] = useState(false)
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-56 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 shrink-0">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <h1 className="text-lg font-bold text-slate-800 dark:text-white">ProductiFlow</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{user?.email}</p>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={linkClass}>
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-200 dark:border-slate-700 flex items-center gap-2">
          <button
            onClick={toggle}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 transition-colors"
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex-1"
          >
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-4 h-14">
        <h1 className="text-base font-bold text-slate-800 dark:text-white">ProductiFlow</h1>
        <div className="flex items-center gap-2">
          <button onClick={toggle} className="p-2 text-slate-500 dark:text-slate-400">
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button onClick={handleSignOut} className="p-2 text-red-400">
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto md:pt-0 pt-14 pb-20 md:pb-0">
        <div className="max-w-4xl mx-auto p-4 md:p-6">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
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
