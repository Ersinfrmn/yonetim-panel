import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { format, parseISO, differenceInDays } from 'date-fns'
import { tr } from 'date-fns/locale'
import { Plus, Trash2, Target, Sparkles, X } from 'lucide-react'
import toast from 'react-hot-toast'

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: 'career',    label: 'Kariyer',  emoji: '💼', bg: 'bg-blue-900/30',    text: 'text-blue-300' },
  { value: 'health',    label: 'Sağlık',   emoji: '💪', bg: 'bg-green-900/30',  text: 'text-green-300' },
  { value: 'education', label: 'Eğitim',   emoji: '📚', bg: 'bg-rose-900/30', text: 'text-rose-300' },
  { value: 'finance',   label: 'Finans',   emoji: '💰', bg: 'bg-yellow-900/30', text: 'text-yellow-300' },
  { value: 'personal',  label: 'Kişisel',  emoji: '🌱', bg: 'bg-teal-900/30',    text: 'text-teal-300' },
]

const TEMPLATES = [
  {
    key: 'english_b1',
    emoji: '🇬🇧',
    title: '3 ayda İngilizce B1',
    category: 'education',
    description: 'Günde 30 dk çalışarak B1 sertifikasına ulaş. Ölçüt: haftalık kelime testi %80+',
  },
  {
    key: 'marathon',
    emoji: '🏃',
    title: 'Maraton hazırlığı',
    category: 'health',
    description: '6 ayda 42 km koşabilecek kondisyona ulaş. Haftalık koşu planıyla kademeli artır.',
  },
  {
    key: 'book_30',
    emoji: '📖',
    title: '30 günde kitap oku',
    category: 'personal',
    description: '30 gün içinde 1 kitap bitir. Günde minimum 20 sayfa, ölçüt: son sayfaya ulaşmak.',
  },
  {
    key: 'new_skill',
    emoji: '🎯',
    title: 'Yeni beceri öğren',
    category: 'education',
    description: 'Seçtiğin bir beceride 60 günde temel yetkinlik kazan. Ölçüt: küçük proje tamamla.',
  },
]

const STATUS_CONFIG = {
  active:       { label: 'Aktif',      bg: 'bg-blue-900/30',   text: 'text-blue-300' },
  'in-progress':{ label: 'Aktif',      bg: 'bg-blue-900/30',   text: 'text-blue-300' },
  completed:    { label: 'Tamamlandı', bg: 'bg-green-900/30', text: 'text-green-300' },
  paused:       { label: 'Beklemede',  bg: 'bg-white/5',    text: 'text-ink-secondary' },
}

const EMPTY_FORM = { title: '', description: '', category: 'personal', target_date: '', template: '' }
const today = format(new Date(), 'yyyy-MM-dd')

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getCat(value) {
  return CATEGORIES.find(c => c.value === value) || CATEGORIES[4]
}

function getDaysInfo(target_date) {
  if (!target_date) return null
  const days = differenceInDays(parseISO(target_date), new Date())
  if (days < 0) return { label: `${Math.abs(days)} gün geçti`, color: 'text-red-500' }
  if (days === 0) return { label: 'Bugün son gün!', color: 'text-amber-500' }
  if (days <= 7)  return { label: `${days} gün kaldı`, color: 'text-amber-500' }
  return { label: `${days} gün kaldı`, color: 'text-ink-muted' }
}

function calcProgress(goal) {
  const startStr = goal.start_date || goal.created_at
  const endStr   = goal.target_date
  if (!startStr || !endStr) return 0
  const start = new Date(startStr).getTime()
  const end   = new Date(endStr).getTime()
  const now   = Date.now()
  if (now >= end)   return 100
  if (now <= start) return 0
  return Math.round(((now - start) / (end - start)) * 100)
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Goals() {
  const { user } = useAuth()
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [linkedTodosMap, setLinkedTodosMap] = useState({})

  useEffect(() => {
    Promise.all([
      supabase.from('goals').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('tasks').select('id, title, completed, goal_id').eq('user_id', user.id).not('goal_id', 'is', null),
    ]).then(([{ data: g }, { data: t }]) => {
      setGoals(g || [])
      const map = {}
      ;(t || []).forEach(task => {
        if (!map[task.goal_id]) map[task.goal_id] = []
        map[task.goal_id].push(task)
      })
      setLinkedTodosMap(map)
      setLoading(false)
    })
  }, [])

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async function addGoal() {
    if (!form.title.trim()) return
    // Use base schema columns only ('in-progress' matches original status check constraint)
    const { data, error } = await supabase
      .from('goals')
      .insert({
        user_id: user.id,
        title: form.title.trim(),
        description: form.description.trim(),
        target_date: form.target_date || null,
        status: 'in-progress',
      })
      .select().single()
    if (error) { console.error('addGoal:', error); toast.error('Hedef eklenemedi'); return }

    // Patch new columns (category, milestones, template) — requires migration;
    // silently skipped if migration hasn't been run yet
    const ext = { category: form.category, template: form.template || null, milestones: [] }
    const { data: patched } = await supabase.from('goals').update(ext).eq('id', data.id).select().single()

    setGoals(g => [patched ?? data, ...g])
    setForm(EMPTY_FORM)
    setShowForm(false)
    toast.success('Hedef eklendi! 🎯')
  }

  async function deleteGoal(id) {
    await supabase.from('goals').delete().eq('id', id)
    setGoals(g => g.filter(x => x.id !== id))
  }

  async function updateStatus(goal, status) {
    const patch = { status }
    if (status === 'completed' && (goal.progress ?? 0) < 100) patch.progress = 100
    const { data, error } = await supabase.from('goals').update(patch).eq('id', goal.id).select().single()
    if (error) { console.error('updateStatus:', error); return }
    if (data) setGoals(g => g.map(x => x.id === goal.id ? data : x))
  }

  function handleProgressChange(goal, newPct) {
    // Read from ref first — it's updated synchronously between onChange events,
    // unlike state which re-renders asynchronously and would cause duplicate toasts.
    // Fall back to DB milestones on first interaction with this goal.
    const already = celebratedRef.current[goal.id] ?? (goal.milestones || [])
    const newCelebrated = [...already]

    for (const [t, msg] of Object.entries(MILESTONES)) {
      const threshold = parseInt(t)
      if (newPct >= threshold && !already.includes(String(threshold))) {
        toast(msg.text, { icon: msg.icon, duration: 4000 })
        newCelebrated.push(String(threshold))
      }
    }

    // Write back to ref immediately so the next onChange tick sees updated milestones
    celebratedRef.current[goal.id] = newCelebrated

    // Optimistic state update
    setGoals(g => g.map(x => x.id === goal.id ? { ...x, progress: newPct, milestones: newCelebrated } : x))

    // Debounce Supabase write (600ms)
    clearTimeout(progressTimers.current[goal.id])
    progressTimers.current[goal.id] = setTimeout(async () => {
      const patch = { progress: newPct, milestones: newCelebrated }
      if (newPct === 100) patch.status = 'completed'
      const { data } = await supabase.from('goals').update(patch).eq('id', goal.id).select().single()
      if (data) setGoals(g => g.map(x => x.id === goal.id ? data : x))
    }, 600)
  }

  function applyTemplate(tmpl) {
    setForm({ title: tmpl.title, description: tmpl.description, category: tmpl.category, target_date: '', template: tmpl.key })
    setShowTemplates(false)
    setShowForm(true)
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const isActive = g => g.status === 'active' || g.status === 'in-progress'

  const filtered = goals.filter(g => {
    if (filter === 'all')       return true
    if (filter === 'active')    return isActive(g)
    return g.status === filter
  })

  const countFor = key => {
    if (key === 'active') return goals.filter(isActive).length
    return goals.filter(g => g.status === key).length
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex justify-center items-center h-48">
        <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold tracking-widest uppercase text-ink-primary">Hedefler</h2>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowTemplates(t => !t); setShowForm(false) }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-sm text-xs font-bold uppercase tracking-wider border transition-colors ${
              showTemplates
                ? 'bg-primary-500/15 border-primary-500/40 text-white'
                : 'border-white/20 text-white/70 hover:bg-white/5'
            }`}
          >
            <Sparkles size={14} />
            Şablonlar
          </button>
          <button
            onClick={() => { setShowForm(f => !f); setShowTemplates(false) }}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-sm text-xs font-bold uppercase tracking-wider transition-colors"
          >
            {showForm ? <X size={14} /> : <Plus size={14} />}
            {showForm ? 'İptal' : 'Hedef Ekle'}
          </button>
        </div>
      </div>

      {/* ── Template gallery ──────────────────────────────────────────────── */}
      {showTemplates && (
        <div className="mb-6 bg-surface-card/80 backdrop-blur-md border border-border-subtle rounded-xl p-4">
          <p className="text-[11px] font-medium text-ink-secondary uppercase tracking-widest mb-3">
            Hazır Şablonlar
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {TEMPLATES.map(tmpl => (
              <button
                key={tmpl.key}
                onClick={() => applyTemplate(tmpl)}
                className="text-left p-3 rounded-xl border border-border-subtle hover:border-border-glow hover:bg-primary-500/10 transition-all group"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">{tmpl.emoji}</span>
                  <span className="text-sm font-medium text-ink-primary group-hover:text-primary-300 transition-colors">
                    {tmpl.title}
                  </span>
                  <span className={`ml-auto text-xs px-1.5 py-0.5 rounded-full ${getCat(tmpl.category).bg} ${getCat(tmpl.category).text}`}>
                    {getCat(tmpl.category).label}
                  </span>
                </div>
                <p className="text-xs text-ink-muted line-clamp-2 pl-8">{tmpl.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Create form ───────────────────────────────────────────────────── */}
      {showForm && (
        <div className="mb-6 bg-surface-card/80 backdrop-blur-md border border-border-subtle rounded-xl p-5 space-y-4">
          {/* SMART chips */}
          <div className="flex gap-1.5 flex-wrap">
            {[
              ['S', 'Specific'],
              ['M', 'Measurable'],
              ['A', 'Achievable'],
              ['R', 'Relevant'],
              ['T', 'Time-bound'],
            ].map(([letter, word]) => (
              <span
                key={letter}
                className="text-[10px] px-2 py-0.5 rounded-full bg-primary-900/30 text-primary-400 font-semibold"
              >
                {letter} — {word}
              </span>
            ))}
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-1">
              Başlık
              <span className="ml-1 text-primary-400 font-normal">Specific</span>
            </label>
            <input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && addGoal()}
              placeholder="Ne tam olarak başarmak istiyorsun? Açık ve net yaz."
              className="w-full px-4 py-2.5 rounded-xl border border-border-subtle bg-white/5 text-ink-primary placeholder-ink-muted focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-1">
              Açıklama
              <span className="ml-1 text-primary-400 font-normal">Measurable · Achievable · Relevant</span>
            </label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Başarıyı nasıl ölçeceksin? Bu hedef gerçekçi mi? Neden önemli?"
              rows={2}
              className="w-full px-4 py-2.5 rounded-xl border border-border-subtle bg-white/5 text-ink-primary placeholder-ink-muted focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none text-sm"
            />
          </div>

          {/* Category + Date */}
          <div className="flex gap-3 flex-wrap">
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs font-medium text-ink-secondary mb-1">Kategori</label>
              <select
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-border-subtle bg-white/5 text-ink-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs font-medium text-ink-secondary mb-1">
                Hedef tarihi
                <span className="ml-1 text-primary-400 font-normal">Time-bound</span>
              </label>
              <input
                type="date"
                value={form.target_date}
                min={today}
                onChange={e => setForm(f => ({ ...f, target_date: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-border-subtle bg-white/5 text-ink-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={addGoal}
              disabled={!form.title.trim()}
              className="flex-1 bg-primary-500 hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
            >
              Hedef Ekle
            </button>
            <button
              onClick={() => { setForm(EMPTY_FORM); setShowForm(false) }}
              className="px-4 py-2.5 rounded-xl border border-border-subtle text-ink-secondary text-sm hover:bg-white/5 transition-colors"
            >
              İptal
            </button>
          </div>
        </div>
      )}

      {/* ── Filter tabs ───────────────────────────────────────────────────── */}
      <div className="flex gap-1 mb-5 p-1 bg-surface-card rounded-xl border border-border-subtle">
        {[
          { key: 'all',       label: 'Tümü' },
          { key: 'active',    label: 'Aktif' },
          { key: 'completed', label: 'Tamamlandı' },
          { key: 'paused',    label: 'Beklemede' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`flex-1 py-1.5 rounded-sm text-[11px] font-bold uppercase tracking-wider transition-colors ${
              filter === f.key
                ? 'bg-primary-500 text-white'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            {f.label}
            {f.key !== 'all' && (
              <span className="ml-1 opacity-60">({countFor(f.key)})</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Empty state ───────────────────────────────────────────────────── */}
      {filtered.length === 0 && (
        <div className="text-center py-20">
          <Target size={56} strokeWidth={1.5} className="mx-auto mb-4 text-white/10" />
          <p className="text-xs uppercase tracking-widest text-white/30">
            {filter === 'all' ? 'Henüz hedef yok' : 'Bu filtrede hedef yok'}
          </p>
          {filter === 'all' && (
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white text-xs font-bold uppercase tracking-wider rounded-sm transition-colors"
            >
              İlk Hedefini Ekle
            </button>
          )}
        </div>
      )}

      {/* ── Goal cards ────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        {filtered.map(goal => {
          const cat      = getCat(goal.category)
          const statusCfg = STATUS_CONFIG[goal.status] || STATUS_CONFIG.active
          const daysInfo = getDaysInfo(goal.target_date)
          const progress = goal.progress ?? 0
          const celebrated = goal.milestones || []

          return (
            <div
              key={goal.id}
              className="bg-surface-card/80 backdrop-blur-md border border-border-subtle rounded-xl hover:border-border-glow transition-colors duration-200 p-4"
            >
              {/* Card header */}
              <div className="flex items-start gap-3 mb-4">
                <span className="text-2xl mt-0.5 shrink-0">{cat.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <p className="font-semibold text-ink-primary leading-tight">{goal.title}</p>
                    <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${statusCfg.bg} ${statusCfg.text}`}>
                      {statusCfg.label}
                    </span>
                    <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${cat.bg} ${cat.text}`}>
                      {cat.label}
                    </span>
                  </div>
                  {goal.description && (
                    <p className="text-xs text-ink-secondary line-clamp-2 mt-0.5">{goal.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <select
                    value={goal.status}
                    onChange={e => updateStatus(goal, e.target.value)}
                    className="text-xs px-2 py-1 rounded-lg border border-border-subtle bg-surface-card text-ink-secondary focus:outline-none"
                  >
                    <option value="in-progress">Aktif</option>
                    <option value="paused">Beklemede</option>
                    <option value="completed">Tamamlandı</option>
                  </select>
                  <button
                    onClick={() => deleteGoal(goal.id)}
                    className="p-1.5 text-ink-muted hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {/* Progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink-secondary">İlerleme</span>
                  <span className={`text-xs font-bold tabular-nums ${
                    progress === 100 ? 'text-green-500' : 'text-primary-400'
                  }`}>
                    {progress}%
                  </span>
                </div>

                {/* Progress bar with milestone ticks */}
                <div className="relative h-2 bg-white/5 rounded-full overflow-visible">
                  <div
                    className={`absolute inset-y-0 left-0 rounded-full transition-all duration-300 ${
                      progress === 100 ? 'bg-green-500' : 'bg-primary-500'
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                  {[25, 50, 75].map(tick => (
                    <div
                      key={tick}
                      className={`absolute top-0 bottom-0 w-px rounded-full ${
                        progress >= tick
                          ? 'bg-white/70'
                          : 'bg-white/10'
                      }`}
                      style={{ left: `${tick}%` }}
                    />
                  ))}
                </div>

                {/* Slider */}
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={progress}
                  onChange={e => handleProgressChange(goal, parseInt(e.target.value))}
                  className="w-full cursor-pointer accent-primary-600"
                  style={{ height: 4, marginTop: 2 }}
                />

                {/* Earned milestone badges */}
                {celebrated.length > 0 && (
                  <div className="flex gap-1.5 mt-1 flex-wrap">
                    {celebrated
                      .slice()
                      .sort((a, b) => parseInt(a) - parseInt(b))
                      .map(m => (
                        <span
                          key={m}
                          className="text-xs px-1.5 py-0.5 rounded-full bg-status-warning/10 text-status-warning"
                        >
                          {MILESTONES[m]?.icon} {m}%
                        </span>
                      ))}
                  </div>
                )}
              </div>

              {/* Footer: date + countdown */}
              {(goal.target_date || daysInfo) && (
                <div className="mt-3 pt-3 border-t border-border-subtle flex items-center justify-between">
                  <span className="text-xs text-ink-muted">
                    {goal.target_date
                      ? format(parseISO(goal.target_date), 'd MMMM yyyy', { locale: tr })
                      : ''}
                  </span>
                  {daysInfo && goal.status !== 'completed' && (
                    <span className={`text-xs font-medium ${daysInfo.color}`}>{daysInfo.label}</span>
                  )}
                  {goal.status === 'completed' && (
                    <span className="text-xs font-medium text-green-500">✓ Tamamlandı</span>
                  )}
                </div>
              )}

              {/* BAĞLI GÖREVLER */}
              <div className="mt-3 pt-3 border-t border-border-subtle">
                <p className="text-[10px] font-medium text-ink-muted uppercase tracking-[0.15em] mb-2">Bağlı Görevler</p>
                {(linkedTodosMap[goal.id] || []).length === 0 ? (
                  <p className="text-xs text-ink-muted">Bu hedefe bağlı görev yok.</p>
                ) : (
                  <div className="space-y-1.5">
                    {(linkedTodosMap[goal.id] || []).map(task => (
                      <div key={task.id} className="flex items-center gap-2">
                        <div style={{
                          width: 12, height: 12, borderRadius: 2, flexShrink: 0,
                          border: task.completed ? 'none' : '1px solid rgba(255,255,255,0.15)',
                          background: task.completed ? '#444444' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {task.completed && <span style={{ fontSize: 7, color: '#fff', lineHeight: 1 }}>✓</span>}
                        </div>
                        <span className={`text-xs ${task.completed ? 'text-ink-muted line-through' : 'text-ink-secondary'}`}>
                          {task.title}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )
        })}
      </div>
    </div>
  )
}
