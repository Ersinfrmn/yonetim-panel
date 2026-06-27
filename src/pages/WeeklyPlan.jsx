// SQL to run once in Supabase:
// create table weekly_plans (
//   id uuid default gen_random_uuid() primary key,
//   user_id uuid references auth.users(id) on delete cascade,
//   week_start date not null,
//   focus_1 text, focus_2 text, focus_3 text,
//   day_tasks jsonb default '{"mon":[],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
//   review_good text, review_next text,
//   created_at timestamptz default now(),
//   unique(user_id, week_start)
// );
// alter table weekly_plans enable row level security;
// create policy "own" on weekly_plans for all using (auth.uid() = user_id);

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { format, startOfWeek, endOfWeek, addWeeks, addDays } from 'date-fns'
import { tr } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────

const fmt = d => format(d, 'yyyy-MM-dd')

const DAY_KEYS   = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const DAY_LABELS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cts', 'Paz']
const EMPTY_DAYS = { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] }

function weekOf(date) {
  return startOfWeek(date, { weekStartsOn: 1 })
}

// ─── Reusable input style ─────────────────────────────────────────────────────

const inputCls = 'bg-white/5 border border-border-subtle text-ink-primary text-sm px-3 py-2 focus:outline-none focus:border-border-glow placeholder:text-ink-muted/40 transition-colors'

// ─── Label style ──────────────────────────────────────────────────────────────

const sectionLabel = 'text-[10px] font-medium text-ink-muted uppercase tracking-[0.15em] mb-4'

// ─── Component ────────────────────────────────────────────────────────────────

export default function WeeklyPlan() {
  const { user } = useAuth()

  const [weekDate,    setWeekDate]    = useState(() => weekOf(new Date()))
  const [plan,        setPlan]        = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [focuses,     setFocuses]     = useState(['', '', ''])
  const [dayTasks,    setDayTasks]    = useState(EMPTY_DAYS)
  const [addText,     setAddText]     = useState({})   // { mon: '', tue: '', ... }
  const [reviewGood,  setReviewGood]  = useState('')
  const [reviewNext,  setReviewNext]  = useState('')

  const weekStart    = weekOf(weekDate)
  const weekEnd      = endOfWeek(weekDate, { weekStartsOn: 1 })
  const weekStartStr = fmt(weekStart)

  const thisWeekStr  = fmt(weekOf(new Date()))
  const isThisWeek   = weekStartStr === thisWeekStr
  const isPastWeek   = weekStartStr < thisWeekStr

  // Today's column index (0=Mon … 6=Sun), only relevant for current week
  const todayColIdx = (() => {
    if (!isThisWeek) return -1
    const dow = new Date().getDay()  // 0=Sun
    return dow === 0 ? 6 : dow - 1
  })()

  // ── Load plan for the current weekStart ─────────────────────────────────────

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('weekly_plans')
        .select('*')
        .eq('user_id', user.id)
        .eq('week_start', weekStartStr)
        .maybeSingle()

      if (cancelled) return

      if (data) {
        setPlan(data)
        setFocuses([data.focus_1 || '', data.focus_2 || '', data.focus_3 || ''])
        setDayTasks(data.day_tasks || EMPTY_DAYS)
        setReviewGood(data.review_good || '')
        setReviewNext(data.review_next || '')
      } else {
        setPlan(null)
        setFocuses(['', '', ''])
        setDayTasks(EMPTY_DAYS)
        setReviewGood('')
        setReviewNext('')
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [weekStartStr]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Persist ─────────────────────────────────────────────────────────────────

  async function persist(patch = {}) {
    const { data } = await supabase
      .from('weekly_plans')
      .upsert(
        {
          user_id:     user.id,
          week_start:  weekStartStr,
          focus_1:     focuses[0],
          focus_2:     focuses[1],
          focus_3:     focuses[2],
          day_tasks:   dayTasks,
          review_good: reviewGood,
          review_next: reviewNext,
          ...patch,
        },
        { onConflict: 'user_id,week_start' }
      )
      .select()
      .maybeSingle()
    if (data) setPlan(data)
  }

  // ── Focuses ─────────────────────────────────────────────────────────────────

  function handleFocusBlur(i, value) {
    const f = [...focuses]
    f[i] = value
    setFocuses(f)
    persist({ focus_1: f[0], focus_2: f[1], focus_3: f[2] })
  }

  // ── Day tasks ────────────────────────────────────────────────────────────────

  function flushDayTasks(next) {
    setDayTasks(next)
    persist({ day_tasks: next })
  }

  function addTask(key) {
    const text = (addText[key] || '').trim()
    if (!text) return
    const next = { ...dayTasks, [key]: [...(dayTasks[key] || []), { text, done: false }] }
    setAddText(t => ({ ...t, [key]: '' }))
    flushDayTasks(next)
  }

  function toggleTask(key, idx) {
    const next = {
      ...dayTasks,
      [key]: dayTasks[key].map((t, i) => i === idx ? { ...t, done: !t.done } : t),
    }
    flushDayTasks(next)
  }

  function removeTask(key, idx) {
    const next = { ...dayTasks, [key]: dayTasks[key].filter((_, i) => i !== idx) }
    flushDayTasks(next)
  }

  // ── Review ───────────────────────────────────────────────────────────────────

  function saveReviewGood(v)  { persist({ review_good: v }) }
  function saveReviewNext(v)  { persist({ review_next: v }) }

  // ── Week navigation ──────────────────────────────────────────────────────────

  function prevWeek() { setWeekDate(d => addWeeks(d, -1)) }
  function nextWeek() { setWeekDate(d => addWeeks(d, 1)) }

  // ── Week label ───────────────────────────────────────────────────────────────

  const weekLabel = (() => {
    const sd = format(weekStart, 'd')
    const sm = format(weekStart, 'MMM', { locale: tr }).toUpperCase().slice(0, 3)
    const ed = format(weekEnd,   'd')
    const em = format(weekEnd,   'MMM', { locale: tr }).toUpperCase().slice(0, 3)
    const yr = format(weekEnd,   'yyyy')
    return sm === em ? `${sd}–${ed} ${em} ${yr}` : `${sd} ${sm} – ${ed} ${em} ${yr}`
  })()

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ background: 'transparent' }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold tracking-widest uppercase text-ink-primary">Haftalık Plan</h2>

        <div className="flex items-center gap-1">
          <button
            onClick={prevWeek}
            className="p-1.5 text-ink-muted hover:text-white hover:bg-white/5 transition-colors"
            style={{ borderRadius: 2 }}
          >
            <ChevronLeft size={16} />
          </button>
          <span
            className="text-base font-bold px-3 py-1 text-center"
            style={{
              minWidth: 150,
              color: isThisWeek ? '#ffffff' : '#888888',
              border: isThisWeek ? '1px solid rgba(185,28,28,0.4)' : '1px solid transparent',
              borderRadius: 2,
            }}
          >
            {weekLabel}
          </span>
          <button
            onClick={nextWeek}
            className="p-1.5 text-ink-muted hover:text-white hover:bg-white/5 transition-colors"
            style={{ borderRadius: 2 }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">

          {/* ── 3 Focuses ─────────────────────────────────────────────────── */}
          <div className="bg-surface-card/80 border border-border-subtle p-5" style={{ borderRadius: 4 }}>
            <p className={sectionLabel}>Bu haftanın 3 odağı</p>
            <div className="space-y-2">
              {focuses.map((val, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-ink-muted w-4 text-right shrink-0">{i + 1}.</span>
                  <input
                    type="text"
                    defaultValue={val}
                    onBlur={e => handleFocusBlur(i, e.target.value)}
                    placeholder="Bu haftanın ana odağı..."
                    className="flex-1 bg-white/10 border-b-2 border-white/10 text-ink-primary text-sm px-3 py-2 focus:outline-none focus:border-primary-500 placeholder:uppercase placeholder:tracking-wider placeholder:text-white/30 transition-colors"
                    style={{ borderRadius: 2 }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* ── Day task grid ──────────────────────────────────────────────── */}
          <div className="bg-surface-card/80 border border-border-subtle p-5" style={{ borderRadius: 4 }}>
            <p className={sectionLabel}>Günlük Görev Dağılımı</p>
            <div style={{ overflowX: 'auto' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, minmax(100px, 1fr))',
                  gap: 8,
                  minWidth: 700,
                }}
              >
                {DAY_KEYS.map((key, i) => {
                  const isToday = i === todayColIdx
                  const tasks   = dayTasks[key] || []
                  const dayDate = addDays(weekStart, i)

                  return (
                    <div
                      key={key}
                      className="flex flex-col min-h-[140px]"
                      style={{
                        borderTop:   isToday ? '2px solid #b91c1c' : '2px solid transparent',
                        borderLeft:  '1px solid rgba(255,255,255,0.04)',
                        paddingLeft: 8,
                        paddingTop:  6,
                      }}
                    >
                      {/* Column header */}
                      <p className={`text-[10px] font-bold uppercase tracking-[0.1em] mb-0.5 ${isToday ? 'text-white' : 'text-ink-muted'}`}>
                        {DAY_LABELS[i]}
                      </p>
                      <p className={`text-[10px] mb-2 ${isToday ? 'text-ink-secondary' : 'text-ink-muted/50'}`}>
                        {format(dayDate, 'd')}
                      </p>

                      {/* Tasks */}
                      <div className="flex-1 space-y-1.5">
                        {tasks.map((task, idx) => (
                          <div key={idx} className="flex items-start gap-1.5 group">
                            <button
                              onClick={() => toggleTask(key, idx)}
                              className="mt-0.5 shrink-0 flex items-center justify-center transition-colors"
                              style={{
                                width: 12, height: 12, borderRadius: 2,
                                border:     task.done ? 'none' : '1px solid rgba(255,255,255,0.15)',
                                background: task.done ? '#444444' : 'transparent',
                                flexShrink: 0,
                              }}
                            >
                              {task.done && <span style={{ fontSize: 7, color: '#050505', lineHeight: 1 }}>✓</span>}
                            </button>
                            <span
                              className={`text-[10px] leading-tight flex-1 break-words ${
                                task.done ? 'text-ink-muted line-through' : 'text-ink-secondary'
                              }`}
                            >
                              {task.text}
                            </span>
                            <button
                              onClick={() => removeTask(key, idx)}
                              className="opacity-0 group-hover:opacity-100 text-ink-muted hover:text-white transition-opacity shrink-0"
                            >
                              <X size={9} />
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Add input */}
                      <input
                        type="text"
                        value={addText[key] || ''}
                        onChange={e => setAddText(t => ({ ...t, [key]: e.target.value }))}
                        onKeyDown={e => e.key === 'Enter' && addTask(key)}
                        onBlur={() => addTask(key)}
                        placeholder="+ Ekle"
                        className="w-full bg-transparent text-[10px] text-ink-muted placeholder:text-ink-muted/40 focus:outline-none focus:text-white py-1 mt-2"
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* ── Mini review — past weeks only ──────────────────────────────── */}
          {isPastWeek && (
            <div className="bg-surface-card/80 border border-border-subtle p-5" style={{ borderRadius: 4 }}>
              <p className={sectionLabel}>Hafta Değerlendirmesi</p>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-ink-secondary mb-1.5">Ne iyi gitti?</p>
                  <textarea
                    defaultValue={reviewGood}
                    onBlur={e => { setReviewGood(e.target.value); saveReviewGood(e.target.value) }}
                    placeholder="Bu hafta iyi giden şeyler..."
                    rows={3}
                    className={`w-full resize-none ${inputCls}`}
                    style={{ borderRadius: 2 }}
                  />
                </div>
                <div>
                  <p className="text-xs text-ink-secondary mb-1.5">Gelecek hafta odak?</p>
                  <textarea
                    defaultValue={reviewNext}
                    onBlur={e => { setReviewNext(e.target.value); saveReviewNext(e.target.value) }}
                    placeholder="Gelecek hafta üzerinde çalışacağım..."
                    rows={3}
                    className={`w-full resize-none ${inputCls}`}
                    style={{ borderRadius: 2 }}
                  />
                </div>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}
