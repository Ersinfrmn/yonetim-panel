import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  Play, Pause, RotateCcw, Settings, Maximize2, Minimize2,
  ChevronDown, ChevronUp, X,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { format, subDays } from 'date-fns'
import { tr } from 'date-fns/locale'

// ── Constants ─────────────────────────────────────────────────────────────────

const SUGGESTIONS = [
  { emoji: '💧', text: 'Bir bardak dolu su iç' },
  { emoji: '👁️', text: '20 ayak uzağa 20 saniye bak (20-20-20 kuralı)' },
  { emoji: '🧘', text: 'Omuzlarını 5 kez döndür, boynunu gererek ger' },
  { emoji: '🚶', text: 'Ayağa kalk ve 1 dakika yürü' },
]

const R    = 110               // ring radius px
const CIRC = 2 * Math.PI * R  // circumference ≈ 691

// ── Web Audio sound engine ────────────────────────────────────────────────────

function createSound(type, volume = 0.8) {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    const ctx = new AudioContext()
    const gainNode = ctx.createGain()
    gainNode.gain.setValueAtTime(volume, ctx.currentTime)
    gainNode.connect(ctx.destination)

    switch (type) {
      case 'alarm': {
        [0, 0.3, 0.6, 0.9, 1.2, 1.5].forEach((time, i) => {
          const osc = ctx.createOscillator()
          osc.connect(gainNode)
          osc.frequency.setValueAtTime(i % 2 === 0 ? 880 : 660, ctx.currentTime + time)
          osc.start(ctx.currentTime + time)
          osc.stop(ctx.currentTime + time + 0.25)
        })
        break
      }
      case 'beep': {
        [0, 0.2, 0.4].forEach(time => {
          const osc = ctx.createOscillator()
          osc.connect(gainNode)
          osc.type = 'square'
          osc.frequency.setValueAtTime(1000, ctx.currentTime + time)
          osc.start(ctx.currentTime + time)
          osc.stop(ctx.currentTime + time + 0.15)
        })
        break
      }
      case 'zen': {
        const osc = ctx.createOscillator()
        const envGain = ctx.createGain()
        osc.connect(envGain)
        envGain.connect(ctx.destination)
        osc.type = 'sine'
        osc.frequency.setValueAtTime(528, ctx.currentTime)
        envGain.gain.setValueAtTime(0, ctx.currentTime)
        envGain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.1)
        envGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.5)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 2.5)
        break
      }
      case 'digital': {
        [0, 0.15, 0.3, 0.45].forEach((time, i) => {
          const osc = ctx.createOscillator()
          osc.connect(gainNode)
          osc.type = 'sawtooth'
          osc.frequency.setValueAtTime(800 - (i * 150), ctx.currentTime + time)
          osc.start(ctx.currentTime + time)
          osc.stop(ctx.currentTime + time + 0.12)
        })
        break
      }
      default: break
    }
    setTimeout(() => ctx.close(), 4000)
  } catch {}
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const p2  = n => String(n).padStart(2, '0')
const fmt = s => `${p2(Math.floor(s / 60))}:${p2(s % 60)}`
const pick = (arr, n) => [...arr].sort(() => Math.random() - 0.5).slice(0, n)

// ── Component ─────────────────────────────────────────────────────────────────

export default function Pomodoro() {
  const { user } = useAuth()

  // Settings — initialise from localStorage; fall back to defaults
  const initCfg = () => {
    try {
      const s = JSON.parse(localStorage.getItem('pomodoro_settings'))
      if (s && typeof s.focusDuration === 'number' &&
              typeof s.shortBreak    === 'number' &&
              typeof s.longBreak     === 'number')
        return {
          focus: s.focusDuration, short: s.shortBreak, long: s.longBreak,
          soundType: s.soundType || 'alarm', soundVolume: s.soundVolume ?? 0.8,
        }
    } catch {}
    return { focus: 25, short: 5, long: 15, soundType: 'alarm', soundVolume: 0.8 }
  }
  const [cfg, setCfg]         = useState(initCfg)
  const [draft, setDraft]     = useState(initCfg)
  const [showCfg, setShowCfg] = useState(false)

  // Timer — phase: 'idle' | 'focus' | 'paused' | 'break' | 'cdown'
  const [phase,  setPhase]  = useState('idle')
  const [secs,   setSecs]   = useState(() => initCfg().focus * 60)
  const [total,  setTotal]  = useState(() => initCfg().focus * 60)
  const [pCount, setPCount] = useState(0)   // 0-3, resets after 4th
  const [dayIdx, setDayIdx] = useState(1)   // session number today

  // Countdown
  const [cdown,   setCdown]   = useState(null)   // 3 / 2 / 1 / 0 / null
  const [cTarget, setCTarget] = useState(null)   // 'focus' | 'break'

  // UI
  const [focusMode,      setFocusMode]      = useState(false)
  const [suggestions,    setSuggestions]    = useState([])
  const [showTaskPicker, setShowTaskPicker] = useState(false)
  const [taskSearch,     setTaskSearch]     = useState('')

  // Linking
  const [tasks,       setTasks]       = useState([])
  const [habits,      setHabits]      = useState([])
  const [linkedTask,  setLinkedTask]  = useState(null)
  const [linkedHabit, setLinkedHabit] = useState(null)

  // Weekly report
  const [sessions,   setSessions]   = useState([])
  const [showReport, setShowReport] = useState(false)
  const [loadingRpt, setLoadingRpt] = useState(false)

  // ── Refs (keep stale closures honest across intervals / timeouts) ──────────
  const intervalRef     = useRef(null)
  const sessionIdRef    = useRef(null)
  const onEndRef        = useRef(null)
  const phaseRef        = useRef('idle')
  const pCountRef       = useRef(0)
  const cfgRef          = useRef(cfg)
  const linkedTaskRef   = useRef(null)
  const linkedHabitRef  = useRef(null)
  const dayIdxRef       = useRef(1)

  phaseRef.current       = phase
  pCountRef.current      = pCount
  cfgRef.current         = cfg
  linkedTaskRef.current  = linkedTask
  linkedHabitRef.current = linkedHabit
  dayIdxRef.current      = dayIdx

  // ── Load tasks, habits, today's session count ──────────────────────────────

  useEffect(() => {
    const today = format(new Date(), 'yyyy-MM-dd')
    Promise.all([
      supabase.from('tasks').select('id,title,pomodoro_count')
        .eq('user_id', user.id).eq('completed', false)
        .order('created_at', { ascending: false }),
      supabase.from('habits').select('id,name')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase.from('pomodoro_sessions')
        .select('id', { count: 'exact' })
        .eq('user_id', user.id)
        .gte('started_at', `${today}T00:00:00`),
    ]).then(([{ data: t }, { data: h }, { count }]) => {
      setTasks(t || [])
      setHabits(h || [])
      setDayIdx((count || 0) + 1)
    })
  }, [user.id])

  // ── Escape → exit focus mode ───────────────────────────────────────────────

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') setFocusMode(false) }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  // ── Timer tick ─────────────────────────────────────────────────────────────

  useEffect(() => {
    clearInterval(intervalRef.current)
    if (phase !== 'focus' && phase !== 'break') return

    intervalRef.current = setInterval(() => {
      setSecs(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current)
          // setTimeout keeps us off the setState stack; ref ensures fresh closure
          setTimeout(() => onEndRef.current?.(), 0)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(intervalRef.current)
  }, [phase])

  // ── Countdown tick ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (cdown === null) return
    if (cdown === 0) {
      // Effect re-ran with fresh cdown + cTarget → closures are current
      if (cTarget === 'break') beginBreak()
      else beginFocus()
      setCdown(null)
      setCTarget(null)
      return
    }
    const t = setTimeout(() => setCdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cdown, cTarget]) // eslint-disable-line

  // ── Phase-end handler (called from interval via ref) ───────────────────────

  // Reassigned every render so it always sees current state through refs
  onEndRef.current = async function onPhaseEnd() {
    const curPhase  = phaseRef.current
    const curPCount = pCountRef.current
    const curTask   = linkedTaskRef.current

    if (curPhase === 'focus') {
      createSound(cfgRef.current.soundType, cfgRef.current.soundVolume)

      const nextPCount = curPCount + 1
      const isLong     = nextPCount >= 4
      const newPCount  = isLong ? 0 : nextPCount

      setPCount(newPCount)
      setDayIdx(n => n + 1)
      setSuggestions(pick(SUGGESTIONS, isLong ? 2 : 1))

      if (sessionIdRef.current) {
        await supabase.from('pomodoro_sessions').update({
          completed_at: new Date().toISOString(),
          was_completed: true,
        }).eq('id', sessionIdRef.current)
        sessionIdRef.current = null

        if (curTask) {
          const newPomo = (curTask.pomodoro_count || 0) + 1
          await supabase.from('tasks')
            .update({ pomodoro_count: newPomo })
            .eq('id', curTask.id)
          setLinkedTask(t => t ? { ...t, pomodoro_count: newPomo } : t)
          setTasks(ts => ts.map(t =>
            t.id === curTask.id ? { ...t, pomodoro_count: newPomo } : t
          ))
        }

        // Silently refresh report data if panel is open
        loadSessions(true)
      }

      setPhase('cdown'); setCTarget('break'); setCdown(3)

    } else if (curPhase === 'break') {
      createSound(cfgRef.current.soundType, cfgRef.current.soundVolume)
      setPhase('cdown'); setCTarget('focus'); setCdown(3)
    }
  }

  // ── Phase starters ─────────────────────────────────────────────────────────

  async function beginFocus() {
    setSuggestions([])
    const dur = cfgRef.current.focus * 60
    setSecs(dur); setTotal(dur); setPhase('focus')

    const { data } = await supabase.from('pomodoro_sessions').insert({
      user_id:          user.id,
      task_id:          linkedTaskRef.current?.id  || null,
      habit_id:         linkedHabitRef.current?.id || null,
      started_at:       new Date().toISOString(),
      duration_minutes: cfgRef.current.focus,
      was_completed:    false,
      session_number:   dayIdxRef.current,
    }).select().single()
    sessionIdRef.current = data?.id
  }

  function beginBreak() {
    // pCountRef.current was already updated in onPhaseEnd before countdown started
    const isLong = pCountRef.current === 0
    const dur    = (isLong ? cfgRef.current.long : cfgRef.current.short) * 60
    setSecs(dur); setTotal(dur); setPhase('break')
  }

  function pauseFocus() { clearInterval(intervalRef.current); setPhase('paused') }
  function resumeFocus() { setPhase('focus') }

  async function stopAll() {
    clearInterval(intervalRef.current)
    if (sessionIdRef.current) {
      await supabase.from('pomodoro_sessions').update({
        completed_at: new Date().toISOString(),
        was_completed: false,
      }).eq('id', sessionIdRef.current)
      sessionIdRef.current = null
    }
    setPhase('idle'); setCdown(null); setSuggestions([])
    setSecs(cfg.focus * 60); setTotal(cfg.focus * 60)
  }

  function skipBreak() {
    clearInterval(intervalRef.current)
    setSuggestions([])
    setPhase('cdown'); setCTarget('focus'); setCdown(3)
  }

  // ── Settings ───────────────────────────────────────────────────────────────

  function saveCfg() {
    setCfg(draft)
    localStorage.setItem('pomodoro_settings', JSON.stringify({
      focusDuration: draft.focus,
      shortBreak:    draft.short,
      longBreak:     draft.long,
      soundType:     draft.soundType,
      soundVolume:   draft.soundVolume,
    }))
    if (phase === 'idle') { setSecs(draft.focus * 60); setTotal(draft.focus * 60) }
    setShowCfg(false)
  }

  // ── Weekly report ──────────────────────────────────────────────────────────

  async function loadSessions(silent = false) {
    if (!silent) setLoadingRpt(true)
    const from = format(subDays(new Date(), 6), 'yyyy-MM-dd')
    const { data } = await supabase
      .from('pomodoro_sessions').select('*')
      .eq('user_id', user.id)
      .gte('started_at', `${from}T00:00:00`)
      .order('started_at', { ascending: true })
    setSessions(data || [])
    if (!silent) setLoadingRpt(false)
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const progress   = total > 0 ? (total - secs) / total : 0
  const dashOffset = CIRC * (1 - progress)
  const isBreakish = phase === 'break' || (phase === 'cdown' && cTarget === 'focus')
  const ringColor  = isBreakish ? '#10b981' : '#6C3FE8'

  const phaseLabel =
    phase === 'idle'                               ? 'HAZIR' :
    phase === 'focus'                              ? 'ODAK' :
    phase === 'paused'                             ? 'DURAKLATILDI' :
    phase === 'break'                              ? (pCount === 0 ? 'UZUN MOLA' : 'KISA MOLA') :
    cTarget === 'break'                            ? 'MOLA BAŞLIYOR' : 'ODAK BAŞLIYOR'

  // Show suggestions during break AND countdown back to focus (so user has time to read)
  const showSuggest = suggestions.length > 0 &&
    (phase === 'break' || (phase === 'cdown' && cTarget === 'focus') ||
     (phase === 'cdown' && cTarget === 'break'))

  const filteredTasks = tasks
    .filter(t => t.title.toLowerCase().includes(taskSearch.toLowerCase()))
    .slice(0, 7)

  // Report chart data
  const chartData = Array.from({ length: 7 }, (_, i) => {
    const d  = subDays(new Date(), 6 - i)
    const ds = format(d, 'yyyy-MM-dd')
    return {
      day:   format(d, 'EEEEEE', { locale: tr }),
      count: sessions.filter(s => s.was_completed && s.started_at?.startsWith(ds)).length,
    }
  })

  const hourCounts = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    count: sessions.filter(s =>
      s.was_completed && s.completed_at &&
      new Date(s.completed_at).getHours() === h
    ).length,
  }))
  const maxH     = Math.max(...hourCounts.map(h => h.count), 1)
  const peakHour = hourCounts.reduce((a, b) => b.count > a.count ? b : a, hourCounts[0])
  const totalMin = sessions.filter(s => s.was_completed)
    .reduce((s, r) => s + (r.duration_minutes || 0), 0)
  const weekCount = sessions.filter(s => s.was_completed).length

  // ── Ring + inner content ───────────────────────────────────────────────────

  const ringJSX = (
    <div className="relative" style={{ width: 260, height: 260 }}>
      <svg width="260" height="260" viewBox="0 0 260 260" className="absolute inset-0">
        {/* Track */}
        <circle cx="130" cy="130" r={R} fill="none"
          stroke="rgba(255,255,255,0.06)" strokeWidth="12" />
        {/* Progress — rotate so origin = 12 o'clock */}
        <circle cx="130" cy="130" r={R} fill="none"
          stroke={ringColor} strokeWidth="12" strokeLinecap="round"
          strokeDasharray={CIRC} strokeDashoffset={dashOffset}
          transform="rotate(-90 130 130)"
          style={{ transition: 'stroke-dashoffset 0.6s linear, stroke 0.5s ease' }}
        />
        {/* Tick marks at 25 / 50 / 75 % */}
        {[0.25, 0.5, 0.75].map(pct => {
          const a = 2 * Math.PI * pct - Math.PI / 2
          return (
            <circle key={pct}
              cx={130 + R * Math.cos(a)} cy={130 + R * Math.sin(a)} r="3"
              fill={progress >= pct ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.12)'}
            />
          )
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center select-none">
        <span className="text-[10px] uppercase tracking-[0.2em] text-ink-muted mb-1 font-medium">
          {phaseLabel}
        </span>
        {phase === 'cdown'
          ? <span className="text-8xl font-bold text-ink-primary tabular-nums leading-none">{cdown}</span>
          : <span className="text-7xl font-bold text-ink-primary tabular-nums leading-none tracking-tight">
              {fmt(secs)}
            </span>
        }
        <span className="text-xs text-ink-muted mt-2">
          {phase === 'idle'                    && `${cfg.focus} dk odak`}
          {(phase === 'focus' || phase === 'paused') && `🍅 ${pCount + 1} / 4`}
          {phase === 'break'                   && (pCount === 0 ? 'uzun mola' : 'kısa mola')}
        </span>
      </div>
    </div>
  )

  const controlsJSX = (
    <div className="flex items-center gap-3 mt-3">
      {phase === 'idle' && (
        <button onClick={beginFocus}
          className="flex items-center gap-2 px-9 py-3 bg-primary-500 hover:bg-primary-600 active:scale-95 text-white rounded-2xl text-sm font-semibold transition-all">
          <Play size={16} fill="currentColor" /> Başla
        </button>
      )}
      {phase === 'focus' && (<>
        <button onClick={pauseFocus}
          className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/15 active:scale-95 text-white rounded-2xl text-sm font-medium transition-all">
          <Pause size={15} /> Duraklat
        </button>
        <button onClick={stopAll} className="p-3 text-ink-muted hover:text-status-error transition-colors">
          <RotateCcw size={15} />
        </button>
      </>)}
      {phase === 'paused' && (<>
        <button onClick={resumeFocus}
          className="flex items-center gap-2 px-6 py-3 bg-primary-500 hover:bg-primary-600 active:scale-95 text-white rounded-2xl text-sm font-medium transition-all">
          <Play size={15} fill="currentColor" /> Devam
        </button>
        <button onClick={stopAll} className="p-3 text-ink-muted hover:text-status-error transition-colors">
          <RotateCcw size={15} />
        </button>
      </>)}
      {phase === 'break' && (
        <button onClick={skipBreak}
          className="flex items-center gap-2 px-6 py-3 bg-emerald-700 hover:bg-emerald-600 active:scale-95 text-white rounded-2xl text-sm font-medium transition-all">
          Molayı Bitir
        </button>
      )}
    </div>
  )

  // ── Focus Mode overlay (full screen) ───────────────────────────────────────

  if (focusMode) {
    return (
      <div className="fixed inset-0 z-50 bg-surface flex flex-col items-center justify-center">
        <button onClick={() => setFocusMode(false)}
          className="absolute top-5 right-5 p-2 text-ink-muted hover:text-ink-primary transition-colors rounded-lg">
          <Minimize2 size={20} />
        </button>
        {linkedTask && (
          <p className="text-ink-muted text-xs mb-6 px-4 py-1.5 bg-surface-card/60 rounded-full max-w-xs truncate">
            📌 {linkedTask.title}
          </p>
        )}
        {ringJSX}
        {controlsJSX}
        {showSuggest && (
          <div className="mt-8 flex flex-col gap-3 max-w-xs w-full px-4">
            {suggestions.map((s, i) => (
              <div key={i} className="flex items-center gap-4 p-4 bg-surface-card/80 backdrop-blur-md rounded-xl border border-border-subtle">
                <span className="text-3xl">{s.emoji}</span>
                <p className="text-sm text-ink-secondary">{s.text}</p>
              </div>
            ))}
          </div>
        )}
        <p className="absolute bottom-5 text-ink-muted text-xs">ESC — çık</p>
      </div>
    )
  }

  // ── Main layout ────────────────────────────────────────────────────────────

  return (
    <div className="max-w-lg mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-ink-primary">Pomodoro</h2>
        <div className="flex gap-1">
          <button
            onClick={() => { setDraft({ ...cfg }); setShowCfg(s => !s) }}
            className={`p-2 rounded-lg transition-colors ${showCfg
              ? 'bg-white/10 text-ink-primary'
              : 'text-ink-muted hover:text-ink-primary'}`}
          >
            <Settings size={18} />
          </button>
          <button
            onClick={() => setFocusMode(true)}
            className="p-2 text-ink-muted hover:text-ink-primary rounded-lg transition-colors"
          >
            <Maximize2 size={18} />
          </button>
        </div>
      </div>

      {/* Settings panel */}
      {showCfg && (
        <div className="mb-5 p-4 bg-surface-card/80 backdrop-blur-md border border-border-subtle rounded-xl hover:border-border-glow transition-colors duration-200">
          <p className="text-sm font-semibold text-ink-primary mb-3">Süre Ayarları</p>
          <div className="flex gap-3">
            {[
              { k: 'focus', l: 'Odak (dk)' },
              { k: 'short', l: 'Kısa Mola' },
              { k: 'long',  l: 'Uzun Mola' },
            ].map(({ k, l }) => (
              <div key={k} className="flex-1">
                <label className="text-xs text-ink-muted block mb-1">{l}</label>
                <input type="number" min={1} max={99} value={draft[k]}
                  onChange={e => setDraft(d => ({ ...d, [k]: parseInt(e.target.value) || 1 }))}
                  className="w-full px-3 py-2 rounded-xl border border-border-subtle bg-white/5 text-ink-primary text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={saveCfg}
              className="flex-1 bg-primary-500 hover:bg-primary-600 text-white py-2 rounded-xl text-sm font-medium transition-colors">
              Kaydet
            </button>
            <button onClick={() => setShowCfg(false)}
              className="px-4 py-2 rounded-xl border border-border-subtle text-ink-secondary text-sm transition-colors hover:bg-white/5">
              İptal
            </button>
          </div>
        </div>
      )}

      {/* ── Timer card ──────────────────────────────────────────────────────── */}
      <div className="mb-5 bg-surface-card/80 backdrop-blur-md border border-border-subtle rounded-xl py-8 px-6 flex flex-col items-center hover:border-border-glow transition-colors duration-200">
        {linkedTask && (
          <p className="text-ink-muted text-xs mb-4 px-3 py-1 bg-white/5 rounded-full max-w-[220px] truncate">
            📌 {linkedTask.title}
          </p>
        )}
        {ringJSX}
        {controlsJSX}
        <button onClick={() => setFocusMode(true)}
          className="mt-5 flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink-secondary transition-colors">
          <Maximize2 size={11} /> Odak Modu
        </button>
      </div>

      {/* ── Break suggestions ────────────────────────────────────────────────── */}
      {showSuggest && (
        <div className="mb-5 space-y-2">
          {suggestions.map((s, i) => (
            <div key={i}
              className="flex items-center gap-4 p-4 bg-status-success/10 border border-status-success/20 rounded-xl"
              style={{ animation: 'pomFadeIn 0.4s ease both', animationDelay: `${i * 80}ms` }}
            >
              <span className="text-3xl shrink-0">{s.emoji}</span>
              <p className="text-sm text-status-success font-medium">{s.text}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Task / Habit linking (only when not mid-session) ─────────────────── */}
      {(phase === 'idle' || phase === 'paused') && (
        <div className="mb-5 bg-surface-card/80 backdrop-blur-md border border-border-subtle rounded-xl hover:border-border-glow transition-colors duration-200 p-4">
          <p className="text-[11px] font-semibold text-ink-secondary uppercase tracking-widest mb-3">
            Bağlantı
          </p>

          {/* Task searchable dropdown */}
          <div className="mb-2 relative">
            <button
              onClick={() => setShowTaskPicker(v => !v)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-border-subtle bg-white/5 text-sm hover:bg-white/10 transition-colors"
            >
              <span className={linkedTask ? 'text-ink-primary' : 'text-ink-muted'}>
                {linkedTask ? `📌 ${linkedTask.title}` : 'Görev seç (opsiyonel)'}
              </span>
              {linkedTask
                ? <X size={14} className="text-ink-muted hover:text-status-error shrink-0"
                    onClick={e => { e.stopPropagation(); setLinkedTask(null) }} />
                : <ChevronDown size={14} className="text-ink-muted shrink-0" />
              }
            </button>

            {showTaskPicker && (
              <div className="absolute z-20 mt-1 w-full bg-surface-card border border-border-subtle rounded-xl overflow-hidden">
                <div className="p-2 border-b border-border-subtle">
                  <input
                    autoFocus
                    placeholder="Görev ara..."
                    value={taskSearch}
                    onChange={e => setTaskSearch(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-white/5 text-sm text-ink-primary placeholder-ink-muted focus:outline-none"
                  />
                </div>
                <div className="max-h-44 overflow-y-auto">
                  {filteredTasks.length === 0
                    ? <p className="text-xs text-ink-muted text-center py-4">Görev bulunamadı</p>
                    : filteredTasks.map(t => (
                        <button key={t.id}
                          onClick={() => { setLinkedTask(t); setShowTaskPicker(false); setTaskSearch('') }}
                          className="w-full text-left px-3 py-2 text-sm text-ink-primary hover:bg-white/5 flex items-center justify-between transition-colors"
                        >
                          <span className="truncate">{t.title}</span>
                          {(t.pomodoro_count || 0) > 0 && (
                            <span className="text-xs text-ink-muted ml-2 shrink-0">
                              🍅 {t.pomodoro_count}
                            </span>
                          )}
                        </button>
                      ))
                  }
                </div>
              </div>
            )}
          </div>

          {/* Habit select */}
          <select
            value={linkedHabit?.id || ''}
            onChange={e => setLinkedHabit(habits.find(h => h.id === e.target.value) || null)}
            className="w-full px-3 py-2.5 rounded-xl border border-border-subtle bg-white/5 text-sm text-ink-secondary focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Alışkanlık seç (opsiyonel)</option>
            {habits.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        </div>
      )}

      {/* ── Weekly report (collapsible) ──────────────────────────────────────── */}
      <div className="bg-surface-card/80 backdrop-blur-md border border-border-subtle rounded-xl hover:border-border-glow transition-colors duration-200 overflow-hidden">
        <button
          onClick={() => {
            const next = !showReport
            setShowReport(next)
            if (next && sessions.length === 0) loadSessions()
          }}
          className="w-full flex items-center justify-between px-4 py-3.5 text-sm font-semibold text-ink-primary hover:bg-white/5 transition-colors"
        >
          <span>📊 Bu Haftanın Odak Özeti</span>
          {showReport ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showReport && (
          <div className="border-t border-border-subtle px-4 pb-5">
            {loadingRpt ? (
              <div className="flex justify-center py-10">
                <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (<>

              {/* Stat cards */}
              <div className="grid grid-cols-3 gap-3 pt-4 mb-5">
                {[
                  { label: 'Pomodoro', value: String(weekCount) },
                  { label: 'Odak Süresi', value: `${Math.floor(totalMin / 60)}s ${totalMin % 60}dk` },
                  { label: 'Zirve Saat', value: peakHour.count > 0 ? `${p2(peakHour.hour)}:00` : '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-white/5 rounded-xl p-3 text-center">
                    <p className="text-[10px] text-ink-muted mb-0.5">{label}</p>
                    <p className="text-base font-bold text-ink-primary leading-tight">{value}</p>
                  </div>
                ))}
              </div>

              {/* Bar chart — daily pomodoros */}
              <div className="mb-5">
                <p className="text-xs text-ink-muted mb-2">Günlük Pomodoro</p>
                <ResponsiveContainer width="100%" height={90}>
                  <BarChart data={chartData} margin={{ top: 0, right: 0, left: -28, bottom: 0 }}>
                    <XAxis dataKey="day"
                      tick={{ fontSize: 11, fill: '#6B6B8A' }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#6B6B8A' }} axisLine={false} tickLine={false}
                      allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: '#111128', border: 'none', borderRadius: 8, fontSize: 12 }}
                      itemStyle={{ color: '#F0F0FF' }}
                      labelStyle={{ color: '#6B6B8A' }}
                      formatter={v => [v, 'Pomodoro']}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {chartData.map((_, i) => (
                        <Cell key={i} fill={i === 6 ? '#6C3FE8' : 'rgba(108,63,232,0.2)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Hour heatmap */}
              <div>
                <p className="text-xs text-ink-muted mb-2">Saat Yoğunluğu (0–23)</p>
                <div className="flex gap-0.5">
                  {hourCounts.map(({ hour, count }) => (
                    <div key={hour} className="flex-1 group relative">
                      <div
                        className="h-5 rounded-sm"
                        style={{
                          backgroundColor: count === 0
                            ? 'rgba(255,255,255,0.03)'
                            : `rgba(108,63,232,${0.15 + (count / maxH) * 0.8})`,
                          transition: 'background-color 0.2s',
                        }}
                      />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10 bg-surface-card text-ink-primary text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap pointer-events-none">
                        {p2(hour)}:00 · {count}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-[10px] text-ink-muted mt-1 px-0.5">
                  <span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
                </div>
              </div>

            </>)}
          </div>
        )}
      </div>

      {/* Suggestion fade-in keyframe */}
      <style>{`
        @keyframes pomFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: none; }
        }
      `}</style>
    </div>
  )
}
