import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { format, subDays, addDays, parseISO } from 'date-fns'
import { tr } from 'date-fns/locale'
import { Plus, Trash2, Flame, Check, Trophy, X } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import toast from 'react-hot-toast'

const CHAIN_DAYS = 14
const MIN_BREAK_CHARS = 100

// ─── Date helpers ─────────────────────────────────────────────────────────────

const fmt = d => format(d, 'yyyy-MM-dd')
const todayStr = () => fmt(new Date())
const yesterdayStr = () => fmt(subDays(new Date(), 1))

function completedSet(logs, habitId) {
  return new Set(
    logs.filter(l => l.habit_id === habitId && l.completed).map(l => l.date)
  )
}

// Streak counting from today (inclusive) or yesterday if today not done
function getCurrentStreak(datesSet) {
  const today = todayStr()
  const yesterday = yesterdayStr()
  let check = datesSet.has(today) ? today : yesterday
  if (!datesSet.has(check)) return 0
  let streak = 0
  for (let i = 0; i < 730; i++) {
    if (datesSet.has(check)) {
      streak++
      check = fmt(subDays(parseISO(check), 1))
    } else break
  }
  return streak
}

function getLongestStreak(datesSet) {
  const sorted = [...datesSet].sort()
  if (!sorted.length) return 0
  let longest = 1, run = 1
  for (let i = 1; i < sorted.length; i++) {
    const diff = Math.round(
      (parseISO(sorted[i]) - parseISO(sorted[i - 1])) / 86400000
    )
    if (diff === 1) { run++; if (run > longest) longest = run }
    else run = 1
  }
  return longest
}

// Most recent date D where D was done but D+1 was not (and D+1 ≤ yesterday)
function getLastBroken(datesSet) {
  if (!datesSet.size) return null
  const yesterday = yesterdayStr()
  const sorted = [...datesSet].sort((a, b) => b.localeCompare(a)) // descending
  for (const d of sorted) {
    const next = fmt(addDays(parseISO(d), 1))
    if (next > yesterday) continue
    if (!datesSet.has(next)) return next
  }
  return null
}

// Set of dates in the current active streak (for box colouring)
function getActiveStreakSet(datesSet) {
  const today = todayStr()
  const yesterday = yesterdayStr()
  let check = datesSet.has(today) ? today : yesterday
  const active = new Set()
  for (let i = 0; i < 730; i++) {
    if (datesSet.has(check)) { active.add(check); check = fmt(subDays(parseISO(check), 1)) }
    else break
  }
  return active
}

// ─── Chain row — single SVG, left = oldest, right = today ───────────────────
//
// Slot layout (viewBox units):
//   [link 0=13 days ago] [conn] [link 1] ... [link 13=TODAY]
//
//   LW=32  link width     CW=10  connector width
//   LH=30  link height    VH=52  total viewBox height (includes label row)
//   LY=4   link top y     PAD=5  X-line corner inset
//   UNIT = LW + CW = 42
//   VW   = 14*32 + 13*10 = 578
//
function ChainBoxes({ logs, habitId, onToggleToday }) {
  const { dark } = useTheme()

  // Always recalculate from the current moment
  const todayDate = fmt(new Date())

  const done   = completedSet(logs, habitId)
  const active = getActiveStreakSet(done)

  // i=0  → 13 days ago  (FAR LEFT)
  // i=13 → today        (FAR RIGHT)
  const days = Array.from({ length: CHAIN_DAYS }, (_, i) =>
    fmt(subDays(new Date(), CHAIN_DAYS - 1 - i))
  )

  // ── SVG geometry (all in viewBox units) ───────────────────────────────────
  const LW = 32, LH = 30, CW = 10
  const VH = 52                             // extra bottom space for "bugün" label
  const LY = 4                              // link top
  const PAD = 5
  const VW = CHAIN_DAYS * LW + (CHAIN_DAYS - 1) * CW   // 14*32+13*10 = 578

  // Connector bar: centred vertically within the link
  const CY = LY + (LH - 12) / 2            // 12px tall connector, centred in link
  const CH = 12

  // ── Colour palette ────────────────────────────────────────────────────────
  const C = dark ? {
    activeFill:   '#f59e0b',  activeStroke: '#78350f',  activeX:   '#fef3c7',
    activeConn:   '#f59e0b',
    doneFill:     '#334155',  doneStroke:   '#1e293b',  doneX:     '#94a3b8',
    doneConn:     '#334155',
    emptyFill:    '#1e293b',  emptyStroke:  '#334155',
    todayStroke:  '#38bdf8',  todayLabel:   '#38bdf8',
    labelMuted:   '#334155',
  } : {
    activeFill:   '#fbbf24',  activeStroke: '#92400e',  activeX:   '#ffffff',
    activeConn:   '#fbbf24',
    doneFill:     '#cbd5e1',  doneStroke:   '#64748b',  doneX:     '#1e293b',
    doneConn:     '#cbd5e1',
    emptyFill:    '#f8fafc',  emptyStroke:  '#e2e8f0',
    todayStroke:  '#0ea5e9',  todayLabel:   '#0ea5e9',
    labelMuted:   '#e2e8f0',
  }

  return (
    <div className="mt-3 w-full select-none">
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
        role="img"
        aria-label="Alışkanlık zinciri"
      >
        {days.map((d, i) => {
          const isToday    = d === todayDate
          const completed  = done.has(d)
          const inActive   = active.has(d)
          const prevD      = i > 0 ? days[i - 1] : null
          const prevDone   = prevD ? done.has(prevD) : false
          const prevActive = prevD ? active.has(prevD) : false

          // x position: slot i starts at i * (LW + CW)
          // i=0  → x=0   (leftmost,  13 days ago)
          // i=13 → x=546 (rightmost, today)
          const x = i * (LW + CW)

          const fill   = completed && inActive ? C.activeFill
                       : completed             ? C.doneFill
                       :                         C.emptyFill
          const stroke = isToday               ? C.todayStroke
                       : completed && inActive ? C.activeStroke
                       : completed             ? C.doneStroke
                       :                         C.emptyStroke
          const sw     = isToday ? 2.5 : 1.5
          const xCol   = inActive ? C.activeX : C.doneX

          const showConn  = i > 0 && completed && prevDone
          const connColor = showConn
            ? (inActive && prevActive ? C.activeConn : C.doneConn)
            : null

          return (
            <g key={d} onClick={isToday ? onToggleToday : undefined}
               style={{ cursor: isToday ? 'pointer' : 'default' }}>

              {/* Connector between previous link and this link */}
              {showConn && (
                <rect x={x - CW} y={CY} width={CW} height={CH} rx={1} fill={connColor} />
              )}

              {/* Link frame */}
              <rect
                x={x + sw / 2}  y={LY + sw / 2}
                width={LW - sw}  height={LH - sw}
                rx={3} fill={fill} stroke={stroke} strokeWidth={sw}
              />

              {/* X cross — completed days only */}
              {completed && (
                <>
                  <line x1={x+PAD} y1={LY+PAD} x2={x+LW-PAD} y2={LY+LH-PAD}
                        stroke={xCol} strokeWidth={2} strokeLinecap="round" />
                  <line x1={x+LW-PAD} y1={LY+PAD} x2={x+PAD} y2={LY+LH-PAD}
                        stroke={xCol} strokeWidth={2} strokeLinecap="round" />
                </>
              )}

              {/* Centre dot — today, not yet completed */}
              {isToday && !completed && (
                <circle cx={x + LW/2} cy={LY + LH/2} r={3.5} fill={C.todayStroke} />
              )}

              {/* "bugün" label under today's box */}
              {isToday && (
                <text
                  x={x + LW / 2} y={LY + LH + 14}
                  textAnchor="middle"
                  fontSize={9} fontWeight="700" letterSpacing="0.5"
                  fill={C.todayLabel}
                >
                  bugün
                </text>
              )}

              <title>{format(parseISO(d), 'd MMM yyyy', { locale: tr })}</title>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ─── Chain break modal ────────────────────────────────────────────────────────

function ChainBreakModal({ habit, onSubmit, onClose }) {
  const [reason, setReason] = useState('')
  const ready = reason.length >= MIN_BREAK_CHARS
  const remaining = MIN_BREAK_CHARS - reason.length

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-red-50 dark:bg-red-900/20 px-6 pt-6 pb-4 border-b border-red-100 dark:border-red-800/30">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-2xl mb-1">💔</p>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                Zincir Neden Kırıldı?
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {habit.name}
                </span>{' '}
                zinciri kırıldı. Devam edebilmek için sebebini açıkla.
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Zincirinin neden kırıldığını detaylıca açıkla..."
            rows={5}
            autoFocus
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-slate-800 dark:text-white text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
          />

          {/* Character counter */}
          <div className="flex items-center justify-between mt-2 mb-5">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-32 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${ready ? 'bg-green-500' : 'bg-primary-500'}`}
                  style={{ width: `${Math.min(100, (reason.length / MIN_BREAK_CHARS) * 100)}%` }}
                />
              </div>
              <span className={`text-xs font-mono font-medium ${ready ? 'text-green-500' : 'text-slate-400'}`}>
                {reason.length} / {MIN_BREAK_CHARS}
              </span>
            </div>
            {!ready && (
              <span className="text-xs text-slate-400">{remaining} karakter daha</span>
            )}
            {ready && (
              <span className="text-xs text-green-500 font-medium">✓ Hazır</span>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              İptal
            </button>
            <button
              onClick={() => ready && onSubmit(reason)}
              disabled={!ready}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                ready
                  ? 'bg-primary-600 hover:bg-primary-700 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
              }`}
            >
              Zincirim Devam Ediyor →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Habits() {
  const { user } = useAuth()
  const [habits, setHabits] = useState([])
  const [logs, setLogs] = useState([])
  const [breakReasons, setBreakReasons] = useState([])
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(true)
  const [breakModal, setBreakModal] = useState(null) // { habit, lastBroken }

  async function load() {
    const [{ data: h }, { data: l }, { data: br }] = await Promise.all([
      supabase.from('habits').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('habit_logs').select('*').eq('user_id', user.id),
      supabase.from('habit_break_reasons').select('habit_id,break_date').eq('user_id', user.id),
    ])
    setHabits(h || [])
    setLogs(l || [])
    setBreakReasons(br || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function addHabit() {
    if (!newName.trim()) return
    const { data, error } = await supabase
      .from('habits')
      .insert({ user_id: user.id, name: newName.trim() })
      .select().single()
    if (error) { toast.error('Alışkanlık eklenemedi'); return }
    setHabits(h => [...h, data])
    setNewName('')
    toast.success('Alışkanlık eklendi!')
  }

  async function deleteHabit(id) {
    await supabase.from('habit_break_reasons').delete().eq('habit_id', id)
    await supabase.from('habit_logs').delete().eq('habit_id', id)
    await supabase.from('habits').delete().eq('id', id)
    setHabits(h => h.filter(x => x.id !== id))
    setLogs(l => l.filter(x => x.habit_id !== id))
    setBreakReasons(br => br.filter(x => x.habit_id !== id))
    toast.success('Alışkanlık silindi')
  }

  async function markToday(habit) {
    const t = todayStr()
    const { data } = await supabase
      .from('habit_logs')
      .insert({ habit_id: habit.id, user_id: user.id, date: t, completed: true })
      .select().single()
    if (data) setLogs(l => [...l, data])
    toast.success('🔥 Zincir devam ediyor!')
  }

  async function unmarkToday(habit) {
    const existing = logs.find(l => l.habit_id === habit.id && l.date === todayStr())
    if (!existing) return
    await supabase.from('habit_logs').delete().eq('id', existing.id)
    setLogs(l => l.filter(x => x.id !== existing.id))
  }

  async function handleToggleToday(habit) {
    const doneToday = logs.some(
      l => l.habit_id === habit.id && l.date === todayStr() && l.completed
    )

    if (doneToday) {
      await unmarkToday(habit)
      return
    }

    const done = completedSet(logs, habit.id)
    const chainBroken = done.size > 0 && !done.has(yesterdayStr())

    if (chainBroken) {
      const lastBroken = getLastBroken(done)
      if (lastBroken) {
        const explained = breakReasons.some(
          r => r.habit_id === habit.id && r.break_date === lastBroken
        )
        if (!explained) {
          setBreakModal({ habit, lastBroken })
          return
        }
      }
    }

    await markToday(habit)
  }

  async function handleBreakReasonSubmit(reason) {
    const { habit, lastBroken } = breakModal
    setBreakModal(null)

    const { data } = await supabase
      .from('habit_break_reasons')
      .insert({ habit_id: habit.id, user_id: user.id, break_date: lastBroken, reason })
      .select('habit_id,break_date').single()

    if (data) setBreakReasons(br => [...br, data])
    await markToday(habit)
  }

  if (loading) return <div className="text-center py-20 text-slate-400">Yükleniyor...</div>

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">Alışkanlık Takibi</h2>

      {/* Add habit */}
      <div className="flex gap-2 mb-6">
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addHabit()}
          placeholder="Yeni alışkanlık adı..."
          className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <button
          onClick={addHabit}
          className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 transition-colors"
        >
          <Plus size={18} /> Ekle
        </button>
      </div>

      {habits.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Flame size={40} className="mx-auto mb-3 opacity-40" />
          <p>Henüz alışkanlık yok. Yukarıdan ekleyin!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {habits.map(habit => {
            const today = todayStr()
            const done = completedSet(logs, habit.id)
            const doneToday = done.has(today)
            const current = getCurrentStreak(done)
            const longest = getLongestStreak(done)
            const lastBroken = getLastBroken(done)

            return (
              <div
                key={habit.id}
                className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700"
              >
                {/* Header */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleToggleToday(habit)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors shrink-0 ${
                      doneToday
                        ? 'bg-amber-400 border-amber-400 text-white'
                        : 'border-slate-300 dark:border-slate-500 hover:border-amber-400'
                    }`}
                  >
                    {doneToday && <Check size={16} />}
                  </button>
                  <p className="flex-1 font-semibold text-slate-800 dark:text-white truncate">
                    {habit.name}
                  </p>
                  <button
                    onClick={() => deleteHabit(habit.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500 transition-colors shrink-0"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {/* Chain boxes — last 14 days, today on the right */}
                <ChainBoxes
                  logs={logs}
                  habitId={habit.id}
                  onToggleToday={() => handleToggleToday(habit)}
                />

                {/* Stats row */}
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                  <span className="flex items-center gap-1.5 text-xs">
                    <Flame size={13} className="text-orange-400 shrink-0" />
                    <span className="text-slate-600 dark:text-slate-300">
                      Mevcut seri:{' '}
                      <strong className="text-slate-800 dark:text-white">{current}</strong> gün
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5 text-xs">
                    <Trophy size={13} className="text-amber-400 shrink-0" />
                    <span className="text-slate-600 dark:text-slate-300">
                      En uzun:{' '}
                      <strong className="text-slate-800 dark:text-white">{longest}</strong> gün
                    </span>
                  </span>
                  {lastBroken && (
                    <span className="flex items-center gap-1.5 text-xs">
                      <span className="shrink-0 leading-none">💔</span>
                      <span className="text-slate-400 dark:text-slate-500">
                        Son kırılma:{' '}
                        {format(parseISO(lastBroken), 'd MMM', { locale: tr })}
                      </span>
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Chain break modal */}
      {breakModal && (
        <ChainBreakModal
          habit={breakModal.habit}
          onSubmit={handleBreakReasonSubmit}
          onClose={() => setBreakModal(null)}
        />
      )}
    </div>
  )
}
