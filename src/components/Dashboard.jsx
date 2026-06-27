import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { format, subDays, parseISO } from 'date-fns'
import { tr } from 'date-fns/locale'

// ─── Constants ────────────────────────────────────────────────────────────────

const QUOTES = [
  'Büyük işler, küçük adımların birikmesiyle yapılır.',
  'Bugün yapabileceğini yarına bırakma.',
  'Disiplin, motivasyonun tükendiği yerde devreye girer.',
  'Her gün biraz daha iyi olmak yeterli.',
  'Başlamak, mükemmel olmaktan daha önemlidir.',
  'Küçük ilerleme, hiç ilerlememeye karşı kazanır.',
  'Alışkanlıklar, kaderimizi şekillendirir.',
  'Odaklan. Bir şey. Şimdi.',
  'Yorgunluk geçici, pişmanlık kalıcıdır.',
  'Sistem kur, motivasyona güvenme.',
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = d => format(d, 'yyyy-MM-dd')

// Deterministic quote per day — seed is sum of all charCodes in the date string
function dailyQuote() {
  const s   = fmt(new Date())
  const sum = [...s].reduce((a, c) => a + c.charCodeAt(0), 0)
  return QUOTES[sum % QUOTES.length]
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 animate-pulse bg-slate-200 dark:bg-slate-700 rounded-2xl" />
        ))}
      </div>
      <div className="h-28 animate-pulse bg-slate-200 dark:bg-slate-700 rounded-2xl" />
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="md:col-span-3 h-56 animate-pulse bg-slate-200 dark:bg-slate-700 rounded-2xl" />
        <div className="md:col-span-2 h-56 animate-pulse bg-slate-200 dark:bg-slate-700 rounded-2xl" />
      </div>
    </div>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ emoji, title, primary, secondary, error }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-4 flex flex-col gap-1.5 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="text-xl leading-none">{emoji}</span>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide truncate">
          {title}
        </p>
      </div>
      {error ? (
        <p className="text-xs text-red-400">Veri yüklenemedi</p>
      ) : (
        <>
          <p className="text-sm font-bold text-slate-800 dark:text-white leading-snug">{primary}</p>
          {secondary && (
            <p className="text-xs text-slate-400 dark:text-slate-500">{secondary}</p>
          )}
        </>
      )}
    </div>
  )
}

// ─── Momentum Ring (SVG) ──────────────────────────────────────────────────────

const RING_R    = 48
const RING_CIRC = 2 * Math.PI * RING_R

function MomentumRing({ score, habitScore, taskScore, pomoScore }) {
  const color = score >= 71 ? '#22c55e' : score >= 41 ? '#f59e0b' : '#ef4444'
  const dash  = Math.min(score / 100, 1) * RING_CIRC

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm h-full">
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-4">
        Haftalık Momentum
      </p>
      <div className="flex flex-col items-center">
        <svg viewBox="0 0 120 120" className="w-32 h-32 -mt-1">
          {/* Background track */}
          <circle cx="60" cy="60" r={RING_R} fill="none"
            strokeWidth="10"
            className="stroke-slate-200 dark:stroke-slate-600" />
          {/* Progress arc */}
          <circle cx="60" cy="60" r={RING_R} fill="none"
            stroke={color} strokeWidth="10"
            strokeDasharray={`${dash} ${RING_CIRC}`}
            strokeLinecap="round"
            transform="rotate(-90 60 60)"
          />
          {/* Score number */}
          <text x="60" y="56" textAnchor="middle" dominantBaseline="middle"
            fontSize="26" fontWeight="700"
            className="fill-slate-800 dark:fill-white">
            {score}
          </text>
          {/* /100 label */}
          <text x="60" y="74" textAnchor="middle" dominantBaseline="middle"
            fontSize="10" fill="#94a3b8">
            / 100
          </text>
        </svg>

        {/* Sub-scores */}
        <div className="w-full grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
          {[
            { label: 'Alışkanlık', val: habitScore, max: 40 },
            { label: 'Görev',     val: taskScore,  max: 30 },
            { label: 'Pomodoro',  val: pomoScore,  max: 30 },
          ].map(({ label, val, max }) => (
            <div key={label} className="text-center">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                {val}
                <span className="text-xs font-normal text-slate-400">/{max}</span>
              </p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user }  = useAuth()
  const navigate  = useNavigate()

  const today    = new Date()
  const todayStr = fmt(today)
  const todayDow = today.getDay()           // 0=Sun … 6=Sat
  const sevenAgo = fmt(subDays(today, 6))   // 7-day window: sevenAgo…today

  const [loading, setLoading] = useState(true)
  const [d, setD] = useState({
    habits: [], todayLogs: [], weekLogs: [],
    todayTasks: [], weekTasks: [],
    todayPomos: [], weekPomos: [],
    journal: null,
  })
  const [errs, setErrs] = useState({})

  useEffect(() => {
    async function load() {
      // All fetches run in parallel; each section degrades independently
      const [r0, r1, r2, r3, r4] = await Promise.allSettled([
        // [0] habits
        supabase.from('habits').select('*').eq('user_id', user.id),
        // [1] habit_logs for last 7 days (includes today — slice in JS)
        supabase.from('habit_logs').select('habit_id,date,completed')
          .eq('user_id', user.id)
          .gte('date', sevenAgo)
          .lte('date', todayStr),
        // [2] tasks with due_date in last 7 days
        supabase.from('tasks').select('id,title,completed,due_date,priority')
          .eq('user_id', user.id)
          .gte('due_date', sevenAgo)
          .lte('due_date', todayStr),
        // [3] completed pomodoro sessions from last 7 days
        supabase.from('pomodoro_sessions').select('id,was_completed,completed,started_at,completed_at,duration_minutes')
          .eq('user_id', user.id)
          .or('was_completed.eq.true,completed.eq.true')
          .gte('started_at', sevenAgo),
        // [4] today's journal entry
        supabase.from('journal_entries').select('id,date,content,images')
          .eq('user_id', user.id)
          .eq('date', todayStr)
          .limit(1),
      ])

      const habits   = r0.status === 'fulfilled' ? (r0.value.data || []) : []
      const allLogs  = r1.status === 'fulfilled' ? (r1.value.data || []) : []
      const allTasks = r2.status === 'fulfilled' ? (r2.value.data || []) : []
      const allPomos = r3.status === 'fulfilled' ? (r3.value.data || []) : []
      const journal  = r4.status === 'fulfilled' ? (r4.value.data?.[0] || null) : null

      // Slice into today vs. full 7-day window
      const todayLogs  = allLogs.filter(l => l.date === todayStr)
      const weekLogs   = allLogs

      const todayTasks = allTasks.filter(t => t.due_date === todayStr)
      const weekTasks  = allTasks

      // Pomodoros: determine "today" by the session's completion or start timestamp
      const pomodotodayDate = (p) => {
        const ts = p.completed_at || p.started_at
        return ts ? fmt(parseISO(ts)) : null
      }
      const todayPomos = allPomos.filter(p => pomodotodayDate(p) === todayStr)
      const weekPomos  = allPomos

      setD({ habits, todayLogs, weekLogs, todayTasks, weekTasks, todayPomos, weekPomos, journal })
      setErrs({
        habits:   r0.status === 'rejected' || r1.status === 'rejected',
        tasks:    r2.status === 'rejected',
        pomodoro: r3.status === 'rejected',
        journal:  r4.status === 'rejected',
      })
      setLoading(false)
    }
    load()
  }, [user.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived: habits ───────────────────────────────────────────────────────
  const todayHabits = d.habits.filter(h =>
    (h.target_days ?? [0, 1, 2, 3, 4, 5, 6]).includes(todayDow)
  )
  const completedTodayHabits = todayHabits.filter(h =>
    d.todayLogs.some(l => l.habit_id === h.id)
  )
  const incompleteHabits = todayHabits.filter(h =>
    !d.todayLogs.some(l => l.habit_id === h.id)
  )

  // ── Derived: tasks ────────────────────────────────────────────────────────
  const completedTodayTasks = d.todayTasks.filter(t => t.completed)
  const pendingTodayTasks   = d.todayTasks.filter(t => !t.completed)
  const highPriorityTask    = pendingTodayTasks.find(t => t.priority === 'high')

  // ── Derived: pomodoro ─────────────────────────────────────────────────────
  const todayPomoCount = d.todayPomos.length
  const todayPomoMins  = d.todayPomos.reduce((sum, p) => sum + (p.duration_minutes ?? 25), 0)

  // ── Derived: journal ──────────────────────────────────────────────────────
  const journalHasContent = d.journal &&
    (d.journal.images?.length > 0 || d.journal.content?.trim())

  // ── Derived: momentum score ───────────────────────────────────────────────
  // Habit component — count expected vs. completed across the last 7 days
  let habitExpected = 0, habitDone = 0
  for (let i = 0; i < 7; i++) {
    const day     = subDays(today, i)
    const dow     = day.getDay()
    const ds      = fmt(day)
    const dayHabs = d.habits.filter(h => (h.target_days ?? [0, 1, 2, 3, 4, 5, 6]).includes(dow))
    habitExpected += dayHabs.length
    habitDone     += d.weekLogs.filter(l =>
      l.date === ds && dayHabs.some(h => h.id === l.habit_id)
    ).length
  }
  const habitScore = habitExpected > 0
    ? Math.round((habitDone / habitExpected) * 40)
    : 0

  const taskTotal  = d.weekTasks.length
  const taskDone   = d.weekTasks.filter(t => t.completed).length
  const taskScore  = taskTotal > 0 ? Math.round((taskDone / taskTotal) * 30) : 0

  const pomoScore    = Math.round(Math.min(d.weekPomos.length / 28, 1) * 30)
  const momentumScore = habitScore + taskScore + pomoScore

  // ── Derived: action ───────────────────────────────────────────────────────
  let action
  if (highPriorityTask) {
    action = {
      emoji: '🚨',
      text:  highPriorityTask.title,
      sub:   'Yüksek öncelikli görev — bugün bitirilmeli',
      href:  '/todos',
      btn:   'Görevlere git',
    }
  } else if (incompleteHabits.length > 0) {
    action = {
      emoji: '🔥',
      text:  incompleteHabits[0].name,
      sub:   `${incompleteHabits.length} alışkanlık tamamlanmayı bekliyor`,
      href:  '/habits',
      btn:   'Alışkanlıklara git',
    }
  } else if (todayPomoCount < 4) {
    action = {
      emoji: '🍅',
      text:  `Pomodoro zamanı — henüz ${todayPomoCount} pomodoro tamamladın`,
      sub:   `Günlük hedefe ulaşmak için ${4 - todayPomoCount} pomodoro daha`,
      href:  '/pomodoro',
      btn:   "Pomodoro'ya git",
    }
  } else {
    action = {
      emoji: '🎉',
      text:  'Harika! Bugünkü hedeflerini tamamladın',
      sub:   null,
      href:  null,
      btn:   null,
    }
  }

  // ── Quote ─────────────────────────────────────────────────────────────────
  const quote = dailyQuote()

  return (
    <div>
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
          Bugünün Komuta Merkezi
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 capitalize">
          {format(today, 'd MMMM yyyy, EEEE', { locale: tr })}
        </p>
      </div>

      {loading ? <Skeleton /> : (
        <div className="space-y-4">

          {/* ── Section 1: Günün Özeti ──────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              emoji="🔥"
              title="Alışkanlıklar"
              primary={
                todayHabits.length === 0
                  ? 'Bugün hedef gün yok'
                  : `${completedTodayHabits.length} / ${todayHabits.length} tamamlandı`
              }
              secondary={
                todayHabits.length > 0
                  ? (incompleteHabits.length > 0
                      ? `${incompleteHabits.length} alışkanlık bekliyor`
                      : 'Tümü tamam! 🎯')
                  : undefined
              }
              error={errs.habits}
            />
            <StatCard
              emoji="✅"
              title="Görevler"
              primary={`${completedTodayTasks.length} görev tamamlandı bugün`}
              secondary={
                pendingTodayTasks.length > 0
                  ? `${pendingTodayTasks.length} görev bekliyor`
                  : d.todayTasks.length === 0
                    ? 'Bugün görev yok'
                    : 'Tümü tamamlandı! ✅'
              }
              error={errs.tasks}
            />
            <StatCard
              emoji="🍅"
              title="Pomodoro"
              primary={`${todayPomoCount} pomodoro — ${todayPomoMins} dk odak`}
              secondary={
                todayPomoCount >= 4
                  ? 'Günlük hedefe ulaşıldı 🎯'
                  : `${4 - todayPomoCount} oturum daha önerilir`
              }
              error={errs.pomodoro}
            />
            <StatCard
              emoji="📔"
              title="Günlük"
              primary={journalHasContent ? '✍️ Yazıldı' : '📭 Henüz yazılmadı'}
              secondary={
                journalHasContent
                  ? format(today, 'd MMMM', { locale: tr })
                  : 'Bugün bir şeyler yaz'
              }
              error={errs.journal}
            />
          </div>

          {/* ── Section 2: Şimdi Ne Yapmalıyım? ────────────────────────── */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 border-l-4 border-l-primary-500 dark:border-l-primary-400 shadow-sm p-5">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
              Şimdi Ne Yapmalıyım?
            </p>
            <div className="flex items-start gap-3">
              <span className="text-2xl leading-none mt-0.5 shrink-0">{action.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold text-slate-800 dark:text-white leading-snug">
                  {action.text}
                </p>
                {action.sub && (
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{action.sub}</p>
                )}
              </div>
              {action.href && (
                <button
                  onClick={() => navigate(action.href)}
                  className="shrink-0 px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium transition-colors whitespace-nowrap">
                  {action.btn} →
                </button>
              )}
            </div>
          </div>

          {/* ── Sections 3 + 4: Momentum & Motivasyon ──────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">

            {/* Haftalık Momentum */}
            <div className="md:col-span-3">
              <MomentumRing
                score={momentumScore}
                habitScore={habitScore}
                taskScore={taskScore}
                pomoScore={pomoScore}
              />
            </div>

            {/* Motivasyon */}
            <div className="md:col-span-2">
              <div className="h-full bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-5 flex flex-col">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-4">
                  Motivasyon
                </p>
                {journalHasContent ? (
                  <div className="flex-1 flex flex-col justify-center items-center text-center gap-2">
                    <span className="text-5xl">📸</span>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mt-1">
                      Bugün günlük yazıldı
                    </p>
                    <p className="text-xs text-slate-400">
                      {format(today, 'd MMMM yyyy', { locale: tr })}
                    </p>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col justify-center">
                    <p className="text-base italic text-slate-600 dark:text-slate-300 leading-relaxed">
                      &ldquo;{quote}&rdquo;
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-4">
                      — EF Komuta Merkezi
                    </p>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
