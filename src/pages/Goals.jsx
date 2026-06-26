import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { format, parseISO } from 'date-fns'
import { tr } from 'date-fns/locale'
import { Plus, Trash2, Target, Check, ChevronDown, ChevronUp } from 'lucide-react'
import toast from 'react-hot-toast'

const STATUS_STYLES = {
  'in-progress': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  completed:     'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
}

const STATUS_LABELS = {
  'in-progress': 'Devam Ediyor',
  completed:     'Tamamlandı',
}

const TYPE_LABELS = {
  weekly:  'Haftalık',
  monthly: 'Aylık',
}

export default function Goals() {
  const { user } = useAuth()
  const [goals, setGoals] = useState([])
  const [goalTasks, setGoalTasks] = useState([])
  const [expanded, setExpanded] = useState({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', type: 'weekly', target_date: '', status: 'in-progress' })
  const [newTaskText, setNewTaskText] = useState({})

  useEffect(() => {
    Promise.all([
      supabase.from('goals').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('goal_tasks').select('*'),
    ]).then(([{ data: g }, { data: gt }]) => {
      setGoals(g || [])
      setGoalTasks(gt || [])
      setLoading(false)
    })
  }, [])

  async function addGoal() {
    if (!form.title.trim()) return
    const { data, error } = await supabase
      .from('goals').insert({ ...form, user_id: user.id, title: form.title.trim() }).select().single()
    if (error) { toast.error('Hedef eklenemedi'); return }
    setGoals(g => [data, ...g])
    setForm({ title: '', description: '', type: 'weekly', target_date: '', status: 'in-progress' })
    setShowForm(false)
    toast.success('Hedef eklendi!')
  }

  async function deleteGoal(id) {
    await supabase.from('goal_tasks').delete().eq('goal_id', id)
    await supabase.from('goals').delete().eq('id', id)
    setGoals(g => g.filter(x => x.id !== id))
    setGoalTasks(gt => gt.filter(x => x.goal_id !== id))
  }

  async function updateStatus(goal, status) {
    const { data } = await supabase.from('goals').update({ status }).eq('id', goal.id).select().single()
    setGoals(g => g.map(x => x.id === goal.id ? data : x))
  }

  async function addSubTask(goalId) {
    const text = newTaskText[goalId]?.trim()
    if (!text) return
    const { data } = await supabase
      .from('goal_tasks').insert({ goal_id: goalId, title: text, completed: false }).select().single()
    setGoalTasks(gt => [...gt, data])
    setNewTaskText(t => ({ ...t, [goalId]: '' }))
  }

  async function toggleSubTask(task) {
    const { data } = await supabase
      .from('goal_tasks').update({ completed: !task.completed }).eq('id', task.id).select().single()
    setGoalTasks(gt => gt.map(x => x.id === task.id ? data : x))
  }

  async function deleteSubTask(id) {
    await supabase.from('goal_tasks').delete().eq('id', id)
    setGoalTasks(gt => gt.filter(x => x.id !== id))
  }

  if (loading) return <div className="text-center py-20 text-slate-400">Yükleniyor...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Hedefler</h2>
        <button
          onClick={() => setShowForm(f => !f)}
          className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-xl text-sm flex items-center gap-2 transition-colors"
        >
          <Plus size={16} /> Hedef Ekle
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 mb-6 space-y-3">
          <input
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Hedef başlığı..."
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Açıklama (isteğe bağlı)..."
            rows={2}
            className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none text-sm"
          />
          <div className="flex gap-2 flex-wrap">
            <select
              value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              className="flex-1 min-w-[120px] px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="weekly">Haftalık</option>
              <option value="monthly">Aylık</option>
            </select>
            <input
              type="date"
              value={form.target_date}
              onChange={e => setForm(f => ({ ...f, target_date: e.target.value }))}
              className="flex-1 min-w-[140px] px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <button
              onClick={addGoal}
              className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
            >
              Kaydet
            </button>
          </div>
        </div>
      )}

      {goals.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Target size={40} className="mx-auto mb-3 opacity-40" />
          <p>Henüz hedef yok. Bir tane belirleyin!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {goals.map(goal => {
            const tasks = goalTasks.filter(t => t.goal_id === goal.id)
            const done = tasks.filter(t => t.completed).length
            const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0
            const isExpanded = expanded[goal.id]
            return (
              <div key={goal.id} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-800 dark:text-white">{goal.title}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[goal.status] || STATUS_STYLES['in-progress']}`}>
                          {STATUS_LABELS[goal.status] || goal.status}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                          {TYPE_LABELS[goal.type] || goal.type}
                        </span>
                      </div>
                      {goal.description && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{goal.description}</p>}
                      {goal.target_date && (
                        <p className="text-xs text-slate-400 mt-1">
                          Hedef tarih: {format(parseISO(goal.target_date), 'd MMMM yyyy', { locale: tr })}
                        </p>
                      )}
                      {tasks.length > 0 && (
                        <div className="mt-2">
                          <div className="flex justify-between text-xs text-slate-400 mb-1">
                            <span>{done}/{tasks.length} alt görev</span>
                            <span>{pct}%</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary-500 rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <select
                        value={goal.status}
                        onChange={e => updateStatus(goal, e.target.value)}
                        className="text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none"
                      >
                        <option value="in-progress">Devam Ediyor</option>
                        <option value="completed">Tamamlandı</option>
                      </select>
                      <button onClick={() => setExpanded(e => ({ ...e, [goal.id]: !e[goal.id] }))} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                      <button onClick={() => deleteGoal(goal.id)} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-slate-100 dark:border-slate-700 p-4 space-y-2">
                    {tasks.map(task => (
                      <div key={task.id} className="flex items-center gap-2">
                        <button
                          onClick={() => toggleSubTask(task)}
                          className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                            task.completed ? 'bg-green-500 border-green-500 text-white' : 'border-slate-300 dark:border-slate-500'
                          }`}
                        >
                          {task.completed && <Check size={12} />}
                        </button>
                        <span className={`flex-1 text-sm ${task.completed ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-300'}`}>
                          {task.title}
                        </span>
                        <button onClick={() => deleteSubTask(task.id)} className="text-slate-300 hover:text-red-400 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    <div className="flex gap-2 mt-2">
                      <input
                        value={newTaskText[goal.id] || ''}
                        onChange={e => setNewTaskText(t => ({ ...t, [goal.id]: e.target.value }))}
                        onKeyDown={e => e.key === 'Enter' && addSubTask(goal.id)}
                        placeholder="Alt görev ekle..."
                        className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <button
                        onClick={() => addSubTask(goal.id)}
                        className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg text-sm transition-colors"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
