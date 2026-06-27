import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  Home, Repeat, CheckSquare, BookOpen, Target,
  Timer, BarChart2, LogOut, CalendarDays, ShieldOff, X,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import AddictionPanel from './AddictionPanel'

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

// ─── Nav config ───────────────────────────────────────────────────────────────

const GROUPS = [
  {
    items: [
      { to: '/dashboard', icon: Home, label: 'Dashboard' },
    ],
  },
  {
    label: 'PLAN',
    items: [
      { to: '/goals',       icon: Target,       label: 'Hedefler'      },
      { to: '/weekly-plan', icon: CalendarDays,  label: 'Haftalık Plan' },
    ],
  },
  {
    label: 'TAKİP',
    items: [
      { to: '/todos',    icon: CheckSquare, label: 'Görevler'      },
      { to: '/habits',   icon: Repeat,      label: 'Alışkanlıklar' },
      { to: '/pomodoro', icon: Timer,       label: 'Pomodoro'      },
      { to: '/journal',  icon: BookOpen,    label: 'Günlük'        },
    ],
  },
  {
    label: 'ANALİZ',
    items: [
      { to: '/stats', icon: BarChart2, label: 'İstatistikler' },
    ],
  },
]

// Flat list used by the mobile bottom nav
const ALL_NAV = GROUPS.flatMap(g => g.items)

// ─── Group separator ──────────────────────────────────────────────────────────

function GroupSeparator({ label, expanded }) {
  return (
    <div style={{
      opacity:    expanded ? 1 : 0,
      maxHeight:  expanded ? 36 : 0,
      paddingTop: expanded ? 8 : 0,
      overflow:   'hidden',
      transition: 'opacity 200ms ease, max-height 250ms ease, padding-top 250ms ease',
      pointerEvents: 'none',
      userSelect:    'none',
    }}>
      <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', marginBottom: 6 }} />
      <span style={{
        display:       'block',
        paddingLeft:   20,
        fontSize:      9,
        letterSpacing: '0.2em',
        color:         '#333333',
        textTransform: 'uppercase',
        whiteSpace:    'nowrap',
      }}>
        {label}
      </span>
    </div>
  )
}

// ─── Nav item ─────────────────────────────────────────────────────────────────

function NavItem({ to, icon: Icon, label = '', expanded = false, mobile = false }) {
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
    <NavLink to={to} className="block w-full">
      {({ isActive }) => (
        <div
          className={`h-10 flex items-center transition-colors duration-150 ${
            isActive ? 'text-white' : 'text-ink-muted hover:text-ink-secondary hover:bg-white/5'
          }`}
          style={isActive ? {
            background:  'rgba(255,255,255,0.04)',
            borderLeft:  '2px solid #b91c1c',
          } : undefined}
        >
          {/* Icon column — fixed 64px so icon position never moves */}
          <div style={{ width: 64, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon size={20} strokeWidth={1.5} />
          </div>
          {/* Label — fades in as sidebar widens */}
          <span style={{
            opacity:    expanded ? 1 : 0,
            transition: 'opacity 200ms ease',
            fontSize:   12,
            color:      isActive ? '#ffffff' : '#888888',
            whiteSpace: 'nowrap',
            userSelect: 'none',
          }}>
            {label}
          </span>
        </div>
      )}
    </NavLink>
  )
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function Layout({ children }) {
  const { signOut }             = useAuth()
  const navigate                = useNavigate()
  const [expanded, setExpanded]         = useState(false)
  const [addictionOpen, setAddictionOpen] = useState(false)

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'transparent' }}>

      {/* ── Top bar — full width ──────────────────────────────────────────── */}
      <TopBar />

      {/* ── Content area — sidebar is fixed so main fills full width ─────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Desktop sidebar — fixed, overlays content on hover ─────────── */}
        <aside
          className="hidden md:flex flex-col"
          onMouseEnter={() => setExpanded(true)}
          onMouseLeave={() => setExpanded(false)}
          style={{
            position:       'fixed',
            left:           0,
            top:            32,
            bottom:         0,
            zIndex:         50,
            width:          expanded ? 220 : 64,
            overflow:       'hidden',
            background:     expanded ? 'rgba(5,5,5,0.95)' : 'transparent',
            backdropFilter: expanded ? 'blur(8px)' : 'none',
            transition:     'width 250ms ease, background 250ms ease, backdrop-filter 250ms ease',
          }}
        >
          {/* Monogram */}
          <div style={{ height: 64, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <div style={{ width: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span className="font-bold text-lg leading-none select-none" style={{ color: '#b91c1c' }}>EF</span>
            </div>
          </div>

          {/* Grouped nav */}
          <nav className="flex-1 flex flex-col pt-1" style={{ overflowY: 'auto', overflowX: 'hidden' }}>
            {GROUPS.map((group, i) => (
              <div key={i} className="flex flex-col gap-1">
                {group.label && (
                  <GroupSeparator label={group.label} expanded={expanded} />
                )}
                {group.items.map(item => (
                  <NavItem key={item.to} {...item} expanded={expanded} />
                ))}
              </div>
            ))}
          </nav>

          {/* Addiction tracker */}
          <button
            onClick={() => setAddictionOpen(v => !v)}
            style={{
              width: 64, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer',
              color: addictionOpen ? '#b91c1c' : '#444444', transition: 'color 150ms',
            }}
          >
            <ShieldOff size={20} strokeWidth={1.5} />
          </button>

          {/* Logout */}
          <div style={{ height: 64, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <button
              onClick={handleSignOut}
              style={{ width: 64, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              className="text-ink-muted hover:text-white hover:bg-white/5 transition-colors duration-150"
            >
              <LogOut size={20} strokeWidth={1.5} />
            </button>
            <span style={{
              opacity:    expanded ? 1 : 0,
              transition: 'opacity 200ms ease',
              fontSize:   12,
              color:      '#888888',
              whiteSpace: 'nowrap',
              userSelect: 'none',
            }}>
              Çıkış
            </span>
          </div>
        </aside>

        {/* ── Main content — padded left to clear the fixed sidebar ─────── */}
        <main
          className="flex-1 overflow-y-auto pb-14 md:pb-0"
          style={{ position: 'relative', zIndex: 1, paddingLeft: 64 }}
        >
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
        {ALL_NAV.map(item => <NavItem key={item.to} {...item} mobile />)}
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
