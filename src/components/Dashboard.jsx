import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Flame, CheckSquare, Timer, BookOpen, Zap, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { format, subDays, parseISO, startOfWeek } from 'date-fns'
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

function StatCard({ icon: Icon, title, primary, secondary, error }) {
  return (
    <div className="bg-surface-card/80 backdrop-blur-md border border-border-subtle rounded-xl p-5 flex flex-col gap-1.5 h-full hover:border-border-glow transition-colors duration-200">
      <div className="flex items-center gap-2">
        <Icon size={16} style={{ color: '#b91c1c', flexShrink: 0 }} />
        <p className="text-[10px] font-bold text-primary-500 uppercase tracking-[0.15em] truncate">{title}</p>
      </div>
      {error ? (
        <p className="text-xs text-status-error">Veri yüklenemedi</p>
      ) : (
        <>
          <p className="text-sm font-bold text-ink-primary leading-snug">{primary}</p>
          {secondary && <p className="text-xs text-white/40">{secondary}</p>}
        </>
      )}
    </div>
  )
}

// ─── Momentum Ring ────────────────────────────────────────────────────────────

function MomentumRing({ score, habitScore, taskScore, pomoScore }) {
  const color = '#b91c1c'
  const dash  = Math.min(score / 100, 1) * RING_CIRC

  return (
    <div className="bg-surface-card/80 backdrop-blur-md border border-border-subtle rounded-xl p-5 hover:border-border-glow transition-colors duration-200 h-full">
      <p className="text-[10px] font-bold text-primary-500 uppercase tracking-[0.15em] mb-4">
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
            fontSize="30" fontWeight="700" fill="#ffffff">
            {score}
          </text>
          <text x="60" y="74" textAnchor="middle" dominantBaseline="middle"
            fontSize="10" fill="rgba(255,255,255,0.3)">
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

  const [modal,              setModal]              = useState(null)
  const [step,               setStep]               = useState(1)
  const [morningTasks,       setMorningTasks]       = useState(['', '', ''])
  const [eveningNote,        setEveningNote]        = useState('')
  const [tomorrowPriorities, setTomorrowPriorities] = useState(['', '', ''])

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

  // ── Modal helpers ─────────────────────────────────────────────────────────

  const DOW_KEY = ['sun','mon','tue','wed','thu','fri','sat']

  async function openModal(type) {
    setStep(1)
    setModal(type)
    if (type === 'morning') {
      const ws = fmt(startOfWeek(new Date(), { weekStartsOn: 1 }))
      const { data } = await supabase
        .from('weekly_plans').select('day_tasks')
        .eq('user_id', user.id).eq('week_start', ws).maybeSingle()
      const dk    = DOW_KEY[new Date().getDay()]
      const items = (data?.day_tasks?.[dk] || []).slice(0, 3)
      setMorningTasks(
        [0, 1, 2].map(i => (typeof items[i] === 'string' ? items[i] : items[i]?.text) || '')
      )
    } else {
      setEveningNote('')
      setTomorrowPriorities(['', '', ''])
    }
  }

  function closeModal() { setModal(null); setStep(1) }

  async function saveJournalNote() {
    if (!eveningNote.trim()) return
    const { data: ex } = await supabase
      .from('journal_entries').select('id,content')
      .eq('user_id', user.id).eq('date', todayStr).maybeSingle()
    if (ex) {
      await supabase.from('journal_entries')
        .update({ content: ex.content ? `${ex.content}\n\n---\n${eveningNote}` : eveningNote })
        .eq('id', ex.id)
    } else {
      await supabase.from('journal_entries')
        .insert({ user_id: user.id, date: todayStr, content: eveningNote, images: [] })
    }
  }

  async function saveTomorrowPlan() {
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
    const ws  = fmt(startOfWeek(tomorrow, { weekStartsOn: 1 }))
    const dk  = DOW_KEY[tomorrow.getDay()]
    const { data: ex } = await supabase
      .from('weekly_plans').select('*').eq('user_id', user.id).eq('week_start', ws).maybeSingle()
    const EMPTY    = { mon:[], tue:[], wed:[], thu:[], fri:[], sat:[], sun:[] }
    const newTasks = tomorrowPriorities.filter(t => t.trim()).map(text => ({ text, done: false }))
    const patch    = { ...(ex?.day_tasks || EMPTY), [dk]: newTasks }
    if (ex) {
      await supabase.from('weekly_plans').update({ day_tasks: patch }).eq('id', ex.id)
    } else {
      await supabase.from('weekly_plans').insert({ user_id: user.id, week_start: ws, day_tasks: patch })
    }
  }

  return (
    <div style={{ background: 'transparent' }}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="mb-6 pl-3 border-l-2 border-primary-500">
          <h2 className="text-2xl font-bold tracking-widest uppercase text-ink-primary">Bugünün Komuta Merkezi</h2>
          <p className="text-sm text-ink-secondary mt-0.5 capitalize">
            {format(today, 'd MMMM yyyy, EEEE', { locale: tr })}
          </p>
        </div>

        {loading ? <Skeleton /> : (
          <div className="space-y-4">

            {/* ── Section 1: Günün Özeti ─────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard
                icon={Flame}
                title="Alışkanlıklar"
                primary={todayHabits.length === 0 ? 'Bugün hedef gün yok' : `${completedTodayHabits.length} / ${todayHabits.length} tamamlandı`}
                secondary={todayHabits.length > 0 ? (incompleteHabits.length > 0 ? `${incompleteHabits.length} bekliyor` : 'Tümü tamam 🎯') : undefined}
                error={errs.habits}
              />
              <StatCard
                icon={CheckSquare}
                title="Görevler"
                primary={`${completedTodayTasks.length} tamamlandı bugün`}
                secondary={pendingTodayTasks.length > 0 ? `${pendingTodayTasks.length} görev bekliyor` : d.todayTasks.length === 0 ? 'Bugün görev yok' : 'Tümü bitti ✅'}
                error={errs.tasks}
              />
              <StatCard
                icon={Timer}
                title="Pomodoro"
                primary={`${todayPomoCount} oturum — ${todayPomoMins} dk`}
                secondary={todayPomoCount >= 4 ? 'Günlük hedefe ulaşıldı 🎯' : `${4 - todayPomoCount} oturum daha önerilir`}
                error={errs.pomodoro}
              />
              <StatCard
                icon={BookOpen}
                title="Günlük"
                primary={journalHasContent ? '✍️ Yazıldı' : '📭 Henüz yazılmadı'}
                secondary={journalHasContent ? format(today, 'd MMMM', { locale: tr }) : 'Bugün bir şeyler yaz'}
                error={errs.journal}
              />
            </div>

            {/* ── Section 2: Şimdi Ne Yapmalıyım? ────────────────────────── */}
            <div className="bg-surface-card/80 backdrop-blur-md border border-border-subtle border-l-[3px] border-l-primary-500 rounded-xl p-5 hover:border-border-glow transition-colors duration-200">
              <p className="text-[10px] font-medium text-ink-muted uppercase tracking-[0.15em] mb-3">
                Şimdi Ne Yapmalıyım?
              </p>
              <div className="flex items-start gap-3">
                <Zap size={16} style={{ color: '#b91c1c', flexShrink: 0, marginTop: 2 }} />
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
                  <p className="text-[10px] font-medium text-ink-muted uppercase tracking-[0.15em] mb-4">
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

            {/* ── Sabah / Akşam buttons ─────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => openModal('morning').catch(console.error)}
                style={{ height: 40, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', borderRadius: 2 }}
                className="text-sm text-ink-secondary hover:text-white hover:border-white/20 transition-colors"
              >
                ☀ Sabah Brifingi
              </button>
              <button
                onClick={() => openModal('evening').catch(console.error)}
                style={{ height: 40, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', borderRadius: 2 }}
                className="text-sm text-ink-secondary hover:text-white hover:border-white/20 transition-colors"
              >
                ◐ Günü Kapat
              </button>
            </div>

          </div>
        )}

        {/* ── Modal overlay ─────────────────────────────────────────────────── */}
        {modal && (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
            onClick={e => e.target === e.currentTarget && closeModal()}
          >
            <div style={{ width: '100%', maxWidth: 560, background: '#111111', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, padding: 32, position: 'relative' }}>

              {/* Close */}
              <button onClick={closeModal} style={{ position: 'absolute', top: 14, right: 14, color: '#444444', lineHeight: 1 }} className="hover:text-white transition-colors">
                <X size={18} />
              </button>

              {/* Step dots */}
              <div style={{ display: 'flex', gap: 5, marginBottom: 24 }}>
                {[1,2,3].map(s => (
                  <div key={s} style={{ width: 5, height: 5, borderRadius: '50%', background: s === step ? '#b91c1c' : 'rgba(255,255,255,0.1)' }} />
                ))}
              </div>

              {/* ── SABAH BRİFİNGİ ─────────────────────────────────────── */}
              {modal === 'morning' && (
                <>
                  {step === 1 && (
                    <div>
                      <p className="text-[10px] font-medium text-ink-muted uppercase tracking-[0.15em] mb-4">Bugünün Alışkanlıkları</p>
                      <div className="space-y-2 mb-6">
                        {todayHabits.length === 0 ? (
                          <p className="text-sm text-ink-muted">Bugün için alışkanlık hedefi yok.</p>
                        ) : todayHabits.map(h => {
                          const done = d.todayLogs.some(l => l.habit_id === h.id)
                          return (
                            <div key={h.id} className="flex items-center gap-3 py-0.5">
                              <div style={{ width: 14, height: 14, borderRadius: 2, border: done ? 'none' : '1px solid rgba(255,255,255,0.15)', background: done ? '#b91c1c' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {done && <span style={{ fontSize: 8, color: '#fff' }}>✓</span>}
                              </div>
                              <span className={`text-sm ${done ? 'text-ink-muted line-through' : 'text-ink-primary'}`}>{h.name}</span>
                            </div>
                          )
                        })}
                      </div>
                      <button onClick={() => setStep(2)} className="w-full h-10 bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium transition-colors" style={{ borderRadius: 2 }}>
                        Devam →
                      </button>
                    </div>
                  )}

                  {step === 2 && (
                    <div>
                      <p className="text-[10px] font-medium text-ink-muted uppercase tracking-[0.15em] mb-4">Bugünün 3 Kritik Görevi</p>
                      <div className="space-y-2 mb-6">
                        {morningTasks.map((task, i) => (
                          <div key={i} className="flex items-center gap-3">
                            <span className="text-xs font-bold text-ink-muted w-4 text-right shrink-0">{i + 1}.</span>
                            <input
                              type="text"
                              value={task}
                              onChange={e => { const n = [...morningTasks]; n[i] = e.target.value; setMorningTasks(n) }}
                              placeholder="Görev..."
                              className="flex-1 bg-white/5 border border-border-subtle text-ink-primary text-sm px-3 py-2 focus:outline-none focus:border-border-glow placeholder:text-ink-muted/40 transition-colors"
                              style={{ borderRadius: 2 }}
                            />
                          </div>
                        ))}
                      </div>
                      <button onClick={() => setStep(3)} className="w-full h-10 bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium transition-colors" style={{ borderRadius: 2 }}>
                        Devam →
                      </button>
                    </div>
                  )}

                  {step === 3 && (
                    <div>
                      <p className="text-[10px] font-medium text-ink-muted uppercase tracking-[0.15em] mb-4">Hazır. Odaklan.</p>
                      <div className="space-y-2 mb-8">
                        {morningTasks.filter(t => t.trim()).length === 0 ? (
                          <p className="text-sm text-ink-muted">Görev belirlenmedi.</p>
                        ) : morningTasks.filter(t => t.trim()).map((task, i) => (
                          <div key={i} className="flex items-center gap-3">
                            <div style={{ width: 14, height: 14, borderRadius: 2, border: '1px solid rgba(255,255,255,0.15)', flexShrink: 0 }} />
                            <span className="text-sm text-ink-primary">{task}</span>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => { closeModal(); navigate('/pomodoro') }}
                        className="w-full h-12 bg-primary-500 hover:bg-primary-600 text-white font-semibold transition-colors mb-3"
                        style={{ borderRadius: 2, fontSize: 15 }}
                      >
                        Pomodoro Başlat →
                      </button>
                      <button onClick={closeModal} className="w-full text-center text-xs text-ink-muted hover:text-white transition-colors py-1">
                        Kapat
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* ── GECE DEBRİEF ───────────────────────────────────────── */}
              {modal === 'evening' && (
                <>
                  {step === 1 && (
                    <div>
                      <p className="text-[10px] font-medium text-ink-muted uppercase tracking-[0.15em] mb-4">Bugün Ne Tamamlandı?</p>
                      <div className="space-y-4 mb-6" style={{ maxHeight: 320, overflowY: 'auto' }}>
                        {todayHabits.length > 0 && (
                          <div>
                            <p className="text-[10px] text-ink-muted uppercase tracking-[0.12em] mb-2">Alışkanlıklar</p>
                            {todayHabits.map(h => {
                              const done = d.todayLogs.some(l => l.habit_id === h.id)
                              return (
                                <div key={h.id} className="flex items-center gap-3 py-0.5">
                                  <div style={{ width: 14, height: 14, borderRadius: 2, border: done ? 'none' : '1px solid rgba(255,255,255,0.15)', background: done ? '#22C55E' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    {done && <span style={{ fontSize: 8, color: '#fff' }}>✓</span>}
                                  </div>
                                  <span className={`text-sm ${done ? 'text-ink-muted line-through' : 'text-ink-primary'}`}>{h.name}</span>
                                </div>
                              )
                            })}
                          </div>
                        )}
                        {d.todayTasks.length > 0 && (
                          <div>
                            <p className="text-[10px] text-ink-muted uppercase tracking-[0.12em] mb-2">Görevler</p>
                            {d.todayTasks.map(t => (
                              <div key={t.id} className="flex items-center gap-3 py-0.5">
                                <div style={{ width: 14, height: 14, borderRadius: 2, border: t.completed ? 'none' : '1px solid rgba(255,255,255,0.15)', background: t.completed ? '#22C55E' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  {t.completed && <span style={{ fontSize: 8, color: '#fff' }}>✓</span>}
                                </div>
                                <span className={`text-sm ${t.completed ? 'text-ink-muted line-through' : 'text-ink-primary'}`}>{t.title}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {todayHabits.length === 0 && d.todayTasks.length === 0 && (
                          <p className="text-sm text-ink-muted">Bugün için kayıtlı alışkanlık veya görev yok.</p>
                        )}
                      </div>
                      <button onClick={() => setStep(2)} className="w-full h-10 bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium transition-colors" style={{ borderRadius: 2 }}>
                        Devam →
                      </button>
                    </div>
                  )}

                  {step === 2 && (
                    <div>
                      <p className="text-[10px] font-medium text-ink-muted uppercase tracking-[0.15em] mb-4">Günlük Not</p>
                      <textarea
                        value={eveningNote}
                        onChange={e => setEveningNote(e.target.value)}
                        placeholder="Bugün ne öğrendim, ne hissettim?"
                        rows={6}
                        className="w-full bg-white/5 border border-border-subtle text-ink-primary text-sm px-3 py-2 focus:outline-none focus:border-border-glow resize-none placeholder:text-ink-muted/40 transition-colors mb-6"
                        style={{ borderRadius: 2 }}
                      />
                      <button
                        onClick={async () => { await saveJournalNote(); setStep(3) }}
                        className="w-full h-10 bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium transition-colors"
                        style={{ borderRadius: 2 }}
                      >
                        Devam →
                      </button>
                    </div>
                  )}

                  {step === 3 && (
                    <div>
                      <p className="text-[10px] font-medium text-ink-muted uppercase tracking-[0.15em] mb-4">Yarın İçin 3 Öncelik</p>
                      <div className="space-y-2 mb-6">
                        {tomorrowPriorities.map((task, i) => (
                          <div key={i} className="flex items-center gap-3">
                            <span className="text-xs font-bold text-ink-muted w-4 text-right shrink-0">{i + 1}.</span>
                            <input
                              type="text"
                              value={task}
                              onChange={e => { const n = [...tomorrowPriorities]; n[i] = e.target.value; setTomorrowPriorities(n) }}
                              placeholder="Yarın öncelik..."
                              className="flex-1 bg-white/5 border border-border-subtle text-ink-primary text-sm px-3 py-2 focus:outline-none focus:border-border-glow placeholder:text-ink-muted/40 transition-colors"
                              style={{ borderRadius: 2 }}
                            />
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={async () => { await saveTomorrowPlan(); closeModal() }}
                        className="w-full h-10 bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium transition-colors"
                        style={{ borderRadius: 2 }}
                      >
                        Tamamla
                      </button>
                    </div>
                  )}
                </>
              )}

            </div>
          </div>
        )}

    </div>
  )
}
// trigger
