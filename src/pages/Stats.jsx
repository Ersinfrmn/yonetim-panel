import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { subDays, format, parseISO, startOfWeek, startOfMonth } from 'date-fns'
import { tr } from 'date-fns/locale'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
} from 'recharts'
import { Flame, CheckSquare, BookOpen, Timer } from 'lucide-react'

const fmt = d => format(d, 'yyyy-MM-dd')

export default function Stats() {
  const { user } = useAuth()
  const [data, setData] = useState(null)

  useEffect(() => {
    async function load() {
      const today = new Date()
      const [
        { data: habits },
        { data: habitLogs },
        { data: tasks },
        { data: journals },
        { data: pomodoros },
      ] = await Promise.all([
        supabase.from('habits').select('id,name').eq('user_id', user.id),
        supabase.from('habit_logs').select('*').eq('user_id', user.id).eq('completed', true),
        supabase.from('tasks').select('*').eq('user_id', user.id),
        supabase.from('journal_entries').select('date').eq('user_id', user.id),
        supabase.from('pomodoro_sessions').select('*').eq('user_id', user.id).eq('completed', true),
      ])

      // Son 7 gün alışkanlık verisi
      const last7 = Array.from({ length: 7 }, (_, i) => {
        const d = subDays(today, 6 - i)
        const ds = fmt(d)
        const done = (habitLogs || []).filter(l => l.date === ds).length
        const total = (habits || []).length
        return {
          day: format(d, 'EEE', { locale: tr }),
          rate: total ? Math.round((done / total) * 100) : 0,
          done,
        }
      })

      // Bu hafta / bu ay tamamlanan görevler
      const weekStart = startOfWeek(today, { locale: tr })
      const monthStart = startOfMonth(today)
      const completedTasks = (tasks || []).filter(t => t.completed)
      const tasksThisWeek = completedTasks.filter(t =>
        t.created_at && parseISO(t.created_at) >= weekStart
      ).length
      const tasksThisMonth = completedTasks.filter(t =>
        t.created_at && parseISO(t.created_at) >= monthStart
      ).length

      // Günlük serisi
      const journalDates = new Set((journals || []).map(j => j.date))
      let journalStreak = 0
      let cur = today
      while (journalDates.has(fmt(cur))) {
        journalStreak++
        cur = subDays(cur, 1)
      }

      // Pomodoro bugün / bu hafta
      const todayStr = fmt(today)
      const pomoToday = (pomodoros || []).filter(p => p.started_at?.startsWith(todayStr)).length
      const pomoWeek = (pomodoros || []).filter(p => p.started_at && parseISO(p.started_at) >= weekStart).length

      // Son 30 günlük alışkanlık oranı (her 5 günde bir örnek)
      const last30 = Array.from({ length: 30 }, (_, i) => {
        const d = subDays(today, 29 - i)
        const ds = fmt(d)
        const done = (habitLogs || []).filter(l => l.date === ds).length
        const total = (habits || []).length
        return { day: format(d, 'd MMM', { locale: tr }), rate: total ? Math.round((done / total) * 100) : 0 }
      }).filter((_, i) => i % 5 === 4)

      setData({ last7, last30, tasksThisWeek, tasksThisMonth, journalStreak, pomoToday, pomoWeek, habitCount: (habits || []).length })
    }
    load()
  }, [])

  if (!data) return <div className="text-center py-20 text-slate-400">İstatistikler yükleniyor...</div>

  const statCards = [
    { icon: CheckSquare, label: 'Bu hafta tamamlanan',  value: data.tasksThisWeek,  sub: `${data.tasksThisMonth} bu ay`,         color: 'text-blue-500',   bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { icon: BookOpen,    label: 'Günlük serisi',         value: `${data.journalStreak}g`, sub: 'ardışık gün',                   color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20' },
    { icon: Timer,       label: 'Bugünkü pomodoro',      value: data.pomoToday,      sub: `${data.pomoWeek} bu hafta`,           color: 'text-red-500',    bg: 'bg-red-50 dark:bg-red-900/20' },
    { icon: Flame,       label: 'Aktif alışkanlık',      value: data.habitCount,     sub: 'takip edilen alışkanlık',             color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20' },
  ]

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">İstatistikler</h2>

      {/* Özet kartlar */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        {statCards.map(({ icon: Icon, label, value, sub, color, bg }) => (
          <div key={label} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
            <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mb-3`}>
              <Icon size={18} className={color} />
            </div>
            <p className="text-2xl font-bold text-slate-800 dark:text-white">{value}</p>
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-0.5">{label}</p>
            <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Son 7 gün alışkanlık tamamlanma oranı */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 mb-6">
        <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-4">Alışkanlık Tamamlanma Oranı — Son 7 Gün</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data.last7} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#94a3b8' }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#94a3b8' }} unit="%" />
            <Tooltip
              formatter={v => [`${v}%`, 'Tamamlanma']}
              contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#f8fafc' }}
            />
            <Bar dataKey="rate" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 30 günlük trend */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
        <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-4">Alışkanlık Oranı Trendi — Son 30 Gün</h3>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data.last30} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#94a3b8' }} unit="%" />
            <Tooltip
              formatter={v => [`${v}%`, 'Oran']}
              contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#f8fafc' }}
            />
            <Line type="monotone" dataKey="rate" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 3, fill: '#0ea5e9' }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
