import { useEffect, useRef, useState } from 'react'
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

const fmt       = d => format(d, 'yyyy-MM-dd')
const RING_R    = 48
const RING_CIRC = 2 * Math.PI * RING_R

function dailyQuote() {
  const s   = fmt(new Date())
  const sum = [...s].reduce((a, c) => a + c.charCodeAt(0), 0)
  return QUOTES[sum % QUOTES.length]
}

// ─── Particle Canvas ──────────────────────────────────────────────────────────

function ParticleCanvas() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (window.innerWidth < 768) { canvas.style.display = 'none'; return }

    const ctx = canvas.getContext('2d')
    const N   = 120

    function resize() {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()

    // 70% tiny white stars, 30% violet stars — each with independent twinkle
    const pts = Array.from({ length: N }, (_, i) => {
      const isWhite = i < N * 0.7
      return {
        x:         Math.random() * canvas.width,
        y:         Math.random() * canvas.height,
        r:         isWhite ? 0.4 + Math.random() * 0.6 : 0.9 + Math.random() * 1,
        vx:        (Math.random() - 0.5) * 0.12,
        vy:        (Math.random() - 0.5) * 0.12,
        baseAlpha: isWhite ? 0.3 + Math.random() * 0.4 : 0.4 + Math.random() * 0.35,
        isWhite,
        phase:     Math.random() * Math.PI * 2,
        period:    1800 + Math.random() * 2500,
      }
    })

    let raf, lastTs = 0, fps = 60, stopped = false

    function draw(ts) {
      if (stopped) return
      if (document.visibilityState === 'hidden') { raf = requestAnimationFrame(draw); return }

      const dt = ts - lastTs
      if (lastTs > 0 && dt > 0) fps = fps * 0.95 + (1000 / dt) * 0.05
      lastTs = ts

      if (fps < 28 && ts > 2000) { canvas.style.display = 'none'; stopped = true; return }

      const W = canvas.width, H = canvas.height
      ctx.clearRect(0, 0, W, H)

      for (const p of pts) {
        p.x = (p.x + p.vx + W) % W
        p.y = (p.y + p.vy + H) % H
        const t     = (ts % p.period) / p.period
        const alpha = p.baseAlpha * (0.6 + 0.4 * Math.sin(p.phase + t * Math.PI * 2))
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = p.isWhite
          ? `rgba(255,255,255,${alpha})`
          : `rgba(139,92,246,${alpha})`
        ctx.fill()
      }

      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)
    window.addEventListener('resize', resize)
    return () => { stopped = true; cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-screen h-screen pointer-events-none"
      style={{ zIndex: 0 }}
    />
  )
}

// ─── Orbital Glow Ring ────────────────────────────────────────────────────────

function OrbitalGlow() {
  return (
    <div
      className="fixed pointer-events-none hidden md:block"
      style={{
        width: 580,
        height: 580,
        top: '50%',
        right: '10%',
        borderRadius: '50%',
        border: '1.5px solid rgba(139,92,246,0.45)',
        boxShadow: [
          '0 0 40px 6px rgba(139,92,246,0.18)',
          '0 0 100px 24px rgba(108,63,232,0.08)',
          'inset 0 0 50px rgba(108,63,232,0.06)',
        ].join(', '),
        animation: 'orbitalSpin 24s linear infinite',
        opacity: 0.55,
        zIndex: 0,
      }}
    />
  )
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 animate-pulse bg-surface-card/60 rounded-xl border border-border-subtle" />
        ))}
      </div>
      <div className="h-28 animate-pulse bg-surface-card/60 rounded-xl border border-border-subtle" />
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="md:col-span-3 h-56 animate-pulse bg-surface-card/60 rounded-xl border border-border-subtle" />
        <div className="md:col-span-2 h-56 animate-pulse bg-surface-card/60 rounded-xl border border-border-subtle" />
      </div>
    </div>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ emoji, title, primary, secondary, error }) {
  return (
    <div className="bg-surface-card/80 backdrop-blur-md border border-border-subtle rounded-xl p-5 flex flex-col gap-1.5 hover:border-border-glow transition-colors duration-200">
      <div className="flex items-center gap-2">
        <span className="text-lg leading-none">{emoji}</span>
        <p className="text-[11px] font-medium text-ink-secondary uppercase tracking-widest truncate">{title}</p>
      </div>
      {error ? (
        <p className="text-xs text-status-error">Veri yüklenemedi</p>
      ) : (
        <>
          <p className="text-sm font-semibold text-ink-primary leading-snug">{primary}</p>
          {secondary && <p className="text-xs text-ink-muted">{secondary}</p>}
        </>
      )}
    </div>
  )
}

// ─── Momentum Ring ────────────────────────────────────────────────────────────

function MomentumRing({ score, habitScore, taskScore, pomoScore }) {
  const color = score >= 71 ? '#22C55E' : score >= 41 ? '#F59E0B' : '#EF4444'
  const dash  = Math.min(score / 100, 1) * RING_CIRC

  return (
    <div className="bg-surface-card/80 backdrop-blur-md border border-border-subtle rounded-xl p-5 hover:border-border-glow transition-colors duration-200 h-full">
      <p className="text-[11px] font-medium text-ink-secondary uppercase tracking-widest mb-4">
        Haftalık Momentum
      </p>
      <div className="flex flex-col items-center">
        <svg viewBox="0 0 120 120" className="w-32 h-32">
          <circle cx="60" cy="60" r={RING_R} fill="none" strokeWidth="10" className="stroke-white/5" />
          <circle cx="60" cy="60" r={RING_R} fill="none"
            stroke={color} strokeWidth="10"
            strokeDasharray={`${dash} ${RING_CIRC}`}
            strokeLinecap="round"
            transform="rotate(-90 60 60)"
            style={{ transition: 'stroke-dasharray 0.6s ease' }}
          />
          <text x="60" y="56" textAnchor="middle" dominantBaseline="middle"
            fontSize="26" fontWeight="700" fill="#F0F0FF">
            {score}
          </text>
          <text x="60" y="74" textAnchor="middle" dominantBaseline="middle"
            fontSize="10" fill="#3D3D5C">
            / 100
          </text>
        </svg>

        <div className="w-full grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-border-subtle">
          {[
            { label: 'Alışkanlık', val: habitScore, max: 40 },
            { label: 'Görev',      val: taskScore,  max: 30 },
            { label: 'Pomodoro',   val: pomoScore,  max: 30 },
          ].map(({ label, val, max }) => (
            <div key={label} className="text-center">
              <p className="text-sm font-bold text-ink-primary">
                {val}<span className="text-xs font-normal text-ink-muted">/{max}</span>
              </p>
              <p className="text-[10px] text-ink-muted mt-0.5">{label}</p>
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
  const todayDow = today.getDay()
  const sevenAgo = fmt(subDays(today, 6))

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
      const [r0, r1, r2, r3, r4] = await Promise.allSettled([
        supabase.from('habits').select('*').eq('user_id', user.id),
        supabase.from('habit_logs').select('habit_id,date,completed')
          .eq('user_id', user.id).gte('date', sevenAgo).lte('date', todayStr),
        supabase.from('tasks').select('id,title,completed,due_date,priority')
          .eq('user_id', user.id).gte('due_date', sevenAgo).lte('due_date', todayStr),
        supabase.from('pomodoro_sessions').select('id,was_completed,completed,started_at,completed_at,duration_minutes')
          .eq('user_id', user.id).or('was_completed.eq.true,completed.eq.true').gte('started_at', sevenAgo),
        supabase.from('journal_entries').select('id,date,content,images')
          .eq('user_id', user.id).eq('date', todayStr).limit(1),
      ])

      const habits   = r0.status === 'fulfilled' ? (r0.value.data || []) : []
      const allLogs  = r1.status === 'fulfilled' ? (r1.value.data || []) : []
      const allTasks = r2.status === 'fulfilled' ? (r2.value.data || []) : []
      const allPomos = r3.status === 'fulfilled' ? (r3.value.data || []) : []
      const journal  = r4.status === 'fulfilled' ? (r4.value.data?.[0] || null) : null

      const todayPomos = allPomos.filter(p => {
        const ts = p.completed_at || p.started_at
        return ts ? fmt(parseISO(ts)) === todayStr : false
      })

      setD({
        habits,
        todayLogs:  allLogs.filter(l => l.date === todayStr),
        weekLogs:   allLogs,
        todayTasks: allTasks.filter(t => t.due_date === todayStr),
        weekTasks:  allTasks,
        todayPomos,
        weekPomos:  allPomos,
        journal,
      })
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

  // ── Derived ───────────────────────────────────────────────────────────────
  const todayHabits = d.habits.filter(h =>
    (h.target_days ?? [0, 1, 2, 3, 4, 5, 6]).includes(todayDow)
  )
  const completedTodayHabits = todayHabits.filter(h => d.todayLogs.some(l => l.habit_id === h.id))
  const incompleteHabits     = todayHabits.filter(h => !d.todayLogs.some(l => l.habit_id === h.id))

  const completedTodayTasks = d.todayTasks.filter(t => t.completed)
  const pendingTodayTasks   = d.todayTasks.filter(t => !t.completed)
  const highPriorityTask    = pendingTodayTasks.find(t => t.priority === 'high')

  const todayPomoCount = d.todayPomos.length
  const todayPomoMins  = d.todayPomos.reduce((s, p) => s + (p.duration_minutes ?? 25), 0)
  const journalHasContent = d.journal && (d.journal.images?.length > 0 || d.journal.content?.trim())

  // Momentum
  let habitExpected = 0, habitDone = 0
  for (let i = 0; i < 7; i++) {
    const day  = subDays(today, i)
    const dow  = day.getDay()
    const ds   = fmt(day)
    const dh   = d.habits.filter(h => (h.target_days ?? [0, 1, 2, 3, 4, 5, 6]).includes(dow))
    habitExpected += dh.length
    habitDone     += d.weekLogs.filter(l => l.date === ds && dh.some(h => h.id === l.habit_id)).length
  }
  const habitScore    = habitExpected > 0 ? Math.round((habitDone / habitExpected) * 40) : 0
  const taskScore     = d.weekTasks.length > 0 ? Math.round((d.weekTasks.filter(t => t.completed).length / d.weekTasks.length) * 30) : 0
  const pomoScore     = Math.round(Math.min(d.weekPomos.length / 28, 1) * 30)
  const momentumScore = habitScore + taskScore + pomoScore

  // Action
  let action
  if (highPriorityTask) {
    action = { emoji: '🚨', text: highPriorityTask.title, sub: 'Yüksek öncelikli görev — bugün bitirilmeli', href: '/todos', btn: 'Görevlere git' }
  } else if (incompleteHabits.length > 0) {
    action = { emoji: '🔥', text: incompleteHabits[0].name, sub: `${incompleteHabits.length} alışkanlık tamamlanmayı bekliyor`, href: '/habits', btn: 'Alışkanlıklara git' }
  } else if (todayPomoCount < 4) {
    action = { emoji: '🍅', text: `Pomodoro zamanı — henüz ${todayPomoCount} pomodoro tamamladın`, sub: `${4 - todayPomoCount} oturum daha önerilir`, href: '/pomodoro', btn: "Pomodoro'ya git" }
  } else {
    action = { emoji: '🎉', text: 'Harika! Bugünkü hedeflerini tamamladın', sub: null, href: null, btn: null }
  }

  const quote = dailyQuote()

  return (
    <>
      <ParticleCanvas />
      <OrbitalGlow />

      <div>
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-ink-primary">Bugünün Komuta Merkezi</h2>
          <p className="text-sm text-ink-secondary mt-0.5 capitalize">
            {format(today, 'd MMMM yyyy, EEEE', { locale: tr })}
          </p>
        </div>

        {loading ? <Skeleton /> : (
          <div className="space-y-4">

            {/* ── Section 1: Günün Özeti ─────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard
                emoji="🔥"
                title="Alışkanlıklar"
                primary={todayHabits.length === 0 ? 'Bugün hedef gün yok' : `${completedTodayHabits.length} / ${todayHabits.length} tamamlandı`}
                secondary={todayHabits.length > 0 ? (incompleteHabits.length > 0 ? `${incompleteHabits.length} bekliyor` : 'Tümü tamam 🎯') : undefined}
                error={errs.habits}
              />
              <StatCard
                emoji="✅"
                title="Görevler"
                primary={`${completedTodayTasks.length} tamamlandı bugün`}
                secondary={pendingTodayTasks.length > 0 ? `${pendingTodayTasks.length} görev bekliyor` : d.todayTasks.length === 0 ? 'Bugün görev yok' : 'Tümü bitti ✅'}
                error={errs.tasks}
              />
              <StatCard
                emoji="🍅"
                title="Pomodoro"
                primary={`${todayPomoCount} oturum — ${todayPomoMins} dk`}
                secondary={todayPomoCount >= 4 ? 'Günlük hedefe ulaşıldı 🎯' : `${4 - todayPomoCount} oturum daha önerilir`}
                error={errs.pomodoro}
              />
              <StatCard
                emoji="📔"
                title="Günlük"
                primary={journalHasContent ? '✍️ Yazıldı' : '📭 Henüz yazılmadı'}
                secondary={journalHasContent ? format(today, 'd MMMM', { locale: tr }) : 'Bugün bir şeyler yaz'}
                error={errs.journal}
              />
            </div>

            {/* ── Section 2: Şimdi Ne Yapmalıyım? ────────────────────────── */}
            <div className="bg-surface-card/80 backdrop-blur-md border border-border-subtle border-l-[3px] border-l-primary-500 rounded-xl p-5 hover:border-border-glow transition-colors duration-200">
              <p className="text-[11px] font-medium text-ink-secondary uppercase tracking-widest mb-3">
                Şimdi Ne Yapmalıyım?
              </p>
              <div className="flex items-start gap-3">
                <span className="text-2xl leading-none mt-0.5 shrink-0">{action.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink-primary leading-snug">{action.text}</p>
                  {action.sub && <p className="text-xs text-ink-muted mt-0.5">{action.sub}</p>}
                </div>
                {action.href && (
                  <button
                    onClick={() => navigate(action.href)}
                    className="shrink-0 px-3 py-1.5 rounded-lg bg-primary-500 hover:bg-primary-600 text-white text-xs font-medium transition-colors whitespace-nowrap">
                    {action.btn} →
                  </button>
                )}
              </div>
            </div>

            {/* ── Sections 3 + 4: Momentum & Motivasyon ──────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">

              <div className="md:col-span-3">
                <MomentumRing
                  score={momentumScore}
                  habitScore={habitScore}
                  taskScore={taskScore}
                  pomoScore={pomoScore}
                />
              </div>

              <div className="md:col-span-2">
                <div className="h-full bg-surface-card/80 backdrop-blur-md border border-border-subtle rounded-xl p-5 flex flex-col hover:border-border-glow transition-colors duration-200">
                  <p className="text-[11px] font-medium text-ink-secondary uppercase tracking-widest mb-4">
                    Motivasyon
                  </p>
                  {journalHasContent ? (
                    <div className="flex-1 flex flex-col justify-center items-center text-center gap-2">
                      <span className="text-4xl">📸</span>
                      <p className="text-sm font-medium text-ink-primary mt-1">Bugün günlük yazıldı</p>
                      <p className="text-xs text-ink-muted">{format(today, 'd MMMM yyyy', { locale: tr })}</p>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col justify-center">
                      <p className="text-sm italic text-ink-secondary leading-relaxed">&ldquo;{quote}&rdquo;</p>
                      <p className="text-xs text-ink-muted mt-4">— EF Komuta Merkezi</p>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  )
}
