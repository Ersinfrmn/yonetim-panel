import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { format, subDays, addDays, parseISO, differenceInDays } from 'date-fns'
import { tr } from 'date-fns/locale'
import {
  Plus, Trash2, Flame, Check, Trophy, X,
  ChevronDown, ChevronUp, Edit2, Calendar, FileText, History,
} from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import toast from 'react-hot-toast'

const CHAIN_DAYS = 14
const MIN_BREAK_CHARS = 100
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]
const DAY_LABELS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cts']

const DURATION_OPTIONS = [
  { label: '7 Gün',   days: 7   },
  { label: '21 Gün',  days: 21  },
  { label: '30 Gün',  days: 30  },
  { label: '66 Gün',  days: 66  },
  { label: '90 Gün',  days: 90  },
  { label: '1 Yıl',   days: 365 },
  { label: 'Süresiz', days: null },
]

const TEMPLATES = [
  { id: 'morning',    label: 'Sabah Rutini', emoji: '🌅' },
  { id: 'sport',      label: 'Spor',         emoji: '🏋️' },
  { id: 'reading',    label: 'Okuma',         emoji: '📚' },
  { id: 'meditation', label: 'Meditasyon',    emoji: '🧘' },
  { id: 'water',      label: 'Su İçme',       emoji: '💧' },
  { id: 'custom',     label: 'Özel',          emoji: '✨' },
]

// ─── Date helpers ─────────────────────────────────────────────────────────────

const fmt          = d => format(d, 'yyyy-MM-dd')
const todayStr     = () => fmt(new Date())
const yesterdayStr = () => fmt(subDays(new Date(), 1))

function completedSet(logs, habitId) {
  return new Set(logs.filter(l => l.habit_id === habitId && l.completed).map(l => l.date))
}

function targetSet(targetDays) {
  return new Set(targetDays && targetDays.length ? targetDays : ALL_DAYS)
}

// Most recent target day strictly before today (starts from yesterday)
function getMostRecentTargetDay(targetDays) {
  const targets = targetSet(targetDays)
  let date = subDays(new Date(), 1)
  for (let i = 0; i < 7; i++) {
    if (targets.has(date.getDay())) return fmt(date)
    date = subDays(date, 1)
  }
  return null
}

function getCurrentStreak(datesSet, targetDays) {
  const targets = targetSet(targetDays)
  const today   = new Date()
  const todayS  = fmt(today)

  // If today is a target day and was already done, include it; otherwise start from yesterday
  let current = targets.has(today.getDay()) && datesSet.has(todayS)
    ? today
    : subDays(today, 1)

  let streak = 0
  for (let i = 0; i < 1460; i++) {
    const dow     = current.getDay()
    const dateStr = fmt(current)
    if (!targets.has(dow)) { current = subDays(current, 1); continue }
    if (datesSet.has(dateStr)) { streak++; current = subDays(current, 1) }
    else break
  }
  return streak
}

function getLongestStreak(datesSet, targetDays) {
  const targets = targetSet(targetDays)
  // Only count completions that fall on target days
  const targetDates = [...datesSet]
    .filter(d => targets.has(parseISO(d).getDay()))
    .sort()
  if (!targetDates.length) return 0

  let longest = 1, run = 1
  for (let i = 1; i < targetDates.length; i++) {
    // Check whether any target day between targetDates[i-1] and targetDates[i] was missed
    let missed = false
    let check  = addDays(parseISO(targetDates[i - 1]), 1)
    const end  = parseISO(targetDates[i])
    while (check < end) {
      if (targets.has(check.getDay()) && !datesSet.has(fmt(check))) { missed = true; break }
      check = addDays(check, 1)
    }
    if (!missed) { run++; if (run > longest) longest = run }
    else run = 1
  }
  return longest
}

// Returns the most recent missed target day (= where the chain broke), or null if unbroken
function getLastBroken(datesSet, targetDays) {
  if (!datesSet.size) return null
  const targets = targetSet(targetDays)
  let date = subDays(new Date(), 1)    // start from yesterday
  for (let i = 0; i < 730; i++) {
    const dateStr = fmt(date)
    const dow     = date.getDay()
    if (!targets.has(dow)) { date = subDays(date, 1); continue }
    if (!datesSet.has(dateStr)) return dateStr  // missed target day
    return null                                  // hit a completed target day → no break
  }
  return null
}

function getActiveStreakSet(datesSet, targetDays) {
  const targets = targetSet(targetDays)
  const today   = new Date()
  const todayS  = fmt(today)
  let current   = datesSet.has(todayS) ? today : subDays(today, 1)
  const active  = new Set()
  for (let i = 0; i < 1460; i++) {
    const dateStr = fmt(current)
    const dow     = current.getDay()
    // Skip non-target days without adding them; they are rendered separately in ChainBoxes
    if (!targets.has(dow)) { current = subDays(current, 1); continue }
    if (datesSet.has(dateStr)) { active.add(dateStr); current = subDays(current, 1) }
    else break
  }
  return active
}

function getProgress(habit, done) {
  if (!habit.duration_days || habit.duration_type === 'unlimited') return null
  const startDate = habit.start_date ? parseISO(habit.start_date) : new Date()
  const today     = new Date()
  const elapsed   = Math.max(0, differenceInDays(today, startDate))
  const remaining = Math.max(0, habit.duration_days - elapsed)
  const windowStart = fmt(startDate)
  const windowEnd   = fmt(addDays(startDate, habit.duration_days - 1))
  const completions = [...done].filter(d => d >= windowStart && d <= windowEnd).length
  const pct = Math.min(100, Math.round((completions / habit.duration_days) * 100))
  return { pct, remaining, completions, total: habit.duration_days }
}

// ─── DayPicker ────────────────────────────────────────────────────────────────

function DayPicker({ value, onChange }) {
  function toggle(dow) {
    const next = value.includes(dow)
      ? value.filter(d => d !== dow)
      : [...value, dow].sort((a, b) => a - b)
    if (next.length === 0) return   // min 1 day must remain
    onChange(next)
  }
  return (
    <div>
      <p className="text-xs font-semibold text-ink-secondary uppercase tracking-wider mb-2">
        Hangi Günler?
      </p>
      <div className="flex gap-1">
        {DAY_LABELS.map((label, dow) => (
          <button
            key={dow}
            type="button"
            onClick={() => toggle(dow)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
              value.includes(dow)
                ? 'bg-primary-500 text-white'
                : 'bg-white/5 text-ink-muted hover:bg-white/10'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── ChainBoxes — 14-day chain, today on the left ────────────────────────────

function ChainBoxes({ logs, habitId, targetDays, onToggleToday }) {
  const { dark } = useTheme()
  const todayDate = fmt(new Date())
  const done      = completedSet(logs, habitId)
  const active    = getActiveStreakSet(done, targetDays)
  const targets   = targetSet(targetDays)

  const days = Array.from({ length: CHAIN_DAYS }, (_, i) => fmt(subDays(new Date(), i)))

  const LW = 32, LH = 30, CW = 10, VH = 52, LY = 4, PAD = 5
  const VW = CHAIN_DAYS * LW + (CHAIN_DAYS - 1) * CW
  const CY = LY + (LH - 12) / 2, CH = 12

  const C = dark ? {
    activeFill:  '#f59e0b', activeStroke: '#78350f', activeX: '#fef3c7', activeConn: '#f59e0b',
    doneFill:    '#1a1a3a', doneStroke:   '#0D0D1A', doneX:   '#3D3D5C', doneConn:   '#1a1a3a',
    emptyFill:   '#0D0D1A', emptyStroke:  'rgba(108,63,232,0.2)',
    skipFill:    '#080810', skipStroke:   'rgba(108,63,232,0.1)', skipDash: 'rgba(108,63,232,0.15)',
    todayStroke: '#8b6dff', todayLabel:   '#8b6dff',
  } : {
    activeFill:  '#fbbf24', activeStroke: '#92400e', activeX: '#ffffff', activeConn: '#fbbf24',
    doneFill:    '#cbd5e1', doneStroke:   '#64748b', doneX:   '#1e293b', doneConn:   '#cbd5e1',
    emptyFill:   '#f8fafc', emptyStroke:  '#e2e8f0',
    skipFill:    '#f1f3f6', skipStroke:   '#e5e8ee', skipDash: '#c8d0da',
    todayStroke: '#6C3FE8', todayLabel:   '#6C3FE8',
  }

  return (
    <div className="mt-3 w-full select-none">
      <svg viewBox={`0 0 ${VW} ${VH}`}
        style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
        role="img" aria-label="Alışkanlık zinciri">
        {days.map((d, i) => {
          const isToday  = d === todayDate
          const isTarget = targets.has(parseISO(d).getDay())
          const completed = done.has(d), inActive = active.has(d)
          const prevD      = i > 0 ? days[i - 1] : null
          const prevDone   = prevD ? done.has(prevD)   : false
          const prevActive = prevD ? active.has(prevD) : false
          const x = i * (LW + CW)

          const fill = !isTarget
            ? C.skipFill
            : completed && inActive ? C.activeFill
            : completed ? C.doneFill : C.emptyFill

          const stroke = !isTarget
            ? C.skipStroke
            : isToday ? C.todayStroke
            : completed && inActive ? C.activeStroke
            : completed ? C.doneStroke : C.emptyStroke

          const sw = isToday && isTarget ? 2.5 : 1.5
          const xCol = inActive ? C.activeX : C.doneX

          // Only draw connection between completed target-day boxes
          const showConn  = i > 0 && completed && prevDone && isTarget && targets.has(parseISO(prevD).getDay())
          const connColor = showConn ? (inActive && prevActive ? C.activeConn : C.doneConn) : null

          return (
            <g key={d}
               onClick={isToday && isTarget ? onToggleToday : undefined}
               style={{ cursor: isToday && isTarget ? 'pointer' : 'default' }}>
              {showConn && <rect x={x - CW} y={CY} width={CW} height={CH} rx={1} fill={connColor} />}
              <rect x={x + sw / 2} y={LY + sw / 2} width={LW - sw} height={LH - sw}
                    rx={3} fill={fill} stroke={stroke} strokeWidth={sw} />
              {/* Check mark for completed target days */}
              {completed && isTarget && <>
                <line x1={x+PAD} y1={LY+PAD} x2={x+LW-PAD} y2={LY+LH-PAD} stroke={xCol} strokeWidth={2} strokeLinecap="round" />
                <line x1={x+LW-PAD} y1={LY+PAD} x2={x+PAD} y2={LY+LH-PAD} stroke={xCol} strokeWidth={2} strokeLinecap="round" />
              </>}
              {/* Dash for non-target days */}
              {!isTarget && (
                <line
                  x1={x + LW / 2 - 5} y1={LY + LH / 2}
                  x2={x + LW / 2 + 5} y2={LY + LH / 2}
                  stroke={C.skipDash} strokeWidth={1.5} strokeLinecap="round"
                />
              )}
              {/* Dot: today + target + not done */}
              {isToday && isTarget && !completed && (
                <circle cx={x + LW / 2} cy={LY + LH / 2} r={3.5} fill={C.todayStroke} />
              )}
              {/* "bugün" label */}
              {isToday && isTarget && (
                <text x={x + LW / 2} y={LY + LH + 14} textAnchor="middle"
                      fontSize={9} fontWeight="700" letterSpacing="0.5" fill={C.todayLabel}>
                  bugün
                </text>
              )}
              <title>
                {format(parseISO(d), 'd MMM yyyy', { locale: tr })}
                {!isTarget ? ' — ⊘ Hedef gün değil' : completed ? ' — ✓ Tamamlandı' : ' — ○ Yapılmadı'}
              </title>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ─── YearHeatmap — GitHub-style 365-day grid ─────────────────────────────────

function YearHeatmap({ logs, habitId }) {
  const { dark } = useTheme()
  const done    = completedSet(logs, habitId)
  const today   = new Date()
  const start   = subDays(today, 364)

  const CELL = 11, GAP = 2, UNIT = CELL + GAP
  const DAY_W = 24, TOP_H = 18

  const cells = Array.from({ length: 365 }, (_, i) => {
    const d = subDays(today, 364 - i)
    return { dateStr: fmt(d), d }
  })

  const startDow = start.getDay()
  const numWeeks = Math.ceil((startDow + 365) / 7)
  const SVG_W = DAY_W + numWeeks * UNIT
  const SVG_H = TOP_H + 7 * UNIT

  const monthLabels = []
  let lastMonth = -1
  cells.forEach(({ d }, idx) => {
    const m = d.getMonth()
    if (m !== lastMonth) {
      const col = Math.floor((startDow + idx) / 7)
      monthLabels.push({ label: format(d, 'MMM', { locale: tr }), x: DAY_W + col * UNIT })
      lastMonth = m
    }
  })

  const emptyFill = '#1a1a2e'
  const doneFill  = '#22c55e'
  const textFill  = '#3D3D5C'
  const dayLabels = { 1: 'Pzt', 3: 'Çar', 5: 'Cum' }

  return (
    <div className="mt-4 overflow-x-auto rounded-xl bg-white/5 p-3">
      <svg width={SVG_W} height={SVG_H} style={{ display: 'block' }}>
        {monthLabels.map((m, i) => (
          <text key={i} x={m.x} y={12} fontSize={8} fill={textFill} fontWeight="600">{m.label}</text>
        ))}
        {[1, 3, 5].map(row => (
          <text key={row} x={0} y={TOP_H + row * UNIT + CELL} fontSize={7} fill={textFill}>
            {dayLabels[row]}
          </text>
        ))}
        {cells.map(({ dateStr, d }, idx) => {
          const col = Math.floor((startDow + idx) / 7)
          const row = (startDow + idx) % 7
          const x   = DAY_W + col * UNIT
          const y   = TOP_H + row * UNIT
          const completed = done.has(dateStr)
          const isToday   = dateStr === todayStr()
          return (
            <rect key={dateStr}
              x={x} y={y} width={CELL} height={CELL} rx={2}
              fill={completed ? doneFill : emptyFill}
              stroke={isToday ? '#8b6dff' : 'none'}
              strokeWidth={isToday ? 1.5 : 0}>
              <title>
                {format(d, 'd MMMM yyyy EEEE', { locale: tr })} — {completed ? '✓ Tamamlandı' : '○ Yapılmadı'}
              </title>
            </rect>
          )
        })}
      </svg>
    </div>
  )
}

// ─── HabitNotes — auto-saving crisis + general notes ─────────────────────────

function HabitNotes({ habitId, userId, initialNotes, onSaved }) {
  const [crisis,  setCrisis]  = useState(initialNotes?.crisis_notes  ?? '')
  const [general, setGeneral] = useState(initialNotes?.general_notes ?? '')
  const noteId    = useRef(initialNotes?.id ?? null)
  const saveTimer = useRef(null)

  async function persistNotes(crisis_notes, general_notes) {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      if (noteId.current) {
        await supabase.from('habit_notes')
          .update({ crisis_notes, general_notes, updated_at: new Date().toISOString() })
          .eq('id', noteId.current)
      } else {
        const { data } = await supabase.from('habit_notes')
          .insert({ habit_id: habitId, user_id: userId, crisis_notes, general_notes })
          .select().single()
        if (data) noteId.current = data.id
      }
      onSaved?.(habitId, { crisis_notes, general_notes })
    }, 900)
  }

  return (
    <div className="mt-3 space-y-3">
      <div>
        <p className="text-xs font-semibold text-status-warning uppercase tracking-wider mb-1.5">
          🆘 Kriz Yönetimi
        </p>
        <textarea
          value={crisis}
          onChange={e => { setCrisis(e.target.value); persistNotes(e.target.value, general) }}
          placeholder="Zor anlarda kendine ne söylersin? Motivasyon notlarını buraya yaz..."
          rows={3}
          className="w-full px-3 py-2 text-sm rounded-xl border border-status-warning/30 bg-status-warning/5 text-ink-primary placeholder-ink-muted focus:outline-none focus:ring-2 focus:ring-status-warning resize-none"
        />
      </div>
      <div>
        <p className="text-xs font-semibold text-ink-secondary uppercase tracking-wider mb-1.5">
          📝 Notlar
        </p>
        <textarea
          value={general}
          onChange={e => { setGeneral(e.target.value); persistNotes(crisis, e.target.value) }}
          placeholder="Bu alışkanlıkla ilgili düşüncelerini, planlarını, gözlemlerini yaz..."
          rows={3}
          className="w-full px-3 py-2 text-sm rounded-xl border border-border-subtle bg-white/5 text-ink-primary placeholder-ink-muted focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
        />
      </div>
    </div>
  )
}

// ─── BreakHistory — past chain breaks + pattern insight ──────────────────────

function BreakHistory({ breakReasons, habitId }) {
  const habitBreaks = breakReasons
    .filter(r => r.habit_id === habitId)
    .sort((a, b) => b.break_date.localeCompare(a.break_date))

  if (!habitBreaks.length) {
    return (
      <div className="mt-3 text-center py-6">
        <span className="text-2xl block mb-2">🎉</span>
        <p className="text-xs text-ink-muted">Henüz zincir kırılması yok. Harika gidiyorsun!</p>
      </div>
    )
  }

  const dowCounts = Array(7).fill(0)
  habitBreaks.forEach(b => dowCounts[parseISO(b.break_date).getDay()]++)
  const maxDow   = dowCounts.indexOf(Math.max(...dowCounts))
  const maxCount = dowCounts[maxDow]
  const avg      = habitBreaks.length / 7
  const pctMore  = avg > 0 ? Math.round(((maxCount - avg) / avg) * 100) : 0
  const dayNames = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi']

  return (
    <div className="mt-3 space-y-3">
      {pctMore > 20 && maxCount > 1 && (
        <div className="bg-status-warning/10 border border-status-warning/20 rounded-xl px-3 py-2.5 flex items-start gap-2">
          <span className="shrink-0 mt-0.5">💡</span>
          <p className="text-xs text-status-warning">
            <strong>{dayNames[maxDow]}</strong> günleri %{pctMore} daha fazla zincir kırıyorsun.
            Bu gün için ekstra hazırlık yap!
          </p>
        </div>
      )}
      <div className="space-y-2 max-h-52 overflow-y-auto">
        {habitBreaks.map(b => (
          <div key={b.break_date} className="rounded-xl border border-border-subtle p-3">
            <p className="text-xs font-semibold text-status-error mb-1">
              💔 {format(parseISO(b.break_date), 'd MMMM yyyy, EEEE', { locale: tr })}
            </p>
            <p className="text-xs text-ink-secondary leading-relaxed">{b.reason}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── HabitCreateModal — 4-step creation flow ─────────────────────────────────

function HabitCreateModal({ onClose, onCreate }) {
  const [step,       setStep]       = useState(1)
  const [name,       setName]       = useState('')
  const [duration,   setDuration]   = useState(null)
  const [template,   setTemplate]   = useState(null)
  const [targetDays, setTargetDays] = useState([...ALL_DAYS])

  function pickTemplate(t) {
    setTemplate(t)
    if (!name.trim() && t.id !== 'custom') setName(t.label)
  }

  function submit() {
    onCreate({
      name:          name.trim() || template?.label || 'Alışkanlık',
      duration_type: duration?.days ? 'limited' : 'unlimited',
      duration_days: duration?.days ?? null,
      template:      template?.id ?? 'custom',
      target_days:   targetDays,
    })
  }

  const btnSec = 'flex-1 py-2.5 rounded-xl text-sm font-medium border border-border-subtle text-ink-secondary hover:bg-white/5 transition-colors'
  const btnPri = ok => `flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${ok ? 'bg-primary-500 hover:bg-primary-600 text-white' : 'bg-white/5 text-ink-muted cursor-not-allowed'}`

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-card border border-border-subtle rounded-xl w-full max-w-sm shadow-none overflow-hidden">
        {/* Step bar (4 steps) */}
        <div className="flex">
          {[1, 2, 3, 4].map(s => (
            <div key={s} className={`flex-1 h-1 transition-colors ${step >= s ? 'bg-primary-500' : 'bg-white/5'}`} />
          ))}
        </div>
        <div className="p-6">

          {step === 1 && (
            <>
              <p className="text-xs text-ink-muted uppercase tracking-widest mb-1">Adım 1 / 4</p>
              <h3 className="text-base font-semibold text-ink-primary mb-4">Alışkanlık Adı</h3>
              <input autoFocus value={name} onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && name.trim() && setStep(2)}
                placeholder="Örn: Her gün 30 dk koşmak"
                className="w-full px-4 py-3 rounded-xl border border-border-subtle bg-white/5 text-ink-primary placeholder-ink-muted focus:outline-none focus:ring-2 focus:ring-primary-500" />
              <div className="flex gap-3 mt-5">
                <button onClick={onClose} className={btnSec}>İptal</button>
                <button onClick={() => setStep(2)} disabled={!name.trim()} className={btnPri(name.trim())}>İleri →</button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <p className="text-xs text-ink-muted uppercase tracking-widest mb-1">Adım 2 / 4</p>
              <h3 className="text-base font-semibold text-ink-primary mb-4">Süre Belirle</h3>
              <div className="grid grid-cols-2 gap-2">
                {DURATION_OPTIONS.map(opt => (
                  <button key={opt.label} onClick={() => setDuration(opt)}
                    className={`py-3 px-4 rounded-xl border text-sm font-medium transition-colors ${
                      duration?.label === opt.label
                        ? 'bg-primary-500 border-primary-500 text-white'
                        : 'border-border-subtle text-ink-secondary hover:border-border-glow'
                    }`}>{opt.label}</button>
                ))}
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setStep(1)} className={btnSec}>← Geri</button>
                <button onClick={() => setStep(3)} disabled={!duration} className={btnPri(!!duration)}>İleri →</button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <p className="text-xs text-ink-muted uppercase tracking-widest mb-1">Adım 3 / 4</p>
              <h3 className="text-base font-semibold text-ink-primary mb-4">Şablon Seç</h3>
              <div className="grid grid-cols-2 gap-2">
                {TEMPLATES.map(t => (
                  <button key={t.id} onClick={() => pickTemplate(t)}
                    className={`py-3 px-4 rounded-xl border text-sm font-medium transition-colors flex items-center gap-2 ${
                      template?.id === t.id
                        ? 'bg-primary-500 border-primary-500 text-white'
                        : 'border-border-subtle text-ink-secondary hover:border-border-glow'
                    }`}>
                    <span>{t.emoji}</span> {t.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setStep(2)} className={btnSec}>← Geri</button>
                <button onClick={() => setStep(4)} disabled={!template} className={btnPri(!!template)}>İleri →</button>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <p className="text-xs text-ink-muted uppercase tracking-widest mb-1">Adım 4 / 4</p>
              <h3 className="text-base font-semibold text-ink-primary mb-4">Günleri Seç</h3>
              <DayPicker value={targetDays} onChange={setTargetDays} />
              <p className="text-xs text-ink-muted mt-2 text-center">{targetDays.length} / 7 gün seçili</p>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setStep(3)} className={btnSec}>← Geri</button>
                <button onClick={submit} className={btnPri(true)}>Oluştur ✓</button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  )
}

// ─── HabitEditModal — edit name + duration + target days ─────────────────────

function HabitEditModal({ habit, onClose, onSave }) {
  const [name,       setName]       = useState(habit.name)
  const [duration,   setDuration]   = useState(
    () => DURATION_OPTIONS.find(o => o.days === habit.duration_days) ?? DURATION_OPTIONS[6]
  )
  const [targetDays, setTargetDays] = useState(habit.target_days ?? [...ALL_DAYS])

  function submit() {
    if (!name.trim()) return
    onSave(habit.id, {
      name:          name.trim(),
      duration_type: duration?.days ? 'limited' : 'unlimited',
      duration_days: duration?.days ?? null,
      target_days:   targetDays,
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-card border border-border-subtle rounded-xl w-full max-w-sm shadow-none p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-ink-primary">Alışkanlığı Düzenle</h3>
          <button onClick={onClose} className="p-1.5 text-ink-secondary hover:text-ink-primary transition-colors">
            <X size={18} />
          </button>
        </div>

        <label className="text-xs font-semibold text-ink-secondary uppercase tracking-wider mb-1 block">Ad</label>
        <input autoFocus value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          className="w-full px-4 py-2.5 rounded-xl border border-border-subtle bg-white/5 text-ink-primary focus:outline-none focus:ring-2 focus:ring-primary-500 mb-4" />

        <label className="text-xs font-semibold text-ink-secondary uppercase tracking-wider mb-2 block">Süre</label>
        <div className="grid grid-cols-2 gap-2 mb-5">
          {DURATION_OPTIONS.map(opt => (
            <button key={opt.label} onClick={() => setDuration(opt)}
              className={`py-2.5 px-3 rounded-xl border text-sm font-medium transition-colors ${
                duration?.label === opt.label
                  ? 'bg-primary-500 border-primary-500 text-white'
                  : 'border-border-subtle text-ink-secondary hover:border-border-glow'
              }`}>{opt.label}</button>
          ))}
        </div>

        <div className="mb-5">
          <DayPicker value={targetDays} onChange={setTargetDays} />
        </div>

        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-border-subtle text-ink-secondary text-sm font-medium hover:bg-white/5 transition-colors">
            İptal
          </button>
          <button onClick={submit} disabled={!name.trim()}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium ${
              name.trim() ? 'bg-primary-500 hover:bg-primary-600 text-white' : 'bg-white/5 text-ink-muted cursor-not-allowed'
            }`}>
            Kaydet
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── ChainBreakModal ──────────────────────────────────────────────────────────

function ChainBreakModal({ habit, onSubmit, onClose }) {
  const [reason, setReason] = useState('')
  const ready     = reason.length >= MIN_BREAK_CHARS
  const remaining = MIN_BREAK_CHARS - reason.length

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-card border border-border-subtle rounded-xl w-full max-w-md shadow-none overflow-hidden">
        <div className="bg-status-error/10 px-6 pt-6 pb-4 border-b border-status-error/20">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-2xl mb-1">💔</p>
              <h3 className="text-base font-semibold text-ink-primary">Zincir Neden Kırıldı?</h3>
              <p className="text-sm text-ink-secondary mt-1">
                <span className="font-semibold text-ink-primary">{habit.name}</span>{' '}
                zinciri kırıldı. Devam edebilmek için sebebini açıkla.
              </p>
            </div>
            <button onClick={onClose} className="p-1.5 text-ink-secondary hover:text-ink-primary transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="p-6">
          <textarea value={reason} onChange={e => setReason(e.target.value)}
            placeholder="Zincirinin neden kırıldığını detaylıca açıkla..."
            rows={5} autoFocus
            className="w-full px-3 py-2.5 rounded-xl border border-border-subtle bg-white/5 text-ink-primary text-sm placeholder-ink-muted focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
          <div className="flex items-center justify-between mt-2 mb-5">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-32 bg-white/5 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${ready ? 'bg-green-500' : 'bg-primary-500'}`}
                  style={{ width: `${Math.min(100, (reason.length / MIN_BREAK_CHARS) * 100)}%` }} />
              </div>
              <span className={`text-xs font-mono font-medium ${ready ? 'text-green-500' : 'text-ink-muted'}`}>
                {reason.length} / {MIN_BREAK_CHARS}
              </span>
            </div>
            {!ready
              ? <span className="text-xs text-ink-muted">{remaining} karakter daha</span>
              : <span className="text-xs text-green-500 font-medium">✓ Hazır</span>
            }
          </div>
          <div className="flex gap-3">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-border-subtle text-ink-secondary text-sm font-medium hover:bg-white/5 transition-colors">
              İptal
            </button>
            <button onClick={() => ready && onSubmit(reason)} disabled={!ready}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                ready ? 'bg-primary-500 hover:bg-primary-600 text-white' : 'bg-white/5 text-ink-muted cursor-not-allowed'
              }`}>
              Zincirim Devam Ediyor →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── BreakArchive — cross-habit break analysis + history ─────────────────────

const TR_MONTHS_FULL = ['OCAK','ŞUBAT','MART','NİSAN','MAYIS','HAZİRAN','TEMMUZ','AĞUSTOS','EYLÜL','EKİM','KASIM','ARALIK']
const DAY_NAMES_FULL = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi']

function BreakArchive({ breakReasons, habits }) {
  const enriched = breakReasons
    .map(r => ({
      ...r,
      habitName: habits.find(h => h.id === r.habit_id)?.name || 'Silinmiş Alışkanlık',
    }))
    .sort((a, b) => b.break_date.localeCompare(a.break_date))

  if (enriched.length === 0) {
    return (
      <div className="text-center py-16 text-ink-muted">
        <p className="text-sm">Henüz kırılma kaydı yok.</p>
      </div>
    )
  }

  const now          = new Date()
  const thisMonth    = format(now, 'yyyy-MM')
  const lastMonth    = format(new Date(now.getFullYear(), now.getMonth() - 1, 1), 'yyyy-MM')
  const thisMonthCnt = enriched.filter(r => r.break_date.startsWith(thisMonth)).length
  const lastMonthCnt = enriched.filter(r => r.break_date.startsWith(lastMonth)).length

  const dowCounts = Array(7).fill(0)
  enriched.forEach(r => { dowCounts[parseISO(r.break_date).getDay()]++ })
  const maxDow = dowCounts.indexOf(Math.max(...dowCounts))
  const dowPct = enriched.length > 0 ? Math.round((dowCounts[maxDow] / enriched.length) * 100) : 0

  const habitCounts = {}
  enriched.forEach(r => { habitCounts[r.habit_id] = (habitCounts[r.habit_id] || 0) + 1 })
  const topEntry     = Object.entries(habitCounts).sort(([, a], [, b]) => b - a)[0]
  const topHabitName = topEntry ? (habits.find(h => h.id === topEntry[0])?.name || '—') : '—'
  const topHabitCnt  = topEntry?.[1] ?? 0

  const byMonth = {}
  enriched.forEach(r => {
    const mk = r.break_date.slice(0, 7)
    if (!byMonth[mk]) byMonth[mk] = []
    byMonth[mk].push(r)
  })
  const monthKeys = Object.keys(byMonth).sort((a, b) => b.localeCompare(a))

  const lbl = { fontSize: 10, color: '#444444', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }

  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-semibold text-ink-primary">Kırılma Arşivi</h2>

      {/* Pattern Analysis */}
      <div className="flex gap-3 flex-wrap">
        <div className="bg-surface-card/80 border border-border-subtle p-4 flex-1 min-w-[140px]" style={{ borderRadius: 4 }}>
          <p style={lbl}>Zor Gün</p>
          <p className="text-sm font-semibold text-ink-primary">{dowCounts[maxDow] > 0 ? `${DAY_NAMES_FULL[maxDow]} günleri` : '—'}</p>
          {dowCounts[maxDow] > 0 && <p className="text-xs text-ink-muted mt-1">Kırılmaların %{dowPct}'i bu günde</p>}
        </div>
        <div className="bg-surface-card/80 border border-border-subtle p-4 flex-1 min-w-[140px]" style={{ borderRadius: 4 }}>
          <p style={lbl}>Bu Ay / Geçen Ay</p>
          <p className="text-sm font-semibold text-ink-primary">{thisMonthCnt} / {lastMonthCnt}</p>
          <p className="text-xs text-ink-muted mt-1">
            {thisMonthCnt < lastMonthCnt ? 'Geçen aya göre iyileşme' : thisMonthCnt > lastMonthCnt ? 'Bu ay daha fazla kırılma' : 'Aynı seviye'}
          </p>
        </div>
        <div className="bg-surface-card/80 border border-border-subtle p-4 flex-1 min-w-[140px]" style={{ borderRadius: 4 }}>
          <p style={lbl}>En Çok Kırılan</p>
          <p className="text-sm font-semibold text-ink-primary truncate">{topHabitName}</p>
          {topHabitCnt > 0 && <p className="text-xs text-ink-muted mt-1">{topHabitCnt} kırılma</p>}
        </div>
      </div>

      {/* Break history grouped by month */}
      <div className="space-y-6">
        {monthKeys.map(mk => {
          const [yr, mo] = mk.split('-')
          const monthLabel = `${TR_MONTHS_FULL[parseInt(mo) - 1]} ${yr}`
          return (
            <div key={mk}>
              <p style={{ fontSize: 9, color: '#333333', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>
                {monthLabel}
              </p>
              <div className="space-y-2">
                {byMonth[mk].map((r, i) => (
                  <div key={`${r.habit_id}-${r.break_date}-${i}`}
                    className="bg-surface-card/80 border border-border-subtle p-4"
                    style={{ borderLeft: '2px solid rgba(185,28,28,0.4)', borderRadius: 4 }}>
                    <p className="text-sm font-semibold text-white mb-1">{r.habitName}</p>
                    <p style={{ fontSize: 12, color: '#888888', marginBottom: 4 }}>
                      {format(parseISO(r.break_date), 'd MMMM yyyy, EEEE', { locale: tr })}
                    </p>
                    <p style={{ fontSize: 12, color: '#888888', fontStyle: 'italic', lineHeight: 1.5 }}>{r.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Habits() {
  const { user } = useAuth()
  const [habits,       setHabits]       = useState([])
  const [logs,         setLogs]         = useState([])
  const [breakReasons, setBreakReasons] = useState([])
  const [habitNotes,   setHabitNotes]   = useState({})
  const [loading,      setLoading]      = useState(true)
  const [createModal,  setCreateModal]  = useState(false)
  const [editModal,    setEditModal]    = useState(null)
  const [breakModal,   setBreakModal]   = useState(null)
  const [expanded,     setExpanded]     = useState({})
  const [habitsTab,    setHabitsTab]    = useState('habits')

  async function load() {
    const [{ data: h }, { data: l }, { data: br }, { data: hn }] = await Promise.all([
      supabase.from('habits').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('habit_logs').select('*').eq('user_id', user.id),
      supabase.from('habit_break_reasons')
        .select('habit_id, break_date, reason, created_at')
        .eq('user_id', user.id),
      supabase.from('habit_notes').select('*').eq('user_id', user.id),
    ])
    setHabits(h || [])
    setLogs(l || [])
    setBreakReasons(br || [])
    const notesMap = {}
    ;(hn || []).forEach(n => { notesMap[n.habit_id] = n })
    setHabitNotes(notesMap)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function toggleSection(habitId, section) {
    setExpanded(prev => ({
      ...prev,
      [habitId]: { ...prev[habitId], [section]: !prev[habitId]?.[section] },
    }))
  }

  async function handleCreate({ name, duration_type, duration_days, template, target_days }) {
    setCreateModal(false)
    const { data, error } = await supabase.from('habits')
      .insert({ user_id: user.id, name, duration_type, duration_days, template, start_date: todayStr(), target_days })
      .select().single()
    if (error) { toast.error('Alışkanlık eklenemedi'); return }
    setHabits(h => [...h, data])
    toast.success('🎯 Alışkanlık oluşturuldu!')
  }

  async function handleEdit(habitId, updates) {
    setEditModal(null)
    const { data, error } = await supabase.from('habits')
      .update(updates).eq('id', habitId).select().single()
    if (error) { toast.error('Güncellenemedi'); return }
    setHabits(h => h.map(x => x.id === habitId ? data : x))
    toast.success('Güncellendi')
  }

  async function deleteHabit(id) {
    await Promise.all([
      supabase.from('habit_notes').delete().eq('habit_id', id),
      supabase.from('habit_break_reasons').delete().eq('habit_id', id),
      supabase.from('habit_logs').delete().eq('habit_id', id),
    ])
    await supabase.from('habits').delete().eq('id', id)
    setHabits(h => h.filter(x => x.id !== id))
    setLogs(l => l.filter(x => x.habit_id !== id))
    setBreakReasons(br => br.filter(x => x.habit_id !== id))
    toast.success('Alışkanlık silindi')
  }

  async function markToday(habit) {
    const { data } = await supabase.from('habit_logs')
      .insert({ habit_id: habit.id, user_id: user.id, date: todayStr(), completed: true })
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
    const doneToday = logs.some(l => l.habit_id === habit.id && l.date === todayStr() && l.completed)
    if (doneToday) { await unmarkToday(habit); return }

    const done       = completedSet(logs, habit.id)
    const td         = habit.target_days ?? ALL_DAYS
    const lastTarget = getMostRecentTargetDay(td)
    const chainBroken = done.size > 0 && lastTarget !== null && !done.has(lastTarget)

    if (chainBroken) {
      const lastBroken = getLastBroken(done, td)
      if (lastBroken) {
        const explained = breakReasons.some(r => r.habit_id === habit.id && r.break_date === lastBroken)
        if (!explained) { setBreakModal({ habit, lastBroken }); return }
      }
    }
    await markToday(habit)
  }

  async function handleBreakReasonSubmit(reason) {
    const { habit, lastBroken } = breakModal
    setBreakModal(null)
    const { data } = await supabase.from('habit_break_reasons')
      .insert({ habit_id: habit.id, user_id: user.id, break_date: lastBroken, reason })
      .select('habit_id, break_date, reason, created_at').single()
    if (data) setBreakReasons(br => [...br, data])
    await markToday(habit)
  }

  if (loading) return <div className="text-center py-20 text-ink-muted">Yükleniyor...</div>

  const SECTION_BTNS = [
    { key: 'notes',   Icon: FileText, label: 'Notlar'          },
    { key: 'history', Icon: History,  label: 'Kırılma Geçmişi' },
    { key: 'heatmap', Icon: Calendar, label: 'Yıllık Harita'   },
  ]

  const todayDow = new Date().getDay()

  return (
    <div>
      {/* ── Tab switcher ── */}
      <div className="flex gap-2 mb-5 bg-surface-card p-1 rounded-xl border border-border-subtle">
        {[
          { key: 'habits',  label: 'Alışkanlıklar'  },
          { key: 'archive', label: 'Kırılma Arşivi' },
          { key: 'yearly',  label: 'Yıllık Görünüm' },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setHabitsTab(key)}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
              habitsTab === key ? 'bg-white/10 text-ink-primary' : 'text-ink-muted hover:text-ink-secondary'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {habitsTab === 'habits' && (<>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-ink-primary">Alışkanlık Takibi</h2>
        <button
          onClick={() => setCreateModal(true)}
          className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 transition-colors text-sm font-medium"
        >
          <Plus size={16} /> Yeni Alışkanlık
        </button>
      </div>

      {habits.length === 0 ? (
        <div className="text-center py-16 text-ink-muted">
          <Flame size={40} className="mx-auto mb-3 opacity-40" />
          <p className="mb-3">Henüz alışkanlık yok.</p>
          <button onClick={() => setCreateModal(true)}
            className="text-primary-400 text-sm font-medium hover:underline">
            İlk alışkanlığını oluştur →
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {habits.map(habit => {
            const td          = habit.target_days ?? ALL_DAYS
            const done        = completedSet(logs, habit.id)
            const doneToday   = done.has(todayStr())
            const isTargetDay = td.includes(todayDow)
            const current     = getCurrentStreak(done, td)
            const longest     = getLongestStreak(done, td)
            const lastBroke   = getLastBroken(done, td)
            const progress    = getProgress(habit, done)
            const isExp       = expanded[habit.id] || {}
            const tplEmoji    = TEMPLATES.find(t => t.id === habit.template)?.emoji

            return (
              <div key={habit.id}
                className={`bg-surface-card/80 backdrop-blur-md rounded-xl p-4 border border-border-subtle hover:border-border-glow transition-colors duration-200 transition-opacity ${
                  !isTargetDay ? 'opacity-60' : ''
                }`}>

                {/* ── Header ── */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => isTargetDay && handleToggleToday(habit)}
                    disabled={!isTargetDay}
                    className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors shrink-0 ${
                      doneToday
                        ? 'bg-amber-400 border-amber-400 text-white'
                        : isTargetDay
                          ? 'border-ink-muted hover:border-amber-400'
                          : 'border-ink-muted/30 cursor-not-allowed'
                    }`}>
                    {doneToday && <Check size={16} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-ink-primary truncate">{habit.name}</p>
                    {!isTargetDay && (
                      <p className="text-xs text-ink-muted mt-0.5">Bugün hedef gün değil</p>
                    )}
                  </div>
                  {tplEmoji && habit.template !== 'custom' && (
                    <span className="text-base shrink-0">{tplEmoji}</span>
                  )}
                  <button onClick={() => setEditModal(habit)}
                    className="p-1.5 text-ink-secondary hover:text-primary-500 transition-colors shrink-0">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => deleteHabit(habit.id)}
                    className="p-1.5 text-ink-secondary hover:text-red-500 transition-colors shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* ── Progress bar (limited duration only) ── */}
                {progress && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-ink-secondary mb-1">
                      <span>{progress.completions} / {progress.total} gün tamamlandı</span>
                      <span className={progress.remaining === 0 ? 'text-green-500 font-semibold' : ''}>
                        {progress.remaining === 0 ? '🎉 Tamamlandı!' : `${progress.remaining} gün kaldı`}
                      </span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-primary-500 rounded-full transition-all"
                        style={{ width: `${progress.pct}%` }} />
                    </div>
                    <div className="text-right text-xs text-primary-400 font-medium mt-0.5">
                      %{progress.pct}
                    </div>
                  </div>
                )}

                {/* ── Chain boxes ── */}
                <ChainBoxes
                  logs={logs}
                  habitId={habit.id}
                  targetDays={td}
                  onToggleToday={() => handleToggleToday(habit)}
                />

                {/* ── Stats row ── */}
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 pt-3 border-t border-border-subtle">
                  <span className="flex items-center gap-1.5 text-xs">
                    <Flame size={13} className="text-orange-400 shrink-0" />
                    <span className="text-ink-secondary">
                      Mevcut seri: <strong className="text-ink-primary">{current}</strong> gün
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5 text-xs">
                    <Trophy size={13} className="text-amber-400 shrink-0" />
                    <span className="text-ink-secondary">
                      En uzun: <strong className="text-ink-primary">{longest}</strong> gün
                    </span>
                  </span>
                  {lastBroke && (
                    <span className="flex items-center gap-1.5 text-xs">
                      <span className="shrink-0">💔</span>
                      <span className="text-ink-muted">
                        Son kırılma: {format(parseISO(lastBroke), 'd MMM', { locale: tr })}
                      </span>
                    </span>
                  )}
                  {/* Target days badge */}
                  {td.length < 7 && (
                    <span className="flex items-center gap-1.5 text-xs text-ink-muted">
                      📅 {td.map(d => DAY_LABELS[d]).join('/')}
                    </span>
                  )}
                </div>

                {/* ── Section toggles ── */}
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border-subtle">
                  {SECTION_BTNS.map(({ key, Icon, label }) => (
                    <button key={key} onClick={() => toggleSection(habit.id, key)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                        isExp[key]
                          ? 'bg-primary-500/15 text-primary-400'
                          : 'bg-white/5 text-ink-muted hover:bg-white/10'
                      }`}>
                      <Icon size={12} />
                      {label}
                      {isExp[key] ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                    </button>
                  ))}
                </div>

                {/* ── Notes ── */}
                {isExp.notes && (
                  <HabitNotes
                    key={`notes-${habit.id}`}
                    habitId={habit.id}
                    userId={user.id}
                    initialNotes={habitNotes[habit.id]}
                    onSaved={(hid, notes) => setHabitNotes(prev => ({
                      ...prev, [hid]: { ...prev[hid], ...notes }
                    }))}
                  />
                )}

                {/* ── Break history ── */}
                {isExp.history && (
                  <BreakHistory breakReasons={breakReasons} habitId={habit.id} />
                )}

                {/* ── Year heatmap ── */}
                {isExp.heatmap && (
                  <YearHeatmap logs={logs} habitId={habit.id} />
                )}
              </div>
            )
          })}
        </div>
      )}

      </>)}

      {habitsTab === 'archive' && (
        <BreakArchive breakReasons={breakReasons} habits={habits} />
      )}

      {createModal && <HabitCreateModal onClose={() => setCreateModal(false)} onCreate={handleCreate} />}
      {editModal   && <HabitEditModal habit={editModal} onClose={() => setEditModal(null)} onSave={handleEdit} />}
      {breakModal  && <ChainBreakModal habit={breakModal.habit} onSubmit={handleBreakReasonSubmit} onClose={() => setBreakModal(null)} />}
    </div>
  )
}
