import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { format, isToday, parseISO } from 'date-fns'
import { Plus, Trash2, CheckSquare, Square, Calendar, Flag } from 'lucide-react'
import toast from 'react-hot-toast'

const PRIORITY = {
  low: { label: 'Low', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
  medium: { label: 'Medium', color: 'text-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
  high: { label: 'High', color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' },
}

const FILTERS = ['all', 'active', 'completed', 'today']

export default function Todos() {
  const { user } = useAuth()
  const [tasks, setTasks] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ title: '', due_date: '', priority: 'medium' })

  useEffect(() => {
    supabase.from('tasks').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      .then(({ data }) => { setTasks(data || []); setLoading(false) })
  }, [])

  async function addTask() {
    if (!form.title.trim()) return
    const { data, error } = await supabase
      .from('tasks')
      .insert({ ...form, user_id: user.id, completed: false, title: form.title.trim() })
      .select().single()
    if (error) { toast.error('Failed to add task'); return }
    setTasks(t => [data, ...t])
    setForm({ title: '', due_date: '', priority: 'medium' })
    toast.success('Task added!')
  }

  async function toggleTask(task) {
    const { data } = await supabase
      .from('tasks').update({ completed: !task.completed }).eq('id', task.id).select().single()
    setTasks(t => t.map(x => x.id === task.id ? data : x))
  }

  async function deleteTask(id) {
    await supabase.from('tasks').delete().eq('id', id)
    setTasks(t => t.filter(x => x.id !== id))
  }

  const filtered = tasks.filter(t => {
    if (filter === 'active') return !t.completed
    if (filter === 'completed') return t.completed
    if (filter === 'today') return t.due_date && isToday(parseISO(t.due_date))
    return true
  })

  if (loading) return <div className="text-center py-20 text-slate-400">Loading...</div>

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">To-Do List</h2>

      {/* Add form */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 mb-6 space-y-3">
        <input
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          onKeyDown={e => e.key === 'Enter' && addTask()}
          placeholder="Task title..."
          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <div className="flex gap-2 flex-wrap">
          <input
            type="date"
            value={form.due_date}
            onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
            className="flex-1 min-w-[140px] px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <select
            value={form.priority}
            onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
            className="flex-1 min-w-[120px] px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="low">Low Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="high">High Priority</option>
          </select>
          <button
            onClick={addTask}
            className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm transition-colors"
          >
            <Plus size={16} /> Add
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors whitespace-nowrap ${
              filter === f
                ? 'bg-primary-600 text-white'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            {f}
          </button>
        ))}
        <span className="ml-auto text-sm text-slate-400 self-center whitespace-nowrap">
          {filtered.filter(t => !t.completed).length} remaining
        </span>
      </div>

      {/* Task list */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <CheckSquare size={36} className="mx-auto mb-2 opacity-40" />
          <p>No tasks here!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(task => {
            const p = PRIORITY[task.priority] || PRIORITY.medium
            return (
              <div
                key={task.id}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                  task.completed
                    ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700/50'
                    : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700'
                }`}
              >
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
                  <div className="flex items-center gap-2 mt-0.5">
                    {task.due_date && (
                      <span className={`flex items-center gap-1 text-xs ${isToday(parseISO(task.due_date)) ? 'text-orange-500' : 'text-slate-400'}`}>
                        <Calendar size={12} />
                        {format(parseISO(task.due_date), 'MMM d')}
                      </span>
                    )}
                    <span className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md ${p.color} ${p.bg}`}>
                      <Flag size={10} /> {p.label}
                    </span>
                  </div>
                </div>
                <button onClick={() => deleteTask(task.id)} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors shrink-0">
                  <Trash2 size={16} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
