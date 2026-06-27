import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { subDays, format, parseISO, startOfWeek, startOfMonth } from 'date-fns'
import { tr } from 'date-fns/locale'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, ComposedChart, Scatter,
} from 'recharts'
import { Flame, CheckSquare, BookOpen, Timer, Trophy, Download } from 'lucide-react'

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = d => format(d, 'yyyy-MM-dd')

function linReg(pts) {
  const n = pts.length
  if (n < 2) return null
  const sx  = pts.reduce((a, p) => a + p.x, 0)
  const sy  = pts.reduce((a, p) => a + p.y, 0)
  const sxy = pts.reduce((a, p) => a + p.x * p.y, 0)
  const sx2 = pts.reduce((a, p) => a + p.x * p.x, 0)
  const den = n * sx2 - sx * sx
  if (!den) return null
  const m = (n * sxy - sx * sy) / den
  const b = (sy - m * sx) / n
  return { m, b }
}

const MOOD = { 1: '😞', 2: '😕', 3: '😐', 4: '🙂', 5: '😄' }
const pColor = p => p >= 100 ? '#22c55e' : p >= 67 ? '#6366f1' : p >= 34 ? '#eab308' : '#ef4444'

function MoodTick({ x, y, payload }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={-4} y={0} dy={5} textAnchor="end" fill="#888888" fontSize={13}>
        {MOOD[payload.value]}
      </text>
    </g>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Stats() {
  const { user } = useAuth()
  const [data,          setData]          = useState(null)
  const [extras,        setExtras]        = useState(null)
  const [habitMoodCorr, setHabitMoodCorr] = useState(null)

  // ── Existing data load (unchanged) ────────────────────────────────────────

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
        supabase.from('habits').select('id,name,target_days').eq('user_id', user.id),
        supabase.from('habit_logs').select('*').eq('user_id', user.id).eq('completed', true),
        supabase.from('tasks').select('*').eq('user_id', user.id),
        supabase.from('journal_entries').select('date').eq('user_id', user.id),
        supabase.from('pomodoro_sessions').select('*').eq('user_id', user.id).eq('completed', true),
      ])

      const last7 = Array.from({ length: 7 }, (_, i) => {
        const d   = subDays(today, 6 - i)
        const ds  = fmt(d)
        const dow = d.getDay()
        const done  = (habitLogs || []).filter(l => l.date === ds).length
        // Denominator = habits that target this specific day of week
        const total = (habits || []).filter(h => (h.target_days ?? [0,1,2,3,4,5,6]).includes(dow)).length
        return {
          day:  format(d, 'EEE', { locale: tr }),
          rate: total ? Math.round((done / total) * 100) : 0,
          done,
        }
      })

      const weekStart   = startOfWeek(today, { locale: tr })
      const monthStart  = startOfMonth(today)
      const completedTasks  = (tasks || []).filter(t => t.completed)
      const tasksThisWeek   = completedTasks.filter(t => t.created_at && parseISO(t.created_at) >= weekStart).length
      const tasksThisMonth  = completedTasks.filter(t => t.created_at && parseISO(t.created_at) >= monthStart).length

      const journalDates = new Set((journals || []).map(j => j.date))
      let journalStreak = 0
      let cur = today
      while (journalDates.has(fmt(cur))) { journalStreak++; cur = subDays(cur, 1) }

      const todayStr = fmt(today)
      const pomoToday = (pomodoros || []).filter(p => p.started_at?.startsWith(todayStr)).length
      const pomoWeek  = (pomodoros || []).filter(p => p.started_at && parseISO(p.started_at) >= weekStart).length

      const last30 = Array.from({ length: 30 }, (_, i) => {
        const d   = subDays(today, 29 - i)
        const ds  = fmt(d)
        const dow = d.getDay()
        const done  = (habitLogs || []).filter(l => l.date === ds).length
        // Denominator = habits that target this specific day of week
        const total = (habits || []).filter(h => (h.target_days ?? [0,1,2,3,4,5,6]).includes(dow)).length
        return { day: format(d, 'd MMM', { locale: tr }), rate: total ? Math.round((done / total) * 100) : 0 }
      }).filter((_, i) => i % 5 === 4)

      setData({ last7, last30, tasksThisWeek, tasksThisMonth, journalStreak, pomoToday, pomoWeek, habitCount: (habits || []).length })
    }
    load()
  }, [])

  // ── New extras data load ──────────────────────────────────────────────────

  useEffect(() => {
    async function loadExtras() {
      const today       = new Date()
      const ago30       = format(subDays(today, 29), 'yyyy-MM-dd')

      const [
        { data: goals },
        { data: moodEntries },
        { data: recentLogs },
        { data: pomoDone },
      ] = await Promise.all([
        supabase.from('goals')
          .select('id,title,progress,status,target_date,category')
          .eq('user_id', user.id)
          .neq('status', 'completed'),
        supabase.from('journal_entries')
          .select('date,mood')
          .eq('user_id', user.id)
          .gte('date', ago30)
          .not('mood', 'is', null),
        supabase.from('habit_logs')
          .select('date')
          .eq('user_id', user.id)
          .eq('completed', true)
          .gte('date', ago30),
        // Catch both old (completed) and new (was_completed) sessions
        supabase.from('pomodoro_sessions')
          .select('started_at,completed_at,was_completed,completed')
          .eq('user_id', user.id),
      ])

      // ── Habit × Mood correlation ──────────────────────────────────────────

      const habitCountByDate = {}
      ;(recentLogs || []).forEach(l => {
        habitCountByDate[l.date] = (habitCountByDate[l.date] || 0) + 1
      })

      const rawPts = (moodEntries || []).map(e => ({
        x: habitCountByDate[e.date] || 0,
        y: e.mood,
      }))

      const reg = linReg(rawPts)

      const correlationData = [...rawPts]
        .sort((a, b) => a.x - b.x)
        .map(p => ({
          ...p,
          trend: reg ? Math.max(1, Math.min(5, reg.m * p.x + reg.b)) : null,
        }))

      // ── Best pomodoro day ─────────────────────────────────────────────────

      const dateMap = {}
      ;(pomoDone || []).forEach(s => {
        const isCompleted = s.was_completed === true || s.completed === true
        if (!isCompleted) return
        const dateStr = (s.completed_at || s.started_at)?.split('T')[0]
        if (dateStr) dateMap[dateStr] = (dateMap[dateStr] || 0) + 1
      })

      const bestDay = Object.keys(dateMap).length
        ? Object.entries(dateMap).reduce((a, b) => b[1] > a[1] ? b : a)
        : null

      setExtras({
        goals:           goals || [],
        correlationData,
        hasEnoughCorr:   rawPts.length >= 5,
        bestDay:         bestDay ? { date: bestDay[0], count: bestDay[1] } : null,
      })
    }
    loadExtras()
  }, [user.id])

  // ── Per-habit mood correlation ────────────────────────────────────────────

  useEffect(() => {
    async function loadHabitMood() {
      const [
        { data: habits },
        { data: logs },
        { data: journals },
      ] = await Promise.all([
        supabase.from('habits').select('id, name').eq('user_id', user.id),
        supabase.from('habit_logs').select('habit_id, date').eq('user_id', user.id).eq('completed', true),
        supabase.from('journal_entries').select('date, mood').eq('user_id', user.id).not('mood', 'is', null),
      ])

      const moodByDate = {}
      ;(journals || []).forEach(j => { moodByDate[j.date] = j.mood })

      const moodDates = Object.keys(moodByDate)
      if (moodDates.length < 5) {
        setHabitMoodCorr({ hasEnough: false, items: [] })
        return
      }

      const logsByHabit = {}
      ;(logs || []).forEach(l => {
        if (!logsByHabit[l.habit_id]) logsByHabit[l.habit_id] = new Set()
        logsByHabit[l.habit_id].add(l.date)
      })

      const items = (habits || []).map(habit => {
        const doneDates    = logsByHabit[habit.id] || new Set()
        const doneMoods    = moodDates.filter(d =>  doneDates.has(d)).map(d => moodByDate[d])
        const notDoneMoods = moodDates.filter(d => !doneDates.has(d)).map(d => moodByDate[d])
        const avgDone    = doneMoods.length    ? doneMoods.reduce((a, b) => a + b, 0)    / doneMoods.length    : null
        const avgNotDone = notDoneMoods.length ? notDoneMoods.reduce((a, b) => a + b, 0) / notDoneMoods.length : null
        return { id: habit.id, name: habit.name, avgDone, avgNotDone, doneCount: doneMoods.length }
      }).filter(h => h.doneCount > 0)
        .sort((a, b) => b.doneCount - a.doneCount)
        .slice(0, 5)

      setHabitMoodCorr({ hasEnough: true, items })
    }
    loadHabitMood()
  }, [user.id])

  // ── CSV export ────────────────────────────────────────────────────────────

  async function downloadCSV() {
    const now        = new Date()
    const monthStart = format(startOfMonth(now), 'yyyy-MM-dd')
    const filename   = `ef-komuta-istatistikler-${format(now, 'yyyy-MM')}.csv`

    const [
      { data: sessions },
      { data: hlogs },
      { data: journals },
      { data: goals },
      { data: habits },
      { data: tasks },
    ] = await Promise.all([
      supabase.from('pomodoro_sessions')
        .select('started_at,completed_at,duration_minutes,was_completed,task_id')
        .eq('user_id', user.id)
        .gte('started_at', `${monthStart}T00:00:00`),
      supabase.from('habit_logs')
        .select('date,habit_id,completed')
        .eq('user_id', user.id)
        .gte('date', monthStart),
      supabase.from('journal_entries')
        .select('date,mood')
        .eq('user_id', user.id)
        .gte('date', monthStart),
      supabase.from('goals').select('title,progress,status,target_date').eq('user_id', user.id),
      supabase.from('habits').select('id,name').eq('user_id', user.id),
      supabase.from('tasks').select('id,title').eq('user_id', user.id),
    ])

    const habitMap = Object.fromEntries((habits || []).map(h => [h.id, h.name]))
    const taskMap  = Object.fromEntries((tasks  || []).map(t => [t.id, t.title]))
    const fmtD = s => s ? format(parseISO(s.split('T')[0]), 'dd.MM.yyyy') : ''
    const fmtT = s => s ? format(parseISO(s), 'HH:mm') : ''
    const esc  = s => `"${String(s || '').replace(/"/g, '""')}"`

    const lines = []

    lines.push('POMODORO SEANSLAR')
    lines.push('Tarih,Başlangıç,Bitiş,Süre (dk),Tamamlandı mı,Görev')
    ;(sessions || []).forEach(s => {
      lines.push([
        fmtD(s.started_at), fmtT(s.started_at), fmtT(s.completed_at),
        s.duration_minutes || '', s.was_completed ? 'Evet' : 'Hayır',
        esc(taskMap[s.task_id] || ''),
      ].join(','))
    })

    lines.push('')
    lines.push('ALIŞKANLıK TAMAMLANMALARI')
    lines.push('Tarih,Alışkanlık Adı,Tamamlandı mı')
    ;(hlogs || []).forEach(l => {
      lines.push([fmtD(l.date), esc(habitMap[l.habit_id] || ''), l.completed ? 'Evet' : 'Hayır'].join(','))
    })

    lines.push('')
    lines.push('RUH HALİ KAYITLARI')
    lines.push('Tarih,Ruh Hali (1-5)')
    ;(journals || []).filter(j => j.mood).forEach(j => {
      lines.push([fmtD(j.date), j.mood].join(','))
    })

    lines.push('')
    lines.push('HEDEF İLERLEMESİ')
    lines.push('Hedef Adı,İlerleme (%),Durum,Hedef Tarih')
    ;(goals || []).forEach(g => {
      lines.push([esc(g.title), g.progress || 0, g.status || '', fmtD(g.target_date)].join(','))
    })

    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Early return ──────────────────────────────────────────────────────────

  if (!data) return <div className="text-center py-20 text-ink-muted">İstatistikler yükleniyor...</div>

  const statCards = [
    { icon: CheckSquare, label: 'Bu hafta tamamlanan',  value: data.tasksThisWeek,       sub: `${data.tasksThisMonth} bu ay`,   color: 'text-primary-400', bg: 'bg-primary-500/10' },
    { icon: BookOpen,    label: 'Günlük serisi',         value: `${data.journalStreak}g`,  sub: 'ardışık gün',                   color: 'text-primary-400', bg: 'bg-primary-500/10' },
    { icon: Timer,       label: 'Bugünkü pomodoro',      value: data.pomoToday,            sub: `${data.pomoWeek} bu hafta`,     color: 'text-status-error',    bg: 'bg-status-error/10' },
    { icon: Flame,       label: 'Aktif alışkanlık',      value: data.habitCount,           sub: 'takip edilen alışkanlık',       color: 'text-status-warning', bg: 'bg-status-warning/10' },
  ]

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header + CSV button */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold tracking-widest uppercase text-ink-primary">İstatistikler</h2>
        <button
          onClick={downloadCSV}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border-subtle bg-white/5 text-ink-secondary text-xs font-medium hover:text-ink-primary hover:bg-white/10 transition-colors"
        >
          <Download size={14} />
          CSV İndir
        </button>
      </div>

      {/* ── Özet kartlar (unchanged) ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {statCards.map(({ icon: Icon, label, value, sub, color, bg }) => (
          <div key={label} className="bg-surface-card/80 backdrop-blur-md border border-border-subtle rounded-xl p-4 hover:border-border-glow transition-colors duration-200">
            <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mb-3`}>
              <Icon size={18} className={color} />
            </div>
            <p className="text-2xl font-bold text-ink-primary">{value}</p>
            <p className="text-xs font-medium text-ink-secondary mt-0.5">{label}</p>
            <p className="text-xs text-ink-muted mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* ── En Verimli Günüm badge ───────────────────────────────────────────── */}
      {extras && (
        <div className="mb-6 bg-surface-card/80 backdrop-blur-md border border-border-subtle rounded-xl p-4 hover:border-border-glow transition-colors duration-200">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-sm bg-primary-500/15 flex items-center justify-center shrink-0">
              <Trophy size={22} className="text-primary-400" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-primary-400 uppercase tracking-widest">En Verimli Günüm</p>
              {extras.bestDay ? (<>
                <p className="font-bold text-ink-primary text-sm mt-0.5">
                  {format(parseISO(extras.bestDay.date), 'd MMMM yyyy, EEEE', { locale: tr })}
                </p>
                <p className="text-xs text-ink-muted mt-0.5">{extras.bestDay.count} pomodoro tamamlandı</p>
              </>) : (
                <p className="text-sm text-ink-muted mt-0.5">Henüz tamamlanan pomodoro yok</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Son 7 gün alışkanlık tamamlanma oranı (unchanged) ───────────────── */}
      <div className="bg-surface-card/80 backdrop-blur-md border border-border-subtle rounded-xl p-4 hover:border-border-glow transition-colors duration-200 mb-6">
        <h3 className="text-[11px] font-semibold text-white/60 uppercase tracking-wider mb-4">Alışkanlık Tamamlanma Oranı — Son 7 Gün</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data.last7} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#888888' }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#888888' }} unit="%" />
            <Tooltip
              formatter={v => [`${v}%`, 'Tamamlanma']}
              contentStyle={{ background: '#111111', border: 'none', borderRadius: 4, color: '#ffffff' }}
            />
            <Bar dataKey="rate" fill="#b91c1c" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── 30 günlük trend (unchanged) ─────────────────────────────────────── */}
      <div className="bg-surface-card/80 backdrop-blur-md border border-border-subtle rounded-xl p-4 hover:border-border-glow transition-colors duration-200 mb-6">
        <h3 className="text-[11px] font-semibold text-white/60 uppercase tracking-wider mb-4">Alışkanlık Oranı Trendi — Son 30 Gün</h3>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data.last30} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#888888' }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#888888' }} unit="%" />
            <Tooltip
              formatter={v => [`${v}%`, 'Oran']}
              contentStyle={{ background: '#111111', border: 'none', borderRadius: 4, color: '#ffffff' }}
            />
            <Line type="monotone" dataKey="rate" stroke="#b91c1c" strokeWidth={2} dot={{ r: 3, fill: '#b91c1c' }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ── NEW: Goal Progress ───────────────────────────────────────────────── */}
      {extras && (
        <div className="bg-surface-card/80 backdrop-blur-md border border-border-subtle rounded-xl p-4 hover:border-border-glow transition-colors duration-200 mb-6">
          <h3 className="text-[11px] font-semibold text-white/60 uppercase tracking-wider mb-4">Hedef İlerlemesi</h3>
          {extras.goals.length === 0 ? (
            <p className="text-sm text-ink-muted text-center py-6">Henüz hedef eklenmedi</p>
          ) : (
            <div className="space-y-4">
              {extras.goals.map(goal => {
                const pct   = goal.progress ?? 0
                const color = pColor(pct)
                return (
                  <div key={goal.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-ink-primary truncate max-w-[75%]">
                        {goal.title}
                      </span>
                      <span className="text-xs font-semibold tabular-nums" style={{ color }}>
                        {pct}%
                      </span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: color }}
                      />
                    </div>
                    {goal.target_date && (
                      <p className="text-[11px] text-ink-muted mt-1">
                        Hedef: {format(parseISO(goal.target_date), 'd MMM yyyy', { locale: tr })}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Per-habit mood bars ──────────────────────────────────────────────── */}
      {habitMoodCorr && (
        <div className="bg-surface-card/80 backdrop-blur-md border border-border-subtle rounded-xl p-4 hover:border-border-glow transition-colors duration-200 mb-6">
          <h3 className="text-[11px] font-semibold text-white/60 uppercase tracking-wider mb-0.5">
            Alışkanlık × Ruh Hali Korelasyonu
          </h3>
          <p className="text-xs text-ink-muted mb-4">Tamamlandığında vs tamamlanmadığında ortalama ruh hali</p>
          {!habitMoodCorr.hasEnough || habitMoodCorr.items.length === 0 ? (
            <p className="text-sm text-ink-muted text-center py-8">
              Yeterli veri yok — günlük yazmaya devam et.
            </p>
          ) : (
            <div className="space-y-5">
              {habitMoodCorr.items.map(h => (
                <div key={h.id}>
                  <p className="text-xs font-medium text-ink-secondary mb-2 truncate">{h.name}</p>
                  <div className="space-y-1.5">
                    {h.avgDone !== null && (
                      <div className="flex items-center gap-2">
                        <span style={{ fontSize: 10, color: '#444444', width: 96, flexShrink: 0 }}>Tamamlandı</span>
                        <div className="flex-1 h-3.5 rounded-sm overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                          <div style={{ width: `${(h.avgDone / 5) * 100}%`, height: '100%', background: '#b91c1c', borderRadius: 2 }} />
                        </div>
                        <span className="text-xs font-semibold text-ink-secondary w-6 text-right tabular-nums">{h.avgDone.toFixed(1)}</span>
                      </div>
                    )}
                    {h.avgNotDone !== null && (
                      <div className="flex items-center gap-2">
                        <span style={{ fontSize: 10, color: '#444444', width: 96, flexShrink: 0 }}>Tamamlanmadı</span>
                        <div className="flex-1 h-3.5 rounded-sm overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                          <div style={{ width: `${(h.avgNotDone / 5) * 100}%`, height: '100%', background: '#333333', borderRadius: 2 }} />
                        </div>
                        <span className="text-xs font-semibold text-ink-secondary w-6 text-right tabular-nums">{h.avgNotDone.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── NEW: Habit × Mood Correlation (scatter) ─────────────────────────── */}
      {extras && (
        <div className="bg-surface-card/80 backdrop-blur-md border border-border-subtle rounded-xl p-4 hover:border-border-glow transition-colors duration-200 mb-6">
          <h3 className="text-[11px] font-semibold text-white/60 uppercase tracking-wider mb-0.5">
            Alışkanlık Sayısı × Ruh Hali
          </h3>
          <p className="text-xs text-ink-muted mb-4">Son 30 gün — yalnızca ruh hali girilen günler</p>

          {!extras.hasEnoughCorr ? (
            <p className="text-sm text-ink-muted text-center py-8">
              Yeterli veri yok — daha fazla günlük girişi yapın
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart
                data={extras.correlationData}
                margin={{ top: 4, right: 8, left: -4, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="x"
                  type="number"
                  label={{ value: 'Tamamlanan alışkanlık', position: 'insideBottom', offset: -2, fontSize: 10, fill: '#888888' }}
                  tick={{ fontSize: 11, fill: '#888888' }}
                  allowDecimals={false}
                  domain={['auto', 'auto']}
                />
                <YAxis
                  dataKey="y"
                  type="number"
                  domain={[0.5, 5.5]}
                  ticks={[1, 2, 3, 4, 5]}
                  tick={<MoodTick />}
                  width={32}
                />
                <Tooltip
                  contentStyle={{ background: '#111111', border: 'none', borderRadius: 4, fontSize: 12 }}
                  labelStyle={{ color: '#888888' }}
                  formatter={(value, name) => [
                    name === 'y'     ? MOOD[value] || value :
                    name === 'trend' ? `${value.toFixed(1)} (trend)` : value,
                    name === 'y' ? 'Ruh hali' : 'Trend',
                  ]}
                  labelFormatter={v => `${v} alışkanlık`}
                />
                {/* Scatter points */}
                <Scatter dataKey="y" fill="#b91c1c" opacity={0.75} name="y" />
                {/* Trend line */}
                <Line
                  type="linear"
                  dataKey="trend"
                  dot={false}
                  stroke="#f59e0b"
                  strokeWidth={2}
                  strokeDasharray="5 3"
                  name="trend"
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}

          {/* Mood legend */}
          <div className="flex gap-3 mt-3 flex-wrap justify-center">
            {[1, 2, 3, 4, 5].map(m => (
              <span key={m} className="text-xs text-ink-muted flex items-center gap-1">
                <span>{MOOD[m]}</span>
                <span>{m}</span>
              </span>
            ))}
            <span className="text-xs flex items-center gap-1 text-amber-500 ml-2">
              <span className="inline-block w-4 h-0.5 bg-amber-400" style={{ borderTop: '2px dashed #f59e0b' }} />
              trend
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
