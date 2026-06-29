import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  Play, Pause, RotateCcw, Settings, Volume2, ChevronDown, X,
} from 'lucide-react'
import { format } from 'date-fns'

// ── Constants ─────────────────────────────────────────────────────────────────

const SUGGESTIONS = [
  { emoji: '💧', text: 'Bir bardak dolu su iç' },
  { emoji: '👁️', text: '20 ayak uzağa 20 saniye bak (20-20-20 kuralı)' },
  { emoji: '🧘', text: 'Omuzlarını 5 kez döndür, boynunu gererek ger' },
  { emoji: '🚶', text: 'Ayağa kalk ve 1 dakika yürü' },
]

const AMBIENT_SOUNDS = [
  { key: 'none',     label: 'Hiçbiri',     url: null },
  { key: 'fire',     label: 'Ateş',        url: 'https://majgjnqcehxhcepchmta.supabase.co/storage/v1/object/public/ambient-sounds/campfire-02.wav' },
  { key: 'cafe',     label: 'Kafe',        url: 'https://majgjnqcehxhcepchmta.supabase.co/storage/v1/object/public/ambient-sounds/coffee-shop-ambience.mp3' },
  { key: 'rain',     label: 'Yağmur',     url: 'https://majgjnqcehxhcepchmta.supabase.co/storage/v1/object/public/ambient-sounds/heavy_rain_.mp3' },
  { key: 'wind',     label: 'Rüzgar',     url: 'https://majgjnqcehxhcepchmta.supabase.co/storage/v1/object/public/ambient-sounds/strong-wind.wav' },
  { key: 'nature',   label: 'Vahşi Doğa', url: 'https://majgjnqcehxhcepchmta.supabase.co/storage/v1/object/public/ambient-sounds/wild-nature.wav' },
  { key: 'mountain', label: 'Dağ Rüzgarı', url: 'https://majgjnqcehxhcepchmta.supabase.co/storage/v1/object/public/ambient-sounds/wind-in-mountain-1267.wav' },
]

const R    = 110
const CIRC = 2 * Math.PI * R

// ── Web Audio sound engine ────────────────────────────────────────────────────

function createSound(type, volume = 0.8) {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    const ctx      = new AudioContext()
    const gainNode = ctx.createGain()
    gainNode.gain.setValueAtTime(volume, ctx.currentTime)
    gainNode.connect(ctx.destination)

    switch (type) {
      case 'alarm': {
        ;[0, 0.3, 0.6, 0.9, 1.2, 1.5].forEach((time, i) => {
          const osc = ctx.createOscillator()
          osc.connect(gainNode)
          osc.frequency.setValueAtTime(i % 2 === 0 ? 880 : 660, ctx.currentTime + time)
          osc.start(ctx.currentTime + time)
          osc.stop(ctx.currentTime + time + 0.25)
        })
        break
      }
      case 'beep': {
        ;[0, 0.2, 0.4].forEach(time => {
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
        const osc     = ctx.createOscillator()
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
        ;[0, 0.15, 0.3, 0.45].forEach((time, i) => {
          const osc = ctx.createOscillator()
          osc.connect(gainNode)
          osc.type = 'sawtooth'
          osc.frequency.setValueAtTime(800 - i * 150, ctx.currentTime + time)
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

const p2   = n => String(n).padStart(2, '0')
const fmt  = s => `${p2(Math.floor(s / 60))}:${p2(s % 60)}`
const pick = (arr, n) => [...arr].sort(() => Math.random() - 0.5).slice(0, n)

// ── Shared card styles ────────────────────────────────────────────────────────

const CARD = {
  background:   'rgba(255,255,255,0.03)',
  border:       '1px solid rgba(255,255,255,0.06)',
  borderRadius: 4,
  padding:      16,
}

const SECTION_LABEL = {
  display:       'block',
  fontSize:      9,
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  color:         '#b91c1c',
  margin:        '0 0 10px',
}

const CTRL_BTN = {
  display:      'flex',
  alignItems:   'center',
  gap:          5,
  background:   'none',
  border:       '1px solid rgba(255,255,255,0.07)',
  borderRadius: 4,
  color:        '#555555',
  padding:      '6px 12px',
  fontSize:     11,
  cursor:       'pointer',
  fontFamily:   'inherit',
}

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
  const [cfg,     setCfg]     = useState(initCfg)
  const [draft,   setDraft]   = useState(initCfg)
  const [showCfg, setShowCfg] = useState(false)

  // Timer — phase: 'idle' | 'focus' | 'paused' | 'break' | 'cdown'
  const [phase,  setPhase]  = useState('idle')
  const [secs,   setSecs]   = useState(() => initCfg().focus * 60)
  const [total,  setTotal]  = useState(() => initCfg().focus * 60)
  const [pCount, setPCount] = useState(0)
  const [dayIdx, setDayIdx] = useState(1)

  // Countdown
  const [cdown,   setCdown]   = useState(null)
  const [cTarget, setCTarget] = useState(null)

  // UI
  const [suggestions,    setSuggestions]    = useState([])
  const [showTaskPicker, setShowTaskPicker] = useState(false)
  const [taskSearch,     setTaskSearch]     = useState('')

  // Linking
  const [tasks,      setTasks]      = useState([])
  const [linkedTask, setLinkedTask] = useState(null)

  // Today's sessions
  const [todaySessions, setTodaySessions] = useState([])

  // Ambient sound
  const [activeSoundKey,  setActiveSoundKey]  = useState('none')
  const [pendingSoundKey, setPendingSoundKey] = useState('none')
  const [ambientVolume,   setAmbientVolume]   = useState(0.5)
  const [showSoundModal,  setShowSoundModal]  = useState(false)
  const audioRef = useRef(null)

  // ── Refs (keep stale closures honest across intervals / timeouts) ──────────
  const intervalRef   = useRef(null)
  const sessionIdRef  = useRef(null)
  const onEndRef      = useRef(null)
  const phaseRef      = useRef('idle')
  const pCountRef     = useRef(0)
  const cfgRef        = useRef(cfg)
  const linkedTaskRef = useRef(null)
  const dayIdxRef     = useRef(1)

  phaseRef.current      = phase
  pCountRef.current     = pCount
  cfgRef.current        = cfg
  linkedTaskRef.current = linkedTask
  dayIdxRef.current     = dayIdx

  // ── Load tasks and today's session count ───────────────────────────────────

  useEffect(() => {
    const today = format(new Date(), 'yyyy-MM-dd')
    Promise.all([
      supabase.from('tasks').select('id,title,pomodoro_count')
        .eq('user_id', user.id).eq('completed', false)
        .order('created_at', { ascending: false }),
      supabase.from('pomodoro_sessions')
        .select('id', { count: 'exact' })
        .eq('user_id', user.id)
        .gte('started_at', `${today}T00:00:00`),
    ]).then(([{ data: t }, { count }]) => {
      setTasks(t || [])
      setDayIdx((count || 0) + 1)
    })
    loadTodaySessions()
  }, [user.id]) // eslint-disable-line

  async function loadTodaySessions() {
    const today = format(new Date(), 'yyyy-MM-dd')
    const { data } = await supabase
      .from('pomodoro_sessions').select('*')
      .eq('user_id', user.id).eq('was_completed', true)
      .gte('started_at', `${today}T00:00:00`)
      .order('started_at', { ascending: true })
    setTodaySessions(data || [])
  }

  // ── Timer tick ─────────────────────────────────────────────────────────────

  useEffect(() => {
    clearInterval(intervalRef.current)
    if (phase !== 'focus' && phase !== 'break') return

    intervalRef.current = setInterval(() => {
      setSecs(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current)
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
          completed_at:  new Date().toISOString(),
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

        loadTodaySessions()
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
      task_id:          linkedTaskRef.current?.id || null,
      habit_id:         null,
      started_at:       new Date().toISOString(),
      duration_minutes: cfgRef.current.focus,
      was_completed:    false,
      session_number:   dayIdxRef.current,
    }).select().single()
    sessionIdRef.current = data?.id
  }

  function beginBreak() {
    const isLong = pCountRef.current === 0
    const dur    = (isLong ? cfgRef.current.long : cfgRef.current.short) * 60
    setSecs(dur); setTotal(dur); setPhase('break')
  }

  function pauseFocus()  { clearInterval(intervalRef.current); setPhase('paused') }
  function resumeFocus() { setPhase('focus') }

  async function stopAll() {
    clearInterval(intervalRef.current)
    if (sessionIdRef.current) {
      await supabase.from('pomodoro_sessions').update({
        completed_at:  new Date().toISOString(),
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

  // ── Ambient audio ──────────────────────────────────────────────────────────

  useEffect(() => {
    const sound = AMBIENT_SOUNDS.find(s => s.key === activeSoundKey)
    if (!sound?.url) {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
      return
    }
    if (!audioRef.current || audioRef.current._key !== activeSoundKey) {
      if (audioRef.current) audioRef.current.pause()
      const audio  = new Audio(sound.url)
      audio.loop   = true
      audio.volume = ambientVolume
      audio._key   = activeSoundKey
      audioRef.current = audio
    }
    if (phase === 'focus') audioRef.current.play().catch(() => {})
    else                   audioRef.current.pause()
  }, [activeSoundKey, phase]) // eslint-disable-line

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = ambientVolume
  }, [ambientVolume])

  useEffect(() => () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
  }, [])

  // ── Derived ────────────────────────────────────────────────────────────────

  const progress   = total > 0 ? (total - secs) / total : 0
  const dashOffset = CIRC * (1 - progress)
  const isBreakish = phase === 'break' || (phase === 'cdown' && cTarget === 'focus')
  const ringColor  = isBreakish ? '#10b981' : '#b91c1c'

  const phaseLabel =
    phase === 'idle'                               ? 'HAZIR'         :
    phase === 'focus'                              ? 'ODAK'          :
    phase === 'paused'                             ? 'DURAKLATILDI'  :
    phase === 'break'                              ? (pCount === 0 ? 'UZUN MOLA' : 'KISA MOLA') :
    cTarget === 'break'                            ? 'MOLA BAŞLIYOR' : 'ODAK BAŞLIYOR'

  const showSuggest = suggestions.length > 0 &&
    (phase === 'break' || (phase === 'cdown' && cTarget === 'focus') ||
     (phase === 'cdown' && cTarget === 'break'))

  const filteredTasks = tasks
    .filter(t => t.title.toLowerCase().includes(taskSearch.toLowerCase()))
    .slice(0, 7)

  const todayMinutes = todaySessions.reduce((acc, s) => acc + (s.duration_minutes || 0), 0)
  const activeSound  = AMBIENT_SOUNDS.find(s => s.key === activeSoundKey) ?? AMBIENT_SOUNDS[0]

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start', flexWrap: 'wrap' }}>

        {/* ── Main / center area ────────────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 280, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

          {/* Page title */}
          <div style={{ width: '100%', marginBottom: 24 }}>
            <h2 className="text-2xl font-bold tracking-widest uppercase text-ink-primary">Pomodoro</h2>
          </div>

          {/* Task selector */}
          <div style={{ width: '100%', marginBottom: 28, position: 'relative' }}>
            <button
              onClick={() => setShowTaskPicker(v => !v)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4,
                color: linkedTask ? '#ffffff' : '#555555', fontSize: 13,
                cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {linkedTask ? `📌 ${linkedTask.title}` : 'Lütfen bir görev seçin...'}
              </span>
              {linkedTask
                ? <X size={14} style={{ color: '#555', flexShrink: 0, marginLeft: 8 }}
                    onClick={e => { e.stopPropagation(); setLinkedTask(null) }} />
                : <ChevronDown size={14} style={{ color: '#555', flexShrink: 0, marginLeft: 8 }} />
              }
            </button>

            {showTaskPicker && (
              <div style={{
                position: 'absolute', zIndex: 20, top: 'calc(100% + 4px)', left: 0, right: 0,
                background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 4, overflow: 'hidden',
              }}>
                <div style={{ padding: '8px 8px 4px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <input
                    autoFocus
                    placeholder="Görev ara..."
                    value={taskSearch}
                    onChange={e => setTaskSearch(e.target.value)}
                    style={{
                      width: '100%', padding: '6px 10px', background: 'rgba(255,255,255,0.04)',
                      border: 'none', borderRadius: 3, color: '#ffffff', fontSize: 12,
                      fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                  {filteredTasks.length === 0
                    ? <p style={{ fontSize: 11, color: '#444', textAlign: 'center', padding: 16, margin: 0 }}>
                        Görev bulunamadı
                      </p>
                    : filteredTasks.map(t => (
                        <button key={t.id}
                          onClick={() => { setLinkedTask(t); setShowTaskPicker(false); setTaskSearch('') }}
                          style={{
                            width: '100%', textAlign: 'left', padding: '9px 14px', background: 'none',
                            border: 'none', color: '#cccccc', fontSize: 13, cursor: 'pointer',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            fontFamily: 'inherit',
                          }}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                          {(t.pomodoro_count || 0) > 0 && (
                            <span style={{ fontSize: 10, color: '#555', marginLeft: 8, flexShrink: 0 }}>
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

          {/* Timer ring */}
          <div className="relative" style={{ width: 260, height: 260 }}>
            <svg width="260" height="260" viewBox="0 0 260 260" className="absolute inset-0">
              <circle cx="130" cy="130" r={R} fill="none"
                stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
              <circle cx="130" cy="130" r={R} fill="none"
                stroke={ringColor} strokeWidth="12" strokeLinecap="round"
                strokeDasharray={CIRC} strokeDashoffset={dashOffset}
                transform="rotate(-90 130 130)"
                style={{ transition: 'stroke-dashoffset 0.6s linear, stroke 0.5s ease' }}
              />
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
              <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.2em', color: '#b91c1c', marginBottom: 4, fontWeight: 700 }}>
                {phaseLabel}
              </span>
              {phase === 'cdown'
                ? <span className="text-8xl font-bold text-ink-primary tabular-nums leading-none">{cdown}</span>
                : <span className="text-7xl font-bold text-ink-primary tabular-nums leading-none tracking-tight">
                    {fmt(secs)}
                  </span>
              }
              <span style={{ fontSize: 12, color: '#444444', marginTop: 8 }}>
                {phase === 'idle'                           && `${cfg.focus} dk odak`}
                {(phase === 'focus' || phase === 'paused') && `🍅 ${pCount + 1} / 4`}
                {phase === 'break'                          && (pCount === 0 ? 'uzun mola' : 'kısa mola')}
              </span>
            </div>
          </div>

          {/* Break suggestions */}
          {showSuggest && (
            <div style={{ width: '100%', marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {suggestions.map((s, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: 12,
                  background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)',
                  borderRadius: 4, animation: 'pomFadeIn 0.4s ease both', animationDelay: `${i * 80}ms`,
                }}>
                  <span style={{ fontSize: 24, flexShrink: 0 }}>{s.emoji}</span>
                  <p style={{ fontSize: 13, color: '#10b981', margin: 0 }}>{s.text}</p>
                </div>
              ))}
            </div>
          )}

          {/* Primary action button */}
          <div style={{ width: '100%', marginTop: 24, display: 'flex', gap: 8, justifyContent: 'center' }}>
            {phase === 'idle' && (
              <button onClick={beginFocus} style={{
                flex: 1, maxWidth: 260, padding: '14px 24px',
                background: '#b91c1c', border: 'none', borderRadius: 4,
                color: '#ffffff', fontSize: 13, fontWeight: 700, letterSpacing: '0.12em',
                textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                <Play size={15} fill="currentColor" /> BAŞLA
              </button>
            )}
            {phase === 'focus' && (<>
              <button onClick={pauseFocus} style={{
                flex: 1, maxWidth: 200, padding: '14px 24px',
                background: '#b91c1c', border: 'none', borderRadius: 4,
                color: '#ffffff', fontSize: 13, fontWeight: 700, letterSpacing: '0.12em',
                textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                <Pause size={15} /> DURAKLAT
              </button>
              <button onClick={stopAll} style={{
                padding: '14px', background: 'none', border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 4, color: '#444444', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <RotateCcw size={15} />
              </button>
            </>)}
            {phase === 'paused' && (<>
              <button onClick={resumeFocus} style={{
                flex: 1, maxWidth: 200, padding: '14px 24px',
                background: '#b91c1c', border: 'none', borderRadius: 4,
                color: '#ffffff', fontSize: 13, fontWeight: 700, letterSpacing: '0.12em',
                textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                <Play size={15} fill="currentColor" /> DEVAM ET
              </button>
              <button onClick={stopAll} style={{
                padding: '14px', background: 'none', border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 4, color: '#444444', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <RotateCcw size={15} />
              </button>
            </>)}
            {phase === 'break' && (
              <button onClick={skipBreak} style={{
                flex: 1, maxWidth: 260, padding: '14px 24px',
                background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)',
                borderRadius: 4, color: '#10b981', fontSize: 13, fontWeight: 700,
                letterSpacing: '0.12em', textTransform: 'uppercase',
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
                Molayı Bitir
              </button>
            )}
            {phase === 'cdown' && (
              <button disabled style={{
                flex: 1, maxWidth: 260, padding: '14px 24px',
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 4, color: '#333333', fontSize: 13, fontWeight: 700,
                letterSpacing: '0.12em', textTransform: 'uppercase',
                cursor: 'not-allowed', fontFamily: 'inherit',
              }}>
                {cTarget === 'break' ? 'Mola Başlıyor' : 'Odak Başlıyor'}
              </button>
            )}
          </div>

          {/* Two small controls */}
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button
              onClick={() => { setDraft({ ...cfg }); setShowCfg(true) }}
              style={CTRL_BTN}
            >
              <Settings size={12} /> Zamanlayıcı Türü
            </button>
            <button
              onClick={() => { setPendingSoundKey(activeSoundKey); setShowSoundModal(true) }}
              style={{
                ...CTRL_BTN,
                color:       activeSoundKey !== 'none' ? '#b91c1c' : '#555555',
                borderColor: activeSoundKey !== 'none' ? 'rgba(185,28,28,0.3)' : 'rgba(255,255,255,0.07)',
              }}
            >
              <Volume2 size={12} />
              {activeSoundKey !== 'none' ? activeSound.label : 'Arka Plan Sesi'}
            </button>
          </div>

        </div>

        {/* ── Right panel ───────────────────────────────────────────────── */}
        <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Bugünün Odaklanma Süresi */}
          <div style={CARD}>
            <span style={SECTION_LABEL}>Bugünün Odaklanma Süresi</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 48, fontWeight: 700, color: '#b91c1c', lineHeight: 1 }}>
                {todayMinutes}
              </span>
              <span style={{ fontSize: 11, color: '#444444', letterSpacing: '0.1em' }}>DAKİKA</span>
            </div>
          </div>

          {/* Bugün */}
          <div style={CARD}>
            <span style={SECTION_LABEL}>Bugün</span>
            {linkedTask
              ? <p style={{ fontSize: 13, color: '#cccccc', margin: 0, lineHeight: 1.5 }}>
                  {linkedTask.title}
                </p>
              : <p style={{ fontSize: 12, color: '#2a2a2a', margin: 0, textAlign: 'center', padding: '4px 0' }}>
                  Görev Yok
                </p>
            }
          </div>

          {/* Bugünün Odaklanma Süresi Kayıtları */}
          <div style={CARD}>
            <span style={SECTION_LABEL}>Bugünün Odaklanma Süresi Kayıtları</span>
            {todaySessions.length === 0
              ? <p style={{ fontSize: 11, color: '#2a2a2a', margin: 0, textAlign: 'center', padding: '8px 0' }}>
                  Henüz kayıt yok
                </p>
              : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {todaySessions.map((s, i) => (
                    <div key={s.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '7px 0',
                      borderBottom: i < todaySessions.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    }}>
                      <span style={{ fontSize: 10, color: '#3a3a3a', fontWeight: 700, letterSpacing: '0.05em', minWidth: 20 }}>
                        #{i + 1}
                      </span>
                      <span style={{ fontSize: 12, color: '#888888' }}>
                        {s.completed_at ? format(new Date(s.completed_at), 'HH:mm') : '—'}
                      </span>
                      <span style={{ fontSize: 11, color: '#555555' }}>
                        {s.duration_minutes} dk
                      </span>
                    </div>
                  ))}
                </div>
              )
            }
          </div>

        </div>

      </div>

      {/* ── Settings modal ─────────────────────────────────────────────── */}
      {showCfg && (
        <div
          onClick={e => e.target === e.currentTarget && setShowCfg(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}
        >
          <div style={{
            background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 4, padding: 24, width: '100%', maxWidth: 400, position: 'relative',
          }}>
            <button onClick={() => setShowCfg(false)} style={{
              position: 'absolute', top: 16, right: 16,
              background: 'none', border: 'none', color: '#444444', cursor: 'pointer', padding: 0,
            }}>
              <X size={18} />
            </button>

            <p style={{ fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#444444', margin: '0 0 20px' }}>
              ZAMANLAYICI TÜRÜ
            </p>

            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              {[
                { k: 'focus', l: 'Odak (dk)' },
                { k: 'short', l: 'Kısa Mola' },
                { k: 'long',  l: 'Uzun Mola' },
              ].map(({ k, l }) => (
                <div key={k} style={{ flex: 1 }}>
                  <label style={{ fontSize: 10, color: '#555555', display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}>
                    {l}
                  </label>
                  <input type="number" min={1} max={99} value={draft[k]}
                    onChange={e => setDraft(d => ({ ...d, [k]: parseInt(e.target.value) || 1 }))}
                    style={{
                      width: '100%', padding: '8px', borderRadius: 4,
                      border: '1px solid rgba(255,255,255,0.08)',
                      background: '#111111', color: '#ffffff', fontSize: 14,
                      textAlign: 'center', fontFamily: 'inherit', outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              ))}
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16, marginBottom: 20 }}>
              <p style={{ fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#444444', margin: '0 0 12px' }}>
                Ses Ayarları
              </p>

              <p style={{ fontSize: 11, color: '#555555', margin: '0 0 8px' }}>Ses Türü</p>
              <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                {[
                  { value: 'alarm',   label: 'Alarm'   },
                  { value: 'beep',    label: 'Bip'     },
                  { value: 'zen',     label: 'Zen'     },
                  { value: 'digital', label: 'Dijital' },
                ].map(({ value, label }) => {
                  const active = draft.soundType === value
                  return (
                    <button key={value}
                      onClick={() => setDraft(d => ({ ...d, soundType: value }))}
                      style={{
                        flex: 1, padding: '6px 0', fontSize: 11, cursor: 'pointer',
                        borderRadius: 4,
                        border: active ? '1px solid #b91c1c' : '1px solid rgba(255,255,255,0.08)',
                        background: active ? 'rgba(185,28,28,0.15)' : 'transparent',
                        color: active ? '#ffffff' : '#888888',
                        fontFamily: 'inherit', transition: 'all 150ms',
                      }}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: '#555555' }}>Ses Seviyesi</span>
                <span style={{ fontSize: 11, color: '#888888' }}>{Math.round(draft.soundVolume * 100)}%</span>
              </div>
              <input type="range" min={0.1} max={1.0} step={0.1}
                value={draft.soundVolume}
                onChange={e => setDraft(d => ({ ...d, soundVolume: parseFloat(e.target.value) }))}
                style={{ width: '100%', accentColor: '#b91c1c' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowCfg(false)} style={{
                flex: 1, padding: '8px 0', background: 'none',
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4,
                color: '#888888', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
              }}>
                İptal
              </button>
              <button onClick={saveCfg} style={{
                flex: 2, padding: '8px 0', background: '#b91c1c', border: 'none',
                borderRadius: 4, color: '#ffffff', fontSize: 11, fontWeight: 700,
                letterSpacing: '0.1em', cursor: 'pointer', fontFamily: 'inherit',
              }}>
                KAYDET
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Ambient sound modal ────────────────────────────────────────── */}
      {showSoundModal && (
        <div
          onClick={e => e.target === e.currentTarget && setShowSoundModal(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}
        >
          <div style={{
            background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 4, padding: 24, width: '100%', maxWidth: 360, position: 'relative',
          }}>
            <button onClick={() => setShowSoundModal(false)} style={{
              position: 'absolute', top: 16, right: 16,
              background: 'none', border: 'none', color: '#444444', cursor: 'pointer', padding: 0,
            }}>
              <X size={18} />
            </button>

            <p style={{ fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#444444', margin: '0 0 20px' }}>
              ARKA PLAN SESİ
            </p>

            {/* Volume slider */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: '#666666', letterSpacing: '0.05em' }}>Ses Seviyesi</span>
                <span style={{ fontSize: 11, color: '#888888' }}>{Math.round(ambientVolume * 100)}%</span>
              </div>
              <input type="range" min={0} max={1} step={0.05}
                value={ambientVolume}
                onChange={e => setAmbientVolume(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: '#b91c1c' }}
              />
            </div>

            {/* Sound list */}
            <div style={{
              display: 'flex', flexDirection: 'column', marginBottom: 20,
              border: '1px solid rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden',
            }}>
              {AMBIENT_SOUNDS.map((s, i) => {
                const selected = pendingSoundKey === s.key
                return (
                  <button key={s.key}
                    onClick={() => setPendingSoundKey(s.key)}
                    style={{
                      padding: '12px 16px', background: 'none', border: 'none',
                      borderLeft: selected ? '2px solid #b91c1c' : '2px solid transparent',
                      borderBottom: i < AMBIENT_SOUNDS.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                      textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                      color: selected ? '#b91c1c' : '#888888',
                      fontSize: 13, transition: 'background 150ms',
                    }}
                    onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
                  >
                    {s.label}
                  </button>
                )
              })}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowSoundModal(false)} style={{
                flex: 1, padding: '8px 0', background: 'none',
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4,
                color: '#888888', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
              }}>
                İptal
              </button>
              <button
                onClick={() => { setActiveSoundKey(pendingSoundKey); setShowSoundModal(false) }}
                style={{
                  flex: 2, padding: '8px 0', background: '#b91c1c', border: 'none',
                  borderRadius: 4, color: '#ffffff', fontSize: 11, fontWeight: 700,
                  letterSpacing: '0.1em', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                ONAYLA
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pomFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: none; }
        }
      `}</style>
    </>
  )
}
