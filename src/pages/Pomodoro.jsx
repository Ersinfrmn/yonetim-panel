import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Play, Pause, RotateCcw, Settings, X, Timer } from 'lucide-react'
import toast from 'react-hot-toast'

const MODES = [
  { key: 'work', label: 'Work', defaultMin: 25, color: 'text-red-500' },
  { key: 'short', label: 'Short Break', defaultMin: 5, color: 'text-green-500' },
  { key: 'long', label: 'Long Break', defaultMin: 15, color: 'text-blue-500' },
]

function pad(n) { return String(n).padStart(2, '0') }

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8)
    osc.start()
    osc.stop(ctx.currentTime + 0.8)
  } catch {}
}

export default function Pomodoro() {
  const { user } = useAuth()
  const [modeIdx, setModeIdx] = useState(0)
  const [durations, setDurations] = useState({ work: 25, short: 5, long: 15 })
  const [seconds, setSeconds] = useState(25 * 60)
  const [running, setRunning] = useState(false)
  const [sessions, setSessions] = useState(0)
  const [showSettings, setShowSettings] = useState(false)
  const [tempDur, setTempDur] = useState({ ...durations })
  const [sessionLog, setSessionLog] = useState([])
  const intervalRef = useRef(null)
  const startedAtRef = useRef(null)

  useEffect(() => {
    // Load today's sessions
    const today = new Date().toISOString().split('T')[0]
    supabase.from('pomodoro_sessions')
      .select('*')
      .eq('user_id', user.id)
      .gte('started_at', today + 'T00:00:00')
      .order('started_at', { ascending: false })
      .then(({ data }) => {
        setSessionLog(data || [])
        setSessions((data || []).filter(s => s.completed).length)
      })
  }, [])

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSeconds(s => {
          if (s <= 1) {
            clearInterval(intervalRef.current)
            setRunning(false)
            handleTimerEnd()
            return 0
          }
          return s - 1
        })
      }, 1000)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [running])

  async function handleTimerEnd() {
    playBeep()
    if (modeIdx === 0) {
      // work session completed
      const dur = durations.work
      const { data } = await supabase
        .from('pomodoro_sessions')
        .insert({ user_id: user.id, started_at: startedAtRef.current, duration_minutes: dur, completed: true })
        .select().single()
      if (data) setSessionLog(l => [data, ...l])
      setSessions(s => s + 1)
      toast.success(`Work session done! 🍅 Total: ${sessions + 1}`)
    } else {
      toast.success('Break over! Time to focus.')
    }
  }

  function start() {
    if (seconds === 0) return
    startedAtRef.current = new Date().toISOString()
    setRunning(true)
  }

  function pause() { setRunning(false) }

  function reset() {
    setRunning(false)
    const mode = MODES[modeIdx]
    setSeconds(durations[mode.key] * 60)
  }

  function switchMode(idx) {
    setRunning(false)
    setModeIdx(idx)
    setSeconds(durations[MODES[idx].key] * 60)
  }

  function applySettings() {
    setDurations(tempDur)
    setSeconds(tempDur[MODES[modeIdx].key] * 60)
    setRunning(false)
    setShowSettings(false)
  }

  const mode = MODES[modeIdx]
  const total = durations[mode.key] * 60
  const progress = total > 0 ? ((total - seconds) / total) * 100 : 0
  const radius = 80
  const circ = 2 * Math.PI * radius

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Pomodoro Timer</h2>
        <button
          onClick={() => setShowSettings(true)}
          className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
        >
          <Settings size={18} />
        </button>
      </div>

      {/* Mode selector */}
      <div className="flex gap-2 mb-8">
        {MODES.map((m, i) => (
          <button
            key={m.key}
            onClick={() => switchMode(i)}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
              modeIdx === i
                ? 'bg-primary-600 text-white'
                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Circular timer */}
      <div className="flex flex-col items-center mb-8">
        <div className="relative">
          <svg width="220" height="220" className="-rotate-90">
            <circle cx="110" cy="110" r={radius} fill="none" stroke="currentColor"
              className="text-slate-100 dark:text-slate-700" strokeWidth="8" />
            <circle cx="110" cy="110" r={radius} fill="none"
              stroke={modeIdx === 0 ? '#ef4444' : modeIdx === 1 ? '#22c55e' : '#3b82f6'}
              strokeWidth="8" strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={circ - (circ * progress / 100)}
              style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-bold font-mono text-slate-800 dark:text-white">
              {pad(Math.floor(seconds / 60))}:{pad(seconds % 60)}
            </span>
            <span className={`text-sm font-medium mt-1 ${mode.color}`}>{mode.label}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-6">
          <button
            onClick={reset}
            className="p-3 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            <RotateCcw size={20} />
          </button>
          <button
            onClick={running ? pause : start}
            className="px-8 py-3 rounded-full bg-primary-600 hover:bg-primary-700 text-white text-lg font-semibold flex items-center gap-2 transition-colors shadow-lg"
          >
            {running ? <><Pause size={22} /> Pause</> : <><Play size={22} /> Start</>}
          </button>
        </div>
      </div>

      {/* Session counter */}
      <div className="flex justify-center gap-2 mb-8">
        {Array.from({ length: Math.max(4, sessions + 1) }).map((_, i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-full ${
              i < sessions ? 'bg-red-400' : 'bg-slate-200 dark:bg-slate-700'
            }`}
          />
        ))}
        <span className="text-sm text-slate-500 dark:text-slate-400 ml-2">{sessions} sessions today</span>
      </div>

      {/* Session log */}
      {sessionLog.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-4">
          <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Today's Log</h3>
          <div className="space-y-2">
            {sessionLog.slice(0, 5).map((s, i) => (
              <div key={s.id || i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <Timer size={14} className="text-red-400" />
                  <span>{s.duration_minutes}min work session</span>
                </div>
                <span className="text-slate-400 text-xs">
                  {new Date(s.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Settings modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">Timer Settings</h3>
              <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X size={20} />
              </button>
            </div>
            {MODES.map(m => (
              <div key={m.key} className="flex items-center justify-between mb-3">
                <label className="text-sm text-slate-600 dark:text-slate-300">{m.label} (min)</label>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={tempDur[m.key]}
                  onChange={e => setTempDur(d => ({ ...d, [m.key]: Number(e.target.value) }))}
                  className="w-20 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            ))}
            <button
              onClick={applySettings}
              className="w-full mt-4 bg-primary-600 hover:bg-primary-700 text-white py-2.5 rounded-xl font-medium transition-colors"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
