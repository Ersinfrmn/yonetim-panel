import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { format, isToday, parseISO, addDays, addMonths } from 'date-fns'
import { tr } from 'date-fns/locale'
import {
  Plus, Trash2, CheckSquare, Square, Calendar, Flag,
  Edit2, X, ChevronDown, ChevronUp, LayoutGrid, List as ListIcon,
  RotateCcw, Tag,
} from 'lucide-react'
import toast from 'react-hot-toast'

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIORITY = {
  low:    { label: 'Düşük',  color: 'text-blue-500',   bg: 'bg-blue-50 dark:bg-blue-900/20'    },
  medium: { label: 'Orta',   color: 'text-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
  high:   { label: 'Yüksek', color: 'text-red-500',    bg: 'bg-red-50 dark:bg-red-900/20'      },
}

const RECURRENCE = {
  none:    'Tekrar Yok',
  daily:   'Her Gün',
  weekly:  'Haftalık',
  monthly: 'Aylık',
}

const PRESET_TAGS = ['iş', 'kişisel', 'acil', 'özel']

const TAG_COLORS = {
  iş:      'bg-blue-100   text-blue-700   dark:bg-blue-900/30   dark:text-blue-300',
  kişisel: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  acil:    'bg-red-100    text-red-700    dark:bg-red-900/30    dark:text-red-300',
  özel:    'bg-green-100  text-green-700  dark:bg-green-900/30  dark:text-green-300',
}
const TAG_DEF = 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
const tagStyle = name => TAG_COLORS[name] || TAG_DEF

// Eisenhower quadrants ─ top-left, top-right, bottom-left, bottom-right
const QUADRANTS = [
  {
    id: 'q1', title: 'Acil + Önemli',        sub: 'Hemen Yap',
    border: 'border-red-300 dark:border-red-700/50',
    hdr:    'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300',
    drop:   { priority: 'high',   importance: 'important' },
  },
  {
    id: 'q2', title: 'Önemli, Acil Değil',   sub: 'Planla',
    border: 'border-blue-300 dark:border-blue-700/50',
    hdr:    'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
    drop:   { priority: 'medium', importance: 'important' },
  },
  {
    id: 'q3', title: 'Acil, Önemsiz',        sub: 'Devret',
    border: 'border-yellow-300 dark:border-yellow-700/50',
    hdr:    'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300',
    drop:   { priority: 'high',   importance: 'normal' },
  },
  {
    id: 'q4', title: 'Acil Değil, Önemsiz',  sub: 'Elemele',
    border: 'border-slate-200 dark:border-slate-600/50',
    hdr:    'bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400',
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
  importance: 'normal', recurrence: 'none', tags: [],
})

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
          className={`px-2 py-0.5 rounded-full text-xs font-medium transition-all ${tagStyle(t)} ${value.includes(t) ? 'ring-2 ring-offset-1 ring-primary-400' : 'opacity-70 hover:opacity-100'}`}>
          #{t}
        </button>
      ))}
      {customTags.map(t => (
        <span key={t} className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${TAG_DEF}`}>
          #{t}
          <button type="button" onClick={() => toggle(t)} className="hover:text-red-500 transition-colors"><X size={9} /></button>
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
        className="flex-1 min-w-[110px] px-2 py-0.5 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-transparent text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
      />
    </div>
  )
}

// ─── FormFields — shared between create form and edit modal ──────────────────

function FormFields({ f, set, compact = false }) {
  const inp = `px-3 py-${compact ? '1.5' : '2'} text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 w-full`
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
        <Tag size={13} className="text-slate-400 shrink-0" />
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
    <div className="mt-2 pt-3 border-t border-slate-100 dark:border-slate-700/60 space-y-1.5">
      {list.map(sub => (
        <div key={sub.id} className="flex items-center gap-2 group">
          <button onClick={() => toggle(sub)} className="shrink-0">
            {sub.completed
              ? <CheckSquare size={15} className="text-green-500" />
              : <Square      size={15} className="text-slate-400"  />}
          </button>
          <span className={`flex-1 text-sm ${sub.completed ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-300'}`}>
            {sub.title}
          </span>
          <button onClick={() => remove(sub.id)}
            className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all shrink-0">
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
          className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-400"
        />
        <button onClick={add}
          className="px-2.5 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 hover:bg-primary-200 dark:hover:bg-primary-900/50 transition-colors">
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
            className={`rounded-2xl border-2 overflow-hidden transition-all ${q.border} ${hoveredQ === q.id ? 'shadow-lg scale-[1.01]' : ''}`}
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
            <div className="p-2 min-h-[110px] space-y-1.5">
              {qTasks.length === 0 && (
                <p className="text-xs text-slate-400 dark:text-slate-600 text-center pt-5 select-none">Boş</p>
              )}
              {qTasks.map(task => {
                const subList = subtasksMap[task.id] || []
                const subDone = subList.filter(s => s.completed).length
                return (
                  <div key={task.id}
                    draggable
                    onDragStart={e => e.dataTransfer.setData('taskId', task.id)}
                    className="bg-white dark:bg-slate-800 rounded-xl px-3 py-2 shadow-sm border border-slate-100 dark:border-slate-700 cursor-grab active:cursor-grabbing select-none group">
                    <div className="flex items-start gap-2">
                      <button onClick={() => onToggle(task)} className="mt-0.5 shrink-0">
                        <Square size={14} className="text-slate-400 hover:text-primary-600 transition-colors" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-800 dark:text-white leading-snug">{task.title}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {task.due_date && (
                            <span className={`text-xs ${isToday(parseISO(task.due_date)) ? 'text-orange-500' : 'text-slate-400'}`}>
                              📅 {format(parseISO(task.due_date), 'd MMM', { locale: tr })}
                            </span>
                          )}
                          {(task.tags || []).map(t => (
                            <span key={t} className={`px-1.5 py-0 rounded-full text-xs font-medium ${tagStyle(t)}`}>#{t}</span>
                          ))}
                          {subList.length > 0 && (
                            <span className="text-xs text-slate-400">{subDone}/{subList.length} alt</span>
                          )}
                          {task.recurrence && task.recurrence !== 'none' && (
                            <span className="text-xs text-slate-400 flex items-center gap-0.5">
                              <RotateCcw size={9} />{RECURRENCE[task.recurrence]}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button onClick={() => onEdit(task)} className="p-1 text-slate-400 hover:text-primary-500 transition-colors"><Edit2 size={12} /></button>
                        <button onClick={() => onDelete(task.id)} className="p-1 text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={12} /></button>
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

// ─── Main component ───────────────────────────────────────────────────────────

const STATUS_FILTERS = [
  { key: 'all',       label: 'Tümü'       },
  { key: 'active',    label: 'Aktif'      },
  { key: 'completed', label: 'Tamamlanan' },
  { key: 'today',     label: 'Bugün'      },
]

export default function Todos() {
  const { user } = useAuth()
  const [tasks,        setTasks]        = useState([])
  const [subtasksMap,  setSubtasksMap]  = useState({})   // { [task_id]: subtask[] }
  const [filter,       setFilter]       = useState('all')
  const [tagFilter,    setTagFilter]    = useState(null)
  const [viewMode,     setViewMode]     = useState('list')
  const [loading,      setLoading]      = useState(true)
  const [form,         setFormState]    = useState(emptyForm)
  const [editingId,    setEditingId]    = useState(null)  // task being edited
  const [editForm,     setEditFormState] = useState({})
  const [openSubs,     setOpenSubs]     = useState(new Set()) // task ids with subtasks expanded

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

  if (loading) return <div className="text-center py-20 text-slate-400">Yükleniyor...</div>

  return (
    <div>
      {/* ── Header + view toggle ── */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Görev Listesi</h2>
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-700/60 rounded-lg p-1">
          {[
            { mode: 'list',   Icon: ListIcon,    title: 'Liste'   },
            { mode: 'matrix', Icon: LayoutGrid,  title: 'Matris'  },
          ].map(({ mode, Icon, title }) => (
            <button key={mode} onClick={() => setViewMode(mode)} title={title}
              className={`p-1.5 rounded-md transition-colors ${viewMode === mode ? 'bg-white dark:bg-slate-600 shadow text-primary-600' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
              <Icon size={16} />
            </button>
          ))}
        </div>
      </div>

      {/* ── Create form ── */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 mb-6 space-y-3">
        <div className="flex gap-2">
          <input
            value={form.title}
            onChange={e => setF('title', e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTask()}
            placeholder="Görev başlığı..."
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <button onClick={addTask}
            className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm transition-colors shrink-0">
            <Plus size={16} /> Ekle
          </button>
        </div>
        <FormFields f={form} set={setF} />
      </div>

      {/* ── Status + tag filters (list view only) ── */}
      {viewMode === 'list' && (
        <div className="mb-4 space-y-2">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {STATUS_FILTERS.map(({ key, label }) => (
              <button key={key} onClick={() => setFilter(key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  filter === key
                    ? 'bg-primary-600 text-white'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}>
                {label}
              </button>
            ))}
            <span className="ml-auto text-sm text-slate-400 self-center whitespace-nowrap">
              {filtered.filter(t => !t.completed).length} kalan
            </span>
          </div>

          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-xs text-slate-400 shrink-0">Etiket:</span>
              {tagFilter && (
                <button onClick={() => setTagFilter(null)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                  <X size={9} /> Temizle
                </button>
              )}
              {allTags.map(t => (
                <button key={t} onClick={() => setTagFilter(tagFilter === t ? null : t)}
                  className={`px-2 py-0.5 rounded-full text-xs font-medium transition-all ${tagStyle(t)} ${tagFilter === t ? 'ring-2 ring-offset-1 ring-primary-400' : 'opacity-80 hover:opacity-100'}`}>
                  #{t}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Matrix view ── */}
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

      {/* ── List view ── */}
      {viewMode === 'list' && (
        filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <CheckSquare size={36} className="mx-auto mb-2 opacity-40" />
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
                      ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700/50'
                      : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700'
                  }`}>

                  {isEditing ? (
                    /* ── Inline edit form ── */
                    <div className="p-3 space-y-2">
                      <input
                        autoFocus
                        value={editForm.title}
                        onChange={e => setEF('title', e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && saveEdit()}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <FormFields f={editForm} set={setEF} compact />
                      <div className="flex gap-2">
                        <button onClick={() => setEditingId(null)}
                          className="flex-1 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                          İptal
                        </button>
                        <button onClick={saveEdit}
                          className="flex-1 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition-colors">
                          Kaydet
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* ── Normal task row ── */
                    <div className="p-3">
                      <div className="flex items-center gap-3">
                        <button onClick={() => toggleTask(task)} className="shrink-0 text-slate-400 hover:text-primary-600 transition-colors">
                          {task.completed
                            ? <CheckSquare size={20} className="text-green-500" />
                            : <Square size={20} />
                          }
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium truncate ${task.completed ? 'line-through text-slate-400' : 'text-slate-800 dark:text-white'}`}>
                            {task.title}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                            {task.due_date && (
                              <span className={`flex items-center gap-1 text-xs ${isToday(parseISO(task.due_date)) ? 'text-orange-500' : 'text-slate-400'}`}>
                                <Calendar size={11} />
                                {format(parseISO(task.due_date), 'd MMM', { locale: tr })}
                              </span>
                            )}
                            <span className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md ${p.color} ${p.bg}`}>
                              <Flag size={10} /> {p.label}
                            </span>
                            {hasRec && (
                              <span className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
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
                                ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                            }`}
                            title="Alt görevler">
                            {subList.length > 0 && <span className="text-xs">{subDone}/{subList.length}</span>}
                            {openSubs.has(task.id) ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                          <button onClick={() => startEdit(task)} className="p-1.5 text-slate-400 hover:text-primary-500 transition-colors"><Edit2 size={14} /></button>
                          <button onClick={() => deleteTask(task.id)} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
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

      {/* ── Edit modal (matrix view only — list view uses inline form above) ── */}
      {editingId && viewMode === 'matrix' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">Görevi Düzenle</h3>
              <button onClick={() => setEditingId(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <input autoFocus
                value={editForm.title}
                onChange={e => setEF('title', e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveEdit()}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <FormFields f={editForm} set={setEF} compact />
              <div className="flex gap-2 pt-1">
                <button onClick={() => setEditingId(null)}
                  className="flex-1 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-sm font-medium transition-colors">
                  İptal
                </button>
                <button onClick={saveEdit}
                  className="flex-1 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition-colors">
                  Kaydet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
