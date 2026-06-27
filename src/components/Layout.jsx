import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  Home, Repeat, CheckSquare, BookOpen, Target,
  Timer, BarChart2, LogOut, CalendarDays, ShieldOff, X,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

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

// ─── Addiction Panel ──────────────────────────────────────────────────────────

const ADDICT_MONTHS = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara']

function fmtYMD(d) {
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function fmtShortDate(str) {
  const d = new Date(str + 'T00:00:00')
  return `${d.getDate()} ${ADDICT_MONTHS[d.getMonth()]}`
}

function AddictionPanel({ user, open, onClose, expanded }) {
  const [quitDate,     setQuitDate]     = useState(null)
  const [loadingDate,  setLoadingDate]  = useState(true)
  const [setupDate,    setSetupDate]    = useState('')
  const [tick,         setTick]         = useState(() => new Date())
  const [journalText,  setJournalText]  = useState('')
  const [savedToday,   setSavedToday]   = useState(null)
  const [editMode,     setEditMode]     = useState(false)
  const [saveMsg,      setSaveMsg]      = useState('')
  const [showPast,     setShowPast]     = useState(false)
  const [pastEntries,  setPastEntries]  = useState([])
  const [confirmReset, setConfirmReset] = useState(false)
  const [loaded,       setLoaded]       = useState(false)

  const todayStr = fmtYMD(new Date())
  const p2 = n => String(n).padStart(2, '0')

  useEffect(() => {
    if (!open || loaded) return
    async function load() {
      const [{ data: tracker }, { data: journal }] = await Promise.all([
        supabase.from('addiction_tracker').select('quit_date').eq('user_id', user.id).maybeSingle(),
        supabase.from('addiction_journal').select('content').eq('user_id', user.id).eq('journal_date', todayStr).maybeSingle(),
      ])
      setQuitDate(tracker?.quit_date || null)
      if (journal?.content) { setSavedToday(journal.content); setJournalText(journal.content) }
      setLoadingDate(false)
      setLoaded(true)
    }
    load()
  }, [open]) // eslint-disable-line

  useEffect(() => {
    const id = setInterval(() => setTick(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const elapsed = quitDate ? Math.max(0, Math.floor((tick - new Date(quitDate)) / 1000)) : 0
  const days = Math.floor(elapsed / 86400)
  const hrs  = Math.floor((elapsed % 86400) / 3600)
  const mns  = Math.floor((elapsed % 3600) / 60)
  const scs  = elapsed % 60

  async function handleStart() {
    if (!setupDate) return
    const { data } = await supabase.from('addiction_tracker').upsert(
      { user_id: user.id, quit_date: setupDate, addiction_name: 'Sigara' },
      { onConflict: 'user_id' }
    ).select().maybeSingle()
    if (data) setQuitDate(data.quit_date)
  }

  async function handleReset() {
    await supabase.from('addiction_tracker').delete().eq('user_id', user.id)
    setQuitDate(null); setSetupDate(''); setConfirmReset(false)
  }

  async function handleSave() {
    const { error } = await supabase.from('addiction_journal').upsert(
      { user_id: user.id, content: journalText, journal_date: todayStr },
      { onConflict: 'user_id,journal_date' }
    )
    if (!error) {
      setSavedToday(journalText); setEditMode(false)
      setSaveMsg('Kaydedildi ✓')
      setTimeout(() => setSaveMsg(''), 2000)
    }
  }

  async function handleTogglePast() {
    if (showPast) { setShowPast(false); return }
    const { data } = await supabase.from('addiction_journal')
      .select('journal_date, content').eq('user_id', user.id)
      .order('journal_date', { ascending: false }).limit(7)
    setPastEntries(data || [])
    setShowPast(true)
  }

  const lbl = { fontSize: 10, color: '#444444', letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 500, margin: 0 }

  return (
    <div style={{
      position: 'fixed', top: 32, left: expanded ? 220 : 64, width: 280, bottom: 0,
      background: '#0d0d0d', borderRight: '1px solid rgba(255,255,255,0.06)',
      zIndex: 60, overflowY: 'auto',
      transform: open ? 'translateX(0)' : 'translateX(-100%)',
      transition: 'transform 250ms ease, left 250ms ease',
    }}>
      <div style={{ padding: '20px 16px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <p style={{ fontSize: 10, color: '#444444', letterSpacing: '0.2em', textTransform: 'uppercase', margin: '0 0 3px' }}>
              BAĞIMLILIK
            </p>
            <p style={{ fontSize: 14, color: '#ffffff', fontWeight: 600, margin: 0 }}>Sigara</p>
          </div>
          <button onClick={onClose} style={{ color: '#444444', background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1 }}>
            <X size={16} />
          </button>
        </div>

        {/* Counter / Setup */}
        {loadingDate ? (
          <p style={{ fontSize: 11, color: '#444444', margin: 0 }}>Yükleniyor...</p>
        ) : !quitDate ? (
          <div>
            <p style={{ fontSize: 12, color: '#888888', marginBottom: 12 }}>Bırakma tarihinizi girin</p>
            <input
              type="datetime-local"
              value={setupDate}
              onChange={e => setSetupDate(e.target.value)}
              style={{
                width: '100%', padding: '8px 10px', boxSizing: 'border-box',
                background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 4, color: '#ffffff', fontSize: 12,
                outline: 'none', marginBottom: 10, colorScheme: 'dark',
              }}
            />
            <button
              onClick={handleStart}
              style={{
                width: '100%', padding: '8px 0', background: '#b91c1c',
                border: 'none', borderRadius: 4, color: '#ffffff', fontSize: 11,
                fontWeight: 600, letterSpacing: '0.15em', cursor: 'pointer', textTransform: 'uppercase',
              }}
            >BAŞLAT</button>
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, fontWeight: 700, color: '#ffffff', lineHeight: 1, marginBottom: 4 }}>
              {days}
            </div>
            <p style={{ ...lbl, marginBottom: 14 }}>GÜN</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 10 }}>
              {[{ v: hrs, l: 'SA' }, { v: mns, l: 'DK' }, { v: scs, l: 'SN' }].map(({ v, l }) => (
                <div key={l} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#ffffff', lineHeight: 1, marginBottom: 3 }}>{p2(v)}</div>
                  <p style={{ ...lbl, fontSize: 9 }}>{l}</p>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 11, color: '#444444', marginBottom: 10 }}>Sigarasız geçen süre</p>
            {confirmReset ? (
              <div>
                <p style={{ fontSize: 10, color: '#666666', marginBottom: 6 }}>Emin misiniz?</p>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                  <button onClick={handleReset}
                    style={{ fontSize: 10, color: '#b91c1c', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    Evet, sıfırla
                  </button>
                  <button onClick={() => setConfirmReset(false)}
                    style={{ fontSize: 10, color: '#444444', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    İptal
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setConfirmReset(true)}
                style={{ fontSize: 10, color: '#333333', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                Tarihi sıfırla
              </button>
            )}
          </div>
        )}

        {/* Divider */}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '16px 0' }} />

        {/* Journal */}
        <div>
          <p style={{ ...lbl, marginBottom: 12 }}>GÜN SONU DEFTERİ</p>

          {savedToday && !editMode ? (
            <div>
              <div style={{
                background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 4, padding: '10px 12px', color: '#888888',
                fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap',
                wordBreak: 'break-word', marginBottom: 6,
              }}>{savedToday}</div>
              <button onClick={() => setEditMode(true)}
                style={{ fontSize: 11, color: '#555555', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                Düzenle
              </button>
            </div>
          ) : (
            <div>
              <textarea
                value={journalText}
                onChange={e => setJournalText(e.target.value)}
                placeholder="Bugün nasıl geçti? Direnç anları, hisler..."
                onFocus={e => { e.target.style.borderColor = '#b91c1c' }}
                onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)' }}
                style={{
                  width: '100%', height: 120, padding: '10px 12px',
                  background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 4, color: '#ffffff', fontSize: 13, resize: 'none',
                  outline: 'none', boxSizing: 'border-box',
                  fontFamily: 'inherit', lineHeight: 1.5, display: 'block',
                }}
              />
              {saveMsg ? (
                <p style={{ textAlign: 'center', fontSize: 11, color: '#22c55e', padding: '6px 0', margin: 0 }}>{saveMsg}</p>
              ) : (
                <button onClick={handleSave}
                  style={{
                    width: '100%', padding: '7px 0', marginTop: 8,
                    background: '#b91c1c', border: 'none', borderRadius: 4,
                    color: '#ffffff', fontSize: 11, fontWeight: 600,
                    letterSpacing: '0.12em', cursor: 'pointer', textTransform: 'uppercase',
                  }}
                >KAYDET</button>
              )}
            </div>
          )}

          <button onClick={handleTogglePast}
            style={{ fontSize: 11, color: '#444444', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 14, display: 'block' }}>
            {showPast ? 'Geçmiş kayıtlar ↑' : 'Geçmiş kayıtlar ↓'}
          </button>

          {showPast && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pastEntries.length === 0 ? (
                <p style={{ fontSize: 11, color: '#444444', margin: 0 }}>Geçmiş kayıt yok.</p>
              ) : pastEntries.map(e => (
                <div key={e.journal_date}>
                  <span style={{ fontSize: 11, color: '#555555', marginRight: 6 }}>{fmtShortDate(e.journal_date)}</span>
                  <span style={{ fontSize: 11, color: '#444444' }}>
                    {e.content.length > 60 ? e.content.slice(0, 60) + '…' : e.content}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function Layout({ children }) {
  const { signOut, user }        = useAuth()
  const navigate                 = useNavigate()
  const [expanded, setExpanded]  = useState(false)
  const [showPanel, setShowPanel] = useState(false)

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

          {/* Addiction tracker toggle */}
          <div style={{ height: 40, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <button
              onClick={() => setShowPanel(v => !v)}
              style={{ width: 64, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: showPanel ? '#b91c1c' : '#444444', transition: 'color 150ms' }}
            >
              <ShieldOff size={20} strokeWidth={1.5} />
            </button>
            <span style={{ opacity: expanded ? 1 : 0, transition: 'opacity 200ms ease', fontSize: 12, color: '#888888', whiteSpace: 'nowrap', userSelect: 'none' }}>
              Bağımlılık
            </span>
          </div>

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

        {/* ── Click-outside overlay for addiction panel ────────────────── */}
        {showPanel && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 55 }} onClick={() => setShowPanel(false)} />
        )}

        {/* ── Addiction panel ──────────────────────────────────────────── */}
        {user && <AddictionPanel user={user} open={showPanel} onClose={() => setShowPanel(false)} expanded={expanded} />}

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
