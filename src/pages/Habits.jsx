import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { format, subDays, parseISO, differenceInCalendarDays } from 'date-fns'
import { Plus, Trash2, Flame, Check } from 'lucide-react'
import toast from 'react-hot-toast'

const today = () => format(new Date(), 'yyyy-MM-dd')

function getStreak(logs, habitId) {
  const dates = logs
    .filter(l => l.habit_id === habitId && l.completed)
    .map(l => l.date)
    .sort((a, b) => b.localeCompare(a))

  if (!dates.length) return 0
  let streak = 0
  let current = today()
  for (const d of dates) {
    if (d === current) {
      streak++
      current = format(subDays(parseISO(current), 1), 'yyyy-MM-dd')
    } else break
  }
  return streak
}

function HeatmapGrid({ logs, habitId }) {
  const days = Array.from({ length: 35 }, (_, i) =>
    format(subDays(new Date(), 34 - i), 'yyyy-MM-dd')
  )
  const done = new Set(
    logs.filter(l => l.habit_id === habitId && l.completed).map(l => l.date)
  )
  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {days.map(d => (
        <div
          key={d}
          title={d}
          className={`w-4 h-4 rounded-sm heatmap-cell ${
            done.has(d)
              ? 'bg-primary-500'
              : 'bg-slate-200 dark:bg-slate-600'
          }`}
        />
      ))}
    </div>
  )
}

export default function Habits() {
  const { user } = useAuth()
  const [habits, setHabits] = useState([])
  const [logs, setLogs] = useState([])
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(true)

  async function load() {
    const [{ data: h }, { data: l }] = await Promise.all([
      supabase.from('habits').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('habit_logs').select('*').eq('user_id', user.id),
    ])
    setHabits(h || [])
    setLogs(l || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function addHabit() {
    if (!newName.trim()) return
    const { data, error } = await supabase
      .from('habits')
      .insert({ user_id: user.id, name: newName.trim() })
      .select()
      .single()
    if (error) { toast.error('Failed to add habit'); return }
    setHabits(h => [...h, data])
    setNewName('')
    toast.success('Habit added!')
  }

  async function deleteHabit(id) {
    await supabase.from('habit_logs').delete().eq('habit_id', id)
    await supabase.from('habits').delete().eq('id', id)
    setHabits(h => h.filter(x => x.id !== id))
    setLogs(l => l.filter(x => x.habit_id !== id))
    toast.success('Habit deleted')
  }

  async function toggleToday(habit) {
    const t = today()
    const existing = logs.find(l => l.habit_id === habit.id && l.date === t)
    if (existing) {
      await supabase.from('habit_logs').delete().eq('id', existing.id)
      setLogs(l => l.filter(x => x.id !== existing.id))
    } else {
      const { data } = await supabase
        .from('habit_logs')
        .insert({ habit_id: habit.id, user_id: user.id, date: t, completed: true })
        .select().single()
      setLogs(l => [...l, data])
    }
  }

  if (loading) return <div className="text-center py-20 text-slate-400">Loading...</div>

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">Habit Tracker</h2>

      {/* Add habit */}
      <div className="flex gap-2 mb-6">
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addHabit()}
          placeholder="New habit name..."
          className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <button
          onClick={addHabit}
          className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 transition-colors"
        >
          <Plus size={18} /> Add
        </button>
      </div>

      {habits.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Flame size={40} className="mx-auto mb-3 opacity-40" />
          <p>No habits yet. Add one above!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {habits.map(habit => {
            const streak = getStreak(logs, habit.id)
            const doneToday = logs.some(l => l.habit_id === habit.id && l.date === today() && l.completed)
            return (
              <div key={habit.id} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleToday(habit)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors shrink-0 ${
                      doneToday
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'border-slate-300 dark:border-slate-500 hover:border-primary-500'
                    }`}
                  >
                    {doneToday && <Check size={16} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 dark:text-white truncate">{habit.name}</p>
                  </div>
                  <div className="flex items-center gap-1 text-orange-500 shrink-0">
                    <Flame size={16} />
                    <span className="text-sm font-bold">{streak}</span>
                  </div>
                  <button
                    onClick={() => deleteHabit(habit.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <HeatmapGrid logs={logs} habitId={habit.id} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
