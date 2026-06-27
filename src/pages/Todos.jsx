// SQL — run once in Supabase:
// ALTER TABLE todos ADD COLUMN IF NOT EXISTS goal_id uuid references goals(id);
// (Table is named 'tasks' in this app — use: ALTER TABLE tasks ADD COLUMN IF NOT EXISTS goal_id uuid references goals(id);)

import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { format, isToday, parseISO, addDays, addMonths } from 'date-fns'
import { tr } from 'date-fns/locale'
import {
  Plus, Trash2, CheckSquare, Square, Calendar, Flag,
  Edit2, X, ChevronDown, ChevronUp, LayoutGrid, List as ListIcon,
  RotateCcw, Tag, ChevronLeft, ChevronRight,
} from 'lucide-react'
import toast from 'react-hot-toast'

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIORITY = {
  low:    { label: 'Düşük',  color: 'text-blue-300',   bg: 'bg-blue-900/20'    },
  medium: { label: 'Orta',   color: 'text-yellow-300', bg: 'bg-yellow-900/20'  },
  high:   { label: 'Yüksek', color: 'text-red-400',    bg: 'bg-red-900/20'     },
}

const RECURRENCE = {
  none:    'Tekrar Yok',
  daily:   'Her Gün',
  weekly:  'Haftalık',
  monthly: 'Aylık',
}

const PRESET_TAGS = ['iş', 'kişisel', 'acil', 'özel']

const TAG_COLORS = {
  iş:      'bg-blue-900/30   text-blue-300',
  kişisel: 'bg-purple-900/30 text-purple-300',
  acil:    'bg-red-900/30    text-red-300',
  özel:    'bg-green-900/30  text-green-300',
}
const TAG_DEF = 'bg-white/10 text-ink-secondary'
const tagStyle = name => TAG_COLORS[name] || TAG_DEF

// Eisenhower quadrants ─ top-left, top-right, bottom-left, bottom-right
const QUADRANTS = [
  {
    id: 'q1', title: 'Acil + Önemli',        sub: 'Hemen Yap',
    border: 'border-red-700/50',
    hdr:    'bg-red-900/20 text-red-300',
    drop:   { priority: 'high',   importance: 'important' },
  },
  {
    id: 'q2', title: 'Önemli, Acil Değil',   sub: 'Planla',
    border: 'border-blue-700/50',
    hdr:    'bg-blue-900/20 text-blue-300',
    drop:   { priority: 'medium', importance: 'important' },
  },
  {
    id: 'q3', title: 'Acil, Önemsiz',        sub: 'Devret',
    border: 'border-yellow-700/50',
    hdr:    'bg-yellow-900/20 text-yellow-300',
    drop:   { priority: 'high',   importance: 'normal' },
  },
  {
    id: 'q4', title: 'Acil Değil, Önemsiz',  sub: 'Elemele',
    border: 'border-border-subtle',
    hdr:    'bg-white/5 text-ink-muted',
    drop:   { priority: 'low',    importance: 'normal' },
  },
]

function getQuadrant(task) {
  const urgent    = (task.priority   || 'medium') === 'high'
  const important = (task.importance || 'normal') === 'important'
  if (urgent && important)   return 'q1'
  if (!urgent && important)  return 'q2'
  if (urgent && !important)  return 'q3'
  return 'q4'
}

function getNextDate(task) {
  const base = task.due_date ? parseISO(task.due_date) : new Date()
  if (task.recurrence === 'daily')   return format(addDays(base, 1),   'yyyy-MM-dd')
  if (task.recurrence === 'weekly')  return format(addDays(base, 7),   'yyyy-MM-dd')
  if (task.recurrence === 'monthly') return format(addMonths(base, 1), 'yyyy-MM-dd')
  return format(addDays(new Date(), 1), 'yyyy-MM-dd')
}

const emptyForm = () => ({
  title: '', due_date: '', priority: 'medium',
  importance: 'normal', recurrence: 'none', tags: [], goal_id: null,
})

// ─── Calendar helpers ─────────────────────────────────────────────────────────

const DAY_HEADERS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cts']
const MONTH_TR    = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']
const WEEK_SHORT  = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cts']

function pillBg(task) {
  if (task.priority === 'high')   return 'bg-red-900/40 text-red-300'
  if (task.priority === 'medium') return 'bg-amber-900/40 text-yellow-300'
  if (task.priority === 'low')    return 'bg-white/10 text-ink-secondary'
  return 'bg-primary-500/20 text-primary-300'
}

// ─── TagInput ─────────────────────────────────────────────────────────────────

function TagInput({ value = [], onChange }) {
  const [custom, setCustom] = useState('')

  function toggle(name) {
    onChange(value.includes(name) ? value.filter(t => t !== name) : [...value, name])
  }

  function addCustom(raw) {
    const name = raw.trim().toLowerCase().replace(/^#/, '').replace(/\s+/g, '-')
    if (name && !value.includes(name)) onChange([...value, name])
  }

  const customTags = value.filter(t => !PRESET_TAGS.includes(t))

  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {PRESET_TAGS.map(t => (
        <button key={t} type="button" onClick={() => toggle(t)}
          className={`px-2 py-0.5 rounded-full text-xs font-medium transition-all ${tagStyle(t)} ${value.includes(t) ? 'ring-2 ring-offset-1 ring-offset-surface-card ring-primary-400' : 'opacity-70 hover:opacity-100'}`}>
          #{t}
        </button>
      ))}
      {customTags.map(t => (
        <span key={t} className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${TAG_DEF}`}>
          #{t}
          <button type="button" onClick={() => toggle(t)} className="hover:text-status-error transition-colors"><X size={9} /></button>
        </span>
      ))}
      <input
        value={custom}
        onChange={e => setCustom(e.target.value)}
        onKeyDown={e => {
          if ((e.key === 'Enter' || e.key === ',') && custom.trim()) {
            e.preventDefault(); addCustom(custom); setCustom('')
          }
        }}
        placeholder="Özel etiket + Enter"
        className="flex-1 min-w-[110px] px-2 py-0.5 text-xs rounded-lg border border-border-subtle bg-white/5 text-ink-primary placeholder-ink-muted focus:outline-none focus:ring-1 focus:ring-primary-400"
      />
    </div>
  )
}

// ─── FormFields — shared between create form and edit modal ──────────────────

function FormFields({ f, set, compact = false }) {
  const inp = `px-3 py-${compact ? '1.5' : '2'} text-sm rounded-lg border border-border-subtle bg-white/5 text-ink-primary focus:outline-none focus:ring-2 focus:ring-primary-500 w-full`
  return (
    <>
      <div className="flex gap-2 flex-wrap">
        <input type="date" value={f.due_date} onChange={e => set('due_date', e.target.value)} className={`${inp} flex-1 min-w-[110px]`} />
        <select value={f.priority} onChange={e => set('priority', e.target.value)} className={`${inp} flex-1 min-w-[100px]`}>
          <option value="low">Düşük Öncelik</option>
          <option value="medium">Orta Öncelik</option>
          <option value="high">Yüksek Öncelik</option>
        </select>
        <select value={f.importance} onChange={e => set('importance', e.target.value)} className={`${inp} flex-1 min-w-[100px]`}>
          <option value="important">Önemli</option>
          <option value="normal">Sıradan</option>
        </select>
        <select value={f.recurrence} onChange={e => set('recurrence', e.target.value)} className={`${inp} flex-1 min-w-[100px]`}>
          <option value="none">Tekrar Yok</option>
          <option value="daily">Her Gün</option>
          <option value="weekly">Haftalık</option>
          <option value="monthly">Aylık</option>
        </select>
      </div>
      <div className="flex gap-2 items-center">
        <Tag size={13} className="text-ink-muted shrink-0" />
        <TagInput value={f.tags} onChange={tags => set('tags', tags)} />
      </div>
    </>
  )
}

// ─── SubtasksList ─────────────────────────────────────────────────────────────

function SubtasksList({ taskId, userId, subtasksMap, onUpdate }) {
  const [newTitle, setNewTitle] = useState('')
  const list = subtasksMap[taskId] || []

  async function add() {
    if (!newTitle.trim()) return
    const { data } = await supabase.from('subtasks')
      .insert({ task_id: taskId, user_id: userId, title: newTitle.trim(), completed: false })
      .select().single()
    if (data) onUpdate(taskId, [...list, data])
    setNewTitle('')
  }

  async function toggle(sub) {
    const { data } = await supabase.from('subtasks')
      .update({ completed: !sub.completed }).eq('id', sub.id).select().single()
    if (data) onUpdate(taskId, list.map(s => s.id === sub.id ? data : s))
  }

  async function remove(subId) {
    await supabase.from('subtasks').delete().eq('id', subId)
    onUpdate(taskId, list.filter(s => s.id !== subId))
  }

  return (
    <div className="mt-2 pt-3 border-t border-border-subtle space-y-1.5">
      {list.map(sub => (
        <div key={sub.id} className="flex items-center gap-2 group">
          <button onClick={() => toggle(sub)} className="shrink-0">
            {sub.completed
              ? <CheckSquare size={15} className="text-status-success" />
              : <Square      size={15} className="text-ink-muted"  />}
          </button>
          <span className={`flex-1 text-sm ${sub.completed ? 'line-through text-ink-muted' : 'text-ink-secondary'}`}>
            {sub.title}
          </span>
          <button onClick={() => remove(sub.id)}
            className="opacity-0 group-hover:opacity-100 text-ink-muted hover:text-status-error transition-all shrink-0">
            <X size={13} />
          </button>
        </div>
      ))}
      <div className="flex gap-1.5 pt-1">
        <input
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="Alt görev ekle..."
          className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-border-subtle bg-white/5 text-ink-primary placeholder-ink-muted focus:outline-none focus:ring-2 focus:ring-primary-400"
        />
        <button onClick={add}
          className="px-2.5 rounded-lg bg-primary-500/20 text-primary-400 hover:bg-primary-500/30 transition-colors">
          <Plus size={15} />
        </button>
      </div>
    </div>
  )
}

// ─── MatrixView ───────────────────────────────────────────────────────────────

function MatrixView({ tasks, subtasksMap, onDrop, onToggle, onEdit, onDelete }) {
  const [hoveredQ, setHoveredQ] = useState(null)
  const activeTasks = tasks.filter(t => !t.completed)

  return (
    <div className="grid grid-cols-2 gap-3">
      {QUADRANTS.map(q => {
        const qTasks = activeTasks.filter(t => getQuadrant(t) === q.id)
        return (
          <div key={q.id}
            className={`rounded-xl border-2 overflow-hidden transition-all ${q.border} ${hoveredQ === q.id ? 'scale-[1.01]' : ''}`}
            onDragOver={e => { e.preventDefault(); setHoveredQ(q.id) }}
            onDragLeave={() => setHoveredQ(null)}
            onDrop={e => {
              e.preventDefault()
              const taskId = e.dataTransfer.getData('taskId')
              if (taskId) onDrop(taskId, q.drop)
              setHoveredQ(null)
            }}>
            <div className={`px-3 py-2 ${q.hdr}`}>
              <p className="text-xs font-bold">{q.title}</p>
              <p className="text-xs opacity-70">{q.sub}</p>
            </div>
            <div className="p-2 min-h-[110px] space-y-1.5 bg-surface-card/40">
              {qTasks.length === 0 && (
                <p className="text-xs text-ink-muted text-center pt-5 select-none">Boş</p>
              )}
              {qTasks.map(task => {
                const subList = subtasksMap[task.id] || []
                const subDone = subList.filter(s => s.completed).length
                return (
                  <div key={task.id}
                    draggable
                    onDragStart={e => e.dataTransfer.setData('taskId', task.id)}
                    className="bg-surface-card/80 backdrop-blur-md rounded-xl px-3 py-2 border border-border-subtle cursor-grab active:cursor-grabbing select-none group hover:border-border-glow transition-colors">
                    <div className="flex items-start gap-2">
                      <button onClick={() => onToggle(task)} className="mt-0.5 shrink-0">
                        <Square size={14} className="text-ink-muted hover:text-primary-400 transition-colors" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-ink-primary leading-snug">{task.title}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {task.due_date && (
                            <span className={`text-xs ${isToday(parseISO(task.due_date)) ? 'text-status-warning' : 'text-ink-muted'}`}>
                              📅 {format(parseISO(task.due_date), 'd MMM', { locale: tr })}
                            </span>
                          )}
                          {(task.tags || []).map(t => (
                            <span key={t} className={`px-1.5 py-0 rounded-full text-xs font-medium ${tagStyle(t)}`}>#{t}</span>
                          ))}
                          {subList.length > 0 && (
                            <span className="text-xs text-ink-muted">{subDone}/{subList.length} alt</span>
                          )}
                          {task.recurrence && task.recurrence !== 'none' && (
                            <span className="text-xs text-ink-muted flex items-center gap-0.5">
                              <RotateCcw size={9} />{RECURRENCE[task.recurrence]}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button onClick={() => onEdit(task)} className="p-1 text-ink-muted hover:text-primary-400 transition-colors"><Edit2 size={12} /></button>
                        <button onClick={() => onDelete(task.id)} className="p-1 text-ink-muted hover:text-status-error transition-colors"><Trash2 size={12} /></button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── CalendarView ─────────────────────────────────────────────────────────────

function CalendarView({ tasks, onToggle }) {
  const [calView,     setCalView]     = useState('monthly')
  const [calDate,     setCalDate]     = useState(new Date())
  const [popoverDate, setPopoverDate] = useState(null)

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') setPopoverDate(null) }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  // Index tasks by date string
  const tasksByDate = {}
  tasks.forEach(task => {
    if (task.due_date) {
      if (!tasksByDate[task.due_date]) tasksByDate[task.due_date] = []
      tasksByDate[task.due_date].push(task)
    }
  })

  function prevPeriod() {
    setPopoverDate(null)
    if (calView === 'monthly')
      setCalDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))
    else if (calView === 'weekly')
      setCalDate(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n })
    else
      setCalDate(d => { const n = new Date(d); n.setDate(n.getDate() - 1); return n })
  }
  function nextPeriod() {
    setPopoverDate(null)
    if (calView === 'monthly')
      setCalDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))
    else if (calView === 'weekly')
      setCalDate(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n })
    else
      setCalDate(d => { const n = new Date(d); n.setDate(n.getDate() + 1); return n })
  }

  // ── Monthly grid ──────────────────────────────────────────────────────────
  const year         = calDate.getFullYear()
  const month        = calDate.getMonth()
  const firstOfMonth = new Date(year, month, 1)
  const daysInMonth  = new Date(year, month + 1, 0).getDate()
  const startOffset  = firstOfMonth.getDay()
  const totalCells   = Math.ceil((startOffset + daysInMonth) / 7) * 7
  const monthCells   = Array.from({ length: totalCells }, (_, i) => {
    const d = i - startOffset + 1
    if (d < 1 || d > daysInMonth) return null
    return new Date(year, month, d)
  })

  // ── Weekly grid ───────────────────────────────────────────────────────────
  const dow        = calDate.getDay()
  const sinceMon   = dow === 0 ? 6 : dow - 1
  const weekStart  = new Date(calDate)
  weekStart.setDate(calDate.getDate() - sinceMon)
  const weekDays   = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return d
  })

  // ── Period label ─────────────────────────────────────────────────────────
  const periodLabel = (() => {
    if (calView === 'monthly') return `${MONTH_TR[month]} ${year}`
    if (calView === 'weekly') {
      const s = weekDays[0], e = weekDays[6]
      if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
        return `${s.getDate()}–${format(e, 'd MMMM yyyy', { locale: tr })}`
      }
      return `${format(s, 'd MMM', { locale: tr })} – ${format(e, 'd MMM yyyy', { locale: tr })}`
    }
    return format(calDate, 'd MMMM yyyy', { locale: tr })
  })()

  // ── Daily ────────────────────────────────────────────────────────────────
  const dailyStr   = format(calDate, 'yyyy-MM-dd')
  const dailyTasks = tasksByDate[dailyStr] || []

  return (
    <div>
      {/* Sub-view toggle */}
      <div className="flex gap-1 mb-4 bg-surface-card p-1 rounded-xl border border-border-subtle">
        {[
          { key: 'monthly', label: 'Aylık'   },
          { key: 'weekly',  label: 'Haftalık' },
          { key: 'daily',   label: 'Günlük'   },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => { setCalView(key); setPopoverDate(null) }}
            className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              calView === key
                ? 'bg-white/10 text-ink-primary'
                : 'text-ink-muted hover:text-ink-secondary'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Navigation bar */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={prevPeriod}
          className="p-2 rounded-lg bg-white/5 border border-border-subtle text-ink-secondary hover:bg-white/10 transition-colors">
          <ChevronLeft size={16} />
        </button>
        <p className="flex-1 text-center font-semibold text-ink-primary">{periodLabel}</p>
        <button onClick={nextPeriod}
          className="p-2 rounded-lg bg-white/5 border border-border-subtle text-ink-secondary hover:bg-white/10 transition-colors">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Daily date picker */}
      {calView === 'daily' && (
        <div className="flex justify-center mb-4">
          <input type="date" value={dailyStr}
            onChange={e => e.target.value && setCalDate(parseISO(e.target.value))}
            className="px-4 py-2 rounded-xl border border-border-subtle bg-white/5 text-ink-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      )}

      {/* ── Monthly view ─────────────────────────────────────────────────── */}
      {calView === 'monthly' && (
        <>
          {/* Desktop calendar grid */}
          <div className="hidden sm:block overflow-hidden rounded-xl border border-border-subtle">
            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 border-b border-border-subtle bg-white/5">
              {DAY_HEADERS.map(h => (
                <div key={h} className="py-2 text-center text-xs font-semibold text-ink-muted">{h}</div>
              ))}
            </div>
            {/* Cells */}
            <div className="grid grid-cols-7 gap-px bg-border-subtle">
              {monthCells.map((cell, i) => {
                const ds        = cell ? format(cell, 'yyyy-MM-dd') : null
                const dayTasks  = ds ? (tasksByDate[ds] || []) : []
                const visible   = dayTasks.slice(0, 3)
                const extra     = dayTasks.length - 3
                const todayCell = cell && isToday(cell)
                return (
                  <div key={i}
                    onClick={() => cell && setPopoverDate(ds)}
                    className={[
                      'bg-surface-card min-h-[88px] p-1.5 transition-colors',
                      cell ? 'cursor-pointer hover:bg-primary-500/5' : 'bg-surface/80 pointer-events-none',
                      todayCell ? 'ring-1 ring-inset ring-primary-500' : '',
                    ].join(' ')}
                  >
                    {cell && (
                      <>
                        <div className={`mb-1 w-6 h-6 text-xs font-semibold flex items-center justify-center rounded-full ${
                          todayCell
                            ? 'bg-primary-600 text-white'
                            : 'text-ink-secondary'
                        }`}>
                          {cell.getDate()}
                        </div>
                        <div className="space-y-0.5">
                          {visible.map(task => (
                            <div key={task.id}
                              className={`text-[10px] px-1.5 py-[1px] rounded-md truncate leading-4 ${pillBg(task)} ${task.completed ? 'opacity-40 line-through' : ''}`}>
                              {task.title.length > 18 ? task.title.slice(0, 18) + '…' : task.title}
                            </div>
                          ))}
                          {extra > 0 && (
                            <p className="text-[10px] text-ink-muted pl-0.5">+{extra} daha</p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Mobile: list grouped by date */}
          <div className="sm:hidden space-y-3">
            {(() => {
              const entries = Object.entries(tasksByDate)
                .filter(([d]) => {
                  const p = parseISO(d)
                  return p.getFullYear() === year && p.getMonth() === month
                })
                .sort(([a], [b]) => a.localeCompare(b))

              if (!entries.length)
                return <p className="text-center text-sm text-ink-muted py-10">Bu ay görev yok</p>

              return entries.map(([d, dayTasks]) => (
                <div key={d} className="rounded-xl bg-surface-card/80 border border-border-subtle p-3">
                  <p className={`text-sm font-semibold mb-2 ${isToday(parseISO(d)) ? 'text-primary-400' : 'text-ink-primary'}`}>
                    {format(parseISO(d), 'd MMMM', { locale: tr })}
                    {isToday(parseISO(d)) && <span className="ml-1.5 text-xs font-normal opacity-70">Bugün</span>}
                  </p>
                  <div className="space-y-1.5">
                    {dayTasks.map(task => (
                      <div key={task.id} className="flex items-center gap-2">
                        <button onClick={() => onToggle(task)} className="shrink-0">
                          {task.completed
                            ? <CheckSquare size={13} className="text-status-success" />
                            : <Square size={13} className="text-ink-muted" />}
                        </button>
                        <span className={`flex-1 text-xs ${task.completed ? 'line-through text-ink-muted' : 'text-ink-secondary'}`}>
                          {task.title}
                        </span>
                        <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full ${pillBg(task)}`}>
                          {PRIORITY[task.priority || 'medium']?.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            })()}
          </div>
        </>
      )}

      {/* ── Weekly view ──────────────────────────────────────────────────── */}
      {calView === 'weekly' && (
        <div className="overflow-x-auto -mx-1">
          <div className="grid grid-cols-7 gap-2 min-w-[560px] px-1">
            {weekDays.map((day, i) => {
              const ds       = format(day, 'yyyy-MM-dd')
              const dt       = tasksByDate[ds] || []
              const todayDay = isToday(day)
              return (
                <div key={i} className={`rounded-xl border overflow-hidden flex flex-col ${
                  todayDay ? 'border-primary-500' : 'border-border-subtle'
                }`}>
                  {/* Column header */}
                  <div className={`py-2 px-1 text-center shrink-0 ${todayDay ? 'bg-primary-600' : 'bg-white/5'}`}>
                    <p className={`text-[10px] font-bold uppercase tracking-wider ${todayDay ? 'text-primary-200' : 'text-ink-muted'}`}>
                      {WEEK_SHORT[day.getDay()]}
                    </p>
                    <p className={`text-lg font-bold leading-none mt-0.5 ${todayDay ? 'text-white' : 'text-ink-primary'}`}>
                      {day.getDate()}
                    </p>
                  </div>
                  {/* Task list */}
                  <div className="p-1.5 bg-surface-card flex-1 min-h-[130px] space-y-1">
                    {dt.length === 0
                      ? <p className="text-[10px] text-ink-muted text-center pt-6">—</p>
                      : dt.map(task => (
                          <div key={task.id}
                            className={`rounded-lg p-1.5 ${pillBg(task)} ${task.completed ? 'opacity-40' : ''}`}>
                            <div className="flex items-start gap-1">
                              <button onClick={() => onToggle(task)} className="shrink-0 mt-px">
                                {task.completed
                                  ? <CheckSquare size={11} className="text-status-success" />
                                  : <Square size={11} className="opacity-60" />}
                              </button>
                              <span className={`text-[10px] leading-snug ${task.completed ? 'line-through' : ''}`}>
                                {task.title.length > 22 ? task.title.slice(0, 22) + '…' : task.title}
                              </span>
                            </div>
                          </div>
                        ))
                    }
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Daily view ───────────────────────────────────────────────────── */}
      {calView === 'daily' && (
        <div className="space-y-2">
          {dailyTasks.length === 0 ? (
            <div className="text-center py-12 text-ink-muted">
              <CheckSquare size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Bu tarihte görev yok</p>
            </div>
          ) : (
            dailyTasks.map(task => {
              const p = PRIORITY[task.priority] || PRIORITY.medium
              return (
                <div key={task.id}
                  className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                    task.completed
                      ? 'bg-surface-card/40 border-border-subtle opacity-70'
                      : 'bg-surface-card/80 border-border-subtle hover:border-border-glow'
                  }`}>
                  <button onClick={() => onToggle(task)}
                    className="shrink-0 mt-0.5 text-ink-muted hover:text-primary-400 transition-colors">
                    {task.completed
                      ? <CheckSquare size={18} className="text-status-success" />
                      : <Square size={18} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${task.completed ? 'line-through text-ink-muted' : 'text-ink-primary'}`}>
                      {task.title}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                      <span className={`text-xs px-1.5 py-0.5 rounded-md flex items-center gap-1 ${p.color} ${p.bg}`}>
                        <Flag size={9} />{p.label}
                      </span>
                      {(task.tags || []).map(t => (
                        <span key={t} className={`px-1.5 py-0 rounded-full text-xs font-medium ${tagStyle(t)}`}>#{t}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ── Day detail modal (monthly click) ─────────────────────────────── */}
      {popoverDate && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPopoverDate(null)}>
          <div
            className="bg-surface-card border border-border-subtle rounded-xl w-full max-w-sm max-h-[80vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle shrink-0">
              <div>
                <p className="font-semibold text-ink-primary">
                  {format(parseISO(popoverDate), 'd MMMM yyyy', { locale: tr })}
                </p>
                {isToday(parseISO(popoverDate)) && (
                  <p className="text-xs text-primary-400 mt-0.5">Bugün</p>
                )}
              </div>
              <button onClick={() => setPopoverDate(null)}
                className="p-1.5 text-ink-muted hover:text-ink-primary rounded-lg hover:bg-white/5 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-2">
              {(tasksByDate[popoverDate] || []).length === 0 ? (
                <p className="text-center text-sm text-ink-muted py-8">Bu tarihte görev yok</p>
              ) : (
                (tasksByDate[popoverDate] || []).map(task => {
                  const p = PRIORITY[task.priority] || PRIORITY.medium
                  return (
                    <div key={task.id}
                      className={`flex items-start gap-3 p-3 rounded-xl border ${
                        task.completed
                          ? 'bg-white/5 border-border-subtle opacity-60'
                          : 'bg-white/5 border-border-subtle hover:border-border-glow'
                      }`}>
                      <button onClick={() => onToggle(task)}
                        className="shrink-0 mt-0.5 text-ink-muted hover:text-primary-400 transition-colors">
                        {task.completed
                          ? <CheckSquare size={16} className="text-status-success" />
                          : <Square size={16} />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${task.completed ? 'line-through text-ink-muted' : 'text-ink-primary'}`}>
                          {task.title}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <span className={`text-xs px-1.5 py-0.5 rounded-md ${p.color} ${p.bg}`}>{p.label}</span>
                          {(task.tags || []).map(t => (
                            <span key={t} className={`px-1.5 py-0 rounded-full text-xs font-medium ${tagStyle(t)}`}>#{t}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

const STATUS_FILTERS = [
  { key: 'all',       label: 'Tümü'       },
  { key: 'active',    label: 'Aktif'      },
  { key: 'completed', label: 'Tamamlanan' },
  { key: 'today',     label: 'Bugün'      },
]

export default function Todos() {
  const { user } = useAuth()
  const [tasks,         setTasks]         = useState([])
  const [subtasksMap,   setSubtasksMap]   = useState({})
  const [filter,        setFilter]        = useState('all')
  const [tagFilter,     setTagFilter]     = useState(null)
  const [viewMode,      setViewMode]      = useState('list')
  const [loading,       setLoading]       = useState(true)
  const [form,          setFormState]     = useState(emptyForm)
  const [editingId,     setEditingId]     = useState(null)
  const [editForm,      setEditFormState] = useState({})
  const [openSubs,      setOpenSubs]      = useState(new Set())
  const [mainTab,       setMainTab]       = useState('tasks')
  const [goals,         setGoals]         = useState([])

  // ── helpers ──
  const setF  = (k, v) => setFormState(f => ({ ...f, [k]: v }))
  const setEF = (k, v) => setEditFormState(f => ({ ...f, [k]: v }))
  const updateSubtasks = (taskId, list) => setSubtasksMap(m => ({ ...m, [taskId]: list }))
  function toggleOpenSubs(taskId) {
    setOpenSubs(s => { const n = new Set(s); n.has(taskId) ? n.delete(taskId) : n.add(taskId); return n })
  }

  // ── load ──
  async function load() {
    const [{ data: t }, { data: st }] = await Promise.all([
      supabase.from('tasks').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('subtasks').select('*').eq('user_id', user.id),
    ])
    setTasks(t || [])
    const stMap = {}
    ;(st || []).forEach(s => { if (!stMap[s.task_id]) stMap[s.task_id] = []; stMap[s.task_id].push(s) })
    setSubtasksMap(stMap)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // ── Real-time task sync ──
  useEffect(() => {
    const channel = supabase
      .channel(`tasks-rt-${user.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'tasks',
        filter: `user_id=eq.${user.id}`,
      }, payload => {
        if (payload.eventType === 'INSERT') {
          setTasks(ts => ts.some(t => t.id === payload.new.id) ? ts : [payload.new, ...ts])
        } else if (payload.eventType === 'UPDATE') {
          setTasks(ts => ts.map(t => t.id === payload.new.id ? payload.new : t))
        } else if (payload.eventType === 'DELETE') {
          setTasks(ts => ts.filter(t => t.id !== payload.old.id))
        }
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [user.id])

  // ── CRUD ──
  async function addTask() {
    if (!form.title.trim()) return
    const { data, error } = await supabase.from('tasks')
      .insert({
        user_id: user.id, completed: false,
        title: form.title.trim(), due_date: form.due_date || null,
        priority: form.priority, importance: form.importance,
        recurrence: form.recurrence, tags: form.tags,
      }).select().single()
    if (error) { toast.error('Görev eklenemedi'); return }
    setTasks(ts => [data, ...ts])
    setFormState(emptyForm())
    toast.success('Görev eklendi!')
  }

  async function toggleTask(task) {
    const nowDone = !task.completed
    const { data } = await supabase.from('tasks')
      .update({ completed: nowDone }).eq('id', task.id).select().single()
    if (data) setTasks(ts => ts.map(x => x.id === task.id ? data : x))

    if (nowDone && task.recurrence && task.recurrence !== 'none') {
      const { data: rec } = await supabase.from('tasks').insert({
        user_id: user.id, completed: false,
        title: task.title, priority: task.priority,
        importance: task.importance || 'normal',
        tags: task.tags || [], recurrence: task.recurrence,
        due_date: getNextDate(task),
      }).select().single()
      if (rec) { setTasks(ts => [rec, ...ts]); toast.success('🔄 Tekrarlayan görev yenilendi!') }
    }
  }

  async function deleteTask(id) {
    await supabase.from('subtasks').delete().eq('task_id', id)
    await supabase.from('tasks').delete().eq('id', id)
    setTasks(ts => ts.filter(x => x.id !== id))
    setSubtasksMap(m => { const n = { ...m }; delete n[id]; return n })
  }

  function startEdit(task) {
    setEditingId(task.id)
    setEditFormState({
      title: task.title, due_date: task.due_date || '',
      priority: task.priority || 'medium',
      importance: task.importance || 'normal',
      recurrence: task.recurrence || 'none',
      tags: task.tags || [],
    })
  }

  async function saveEdit() {
    if (!editForm.title?.trim()) return
    const { data, error } = await supabase.from('tasks')
      .update({ ...editForm, due_date: editForm.due_date || null })
      .eq('id', editingId).select().single()
    if (error) { toast.error('Güncellenemedi'); return }
    setTasks(ts => ts.map(x => x.id === editingId ? data : x))
    setEditingId(null)
    toast.success('Güncellendi')
  }

  async function dropToQuadrant(taskId, updates) {
    const { data } = await supabase.from('tasks').update(updates).eq('id', taskId).select().single()
    if (data) setTasks(ts => ts.map(x => x.id === taskId ? data : x))
  }

  // ── filtering ──
  const statusFiltered = tasks.filter(t => {
    if (filter === 'active')    return !t.completed
    if (filter === 'completed') return t.completed
    if (filter === 'today')     return t.due_date && isToday(parseISO(t.due_date))
    return true
  })
  const filtered = tagFilter
    ? statusFiltered.filter(t => (t.tags || []).includes(tagFilter))
    : statusFiltered

  const allTags = [...new Set(tasks.flatMap(t => t.tags || []))]

  if (loading) return (
    <div className="text-center py-20">
      <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
    </div>
  )

  return (
    <div>
      {/* ── Main tab bar ── */}
      <div className="flex gap-2 mb-5 bg-surface-card p-1 rounded-xl border border-border-subtle">
        {[
          { key: 'tasks',    label: '📋 Görevler' },
          { key: 'calendar', label: '📅 Takvim'   },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setMainTab(key)}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
              mainTab === key
                ? 'bg-white/10 text-ink-primary'
                : 'text-ink-muted hover:text-ink-secondary'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Tasks tab ── */}
      {mainTab === 'tasks' && (
        <>
          {/* Header + view toggle */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold text-ink-primary">Görev Listesi</h2>
            <div className="flex gap-1 bg-surface-card rounded-lg p-1 border border-border-subtle">
              {[
                { mode: 'list',   Icon: ListIcon,    title: 'Liste'   },
                { mode: 'matrix', Icon: LayoutGrid,  title: 'Matris'  },
              ].map(({ mode, Icon, title }) => (
                <button key={mode} onClick={() => setViewMode(mode)} title={title}
                  className={`p-1.5 rounded-md transition-colors ${viewMode === mode ? 'bg-white/10 text-primary-400' : 'text-ink-muted hover:text-ink-secondary'}`}>
                  <Icon size={16} />
                </button>
              ))}
            </div>
          </div>

          {/* Create form */}
          <div className="bg-surface-card/80 backdrop-blur-md border border-border-subtle rounded-xl p-4 mb-6 space-y-3">
            <div className="flex gap-2">
              <input
                value={form.title}
                onChange={e => setF('title', e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTask()}
                placeholder="Görev başlığı..."
                className="flex-1 px-4 py-2.5 rounded-xl border border-border-subtle bg-white/5 text-ink-primary placeholder-ink-muted focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button onClick={addTask}
                className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm transition-colors shrink-0">
                <Plus size={16} /> Ekle
              </button>
            </div>
            <FormFields f={form} set={setF} />
          </div>

          {/* Status + tag filters (list view only) */}
          {viewMode === 'list' && (
            <div className="mb-4 space-y-2">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {STATUS_FILTERS.map(({ key, label }) => (
                  <button key={key} onClick={() => setFilter(key)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                      filter === key
                        ? 'bg-primary-500 text-white'
                        : 'bg-white/5 text-ink-secondary border border-border-subtle hover:bg-white/10'
                    }`}>
                    {label}
                  </button>
                ))}
                <span className="ml-auto text-sm text-ink-muted self-center whitespace-nowrap">
                  {filtered.filter(t => !t.completed).length} kalan
                </span>
              </div>

              {allTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 items-center">
                  <span className="text-xs text-ink-muted shrink-0">Etiket:</span>
                  {tagFilter && (
                    <button onClick={() => setTagFilter(null)}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-white/10 text-ink-muted hover:bg-white/15 transition-colors">
                      <X size={9} /> Temizle
                    </button>
                  )}
                  {allTags.map(t => (
                    <button key={t} onClick={() => setTagFilter(tagFilter === t ? null : t)}
                      className={`px-2 py-0.5 rounded-full text-xs font-medium transition-all ${tagStyle(t)} ${tagFilter === t ? 'ring-2 ring-offset-1 ring-offset-surface ring-primary-400' : 'opacity-80 hover:opacity-100'}`}>
                      #{t}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Matrix view */}
          {viewMode === 'matrix' && (
            <MatrixView
              tasks={tasks}
              subtasksMap={subtasksMap}
              onDrop={dropToQuadrant}
              onToggle={toggleTask}
              onEdit={startEdit}
              onDelete={deleteTask}
            />
          )}

          {/* List view */}
          {viewMode === 'list' && (
            filtered.length === 0 ? (
              <div className="text-center py-12 text-ink-muted">
                <CheckSquare size={36} className="mx-auto mb-2 opacity-30" />
                <p>Burada görev yok!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map(task => {
                  const p        = PRIORITY[task.priority] || PRIORITY.medium
                  const isEditing = editingId === task.id
                  const subList  = subtasksMap[task.id] || []
                  const subDone  = subList.filter(s => s.completed).length
                  const hasRec   = task.recurrence && task.recurrence !== 'none'
                  const tags     = task.tags || []

                  return (
                    <div key={task.id}
                      className={`rounded-xl border transition-colors ${
                        task.completed
                          ? 'bg-surface-card/40 border-border-subtle opacity-70'
                          : 'bg-surface-card/80 border-border-subtle hover:border-border-glow'
                      }`}>

                      {isEditing ? (
                        <div className="p-3 space-y-2">
                          <input
                            autoFocus
                            value={editForm.title}
                            onChange={e => setEF('title', e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && saveEdit()}
                            className="w-full px-3 py-2 text-sm rounded-lg border border-border-subtle bg-white/5 text-ink-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                          <FormFields f={editForm} set={setEF} compact />
                          <div className="flex gap-2">
                            <button onClick={() => setEditingId(null)}
                              className="flex-1 py-1.5 rounded-lg border border-border-subtle text-ink-secondary text-sm font-medium hover:bg-white/5 transition-colors">
                              İptal
                            </button>
                            <button onClick={saveEdit}
                              className="flex-1 py-1.5 rounded-lg bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium transition-colors">
                              Kaydet
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3">
                          <div className="flex items-center gap-3">
                            <button onClick={() => toggleTask(task)} className="shrink-0 text-ink-muted hover:text-primary-400 transition-colors">
                              {task.completed
                                ? <CheckSquare size={20} className="text-status-success" />
                                : <Square size={20} />
                              }
                            </button>
                            <div className="flex-1 min-w-0">
                              <p className={`font-medium truncate ${task.completed ? 'line-through text-ink-muted' : 'text-ink-primary'}`}>
                                {task.title}
                              </p>
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                                {task.due_date && (
                                  <span className={`flex items-center gap-1 text-xs ${isToday(parseISO(task.due_date)) ? 'text-status-warning' : 'text-ink-muted'}`}>
                                    <Calendar size={11} />
                                    {format(parseISO(task.due_date), 'd MMM', { locale: tr })}
                                  </span>
                                )}
                                <span className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md ${p.color} ${p.bg}`}>
                                  <Flag size={10} /> {p.label}
                                </span>
                                {hasRec && (
                                  <span className="flex items-center gap-1 text-xs text-ink-muted">
                                    <RotateCcw size={10} /> {RECURRENCE[task.recurrence]}
                                  </span>
                                )}
                              </div>
                              {tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {tags.map(t => (
                                    <button key={t} onClick={() => setTagFilter(t)}
                                      className={`px-1.5 py-0 rounded-full text-xs font-medium ${tagStyle(t)} hover:ring-1 hover:ring-primary-400 transition-all`}>
                                      #{t}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-0.5 shrink-0">
                              <button onClick={() => toggleOpenSubs(task.id)}
                                className={`p-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
                                  openSubs.has(task.id)
                                    ? 'bg-primary-500/15 text-primary-400'
                                    : 'text-ink-muted hover:text-ink-secondary'
                                }`}
                                title="Alt görevler">
                                {subList.length > 0 && <span className="text-xs">{subDone}/{subList.length}</span>}
                                {openSubs.has(task.id) ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              </button>
                              <button onClick={() => startEdit(task)} className="p-1.5 text-ink-muted hover:text-primary-400 transition-colors"><Edit2 size={14} /></button>
                              <button onClick={() => deleteTask(task.id)} className="p-1.5 text-ink-muted hover:text-status-error transition-colors"><Trash2 size={14} /></button>
                            </div>
                          </div>

                          {openSubs.has(task.id) && (
                            <SubtasksList
                              taskId={task.id}
                              userId={user.id}
                              subtasksMap={subtasksMap}
                              onUpdate={updateSubtasks}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          )}

          {/* Edit modal (matrix view only) */}
          {editingId && viewMode === 'matrix' && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-surface-card border border-border-subtle rounded-xl w-full max-w-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-ink-primary">Görevi Düzenle</h3>
                  <button onClick={() => setEditingId(null)}
                    className="p-1.5 text-ink-muted hover:text-ink-primary transition-colors">
                    <X size={18} />
                  </button>
                </div>
                <div className="space-y-3">
                  <input autoFocus
                    value={editForm.title}
                    onChange={e => setEF('title', e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveEdit()}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border-subtle bg-white/5 text-ink-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <FormFields f={editForm} set={setEF} compact />
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setEditingId(null)}
                      className="flex-1 py-2 rounded-lg border border-border-subtle text-ink-secondary text-sm font-medium hover:bg-white/5 transition-colors">
                      İptal
                    </button>
                    <button onClick={saveEdit}
                      className="flex-1 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium transition-colors">
                      Kaydet
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Calendar tab ── */}
      {mainTab === 'calendar' && (
        <CalendarView tasks={tasks} onToggle={toggleTask} />
      )}
    </div>
  )
}
