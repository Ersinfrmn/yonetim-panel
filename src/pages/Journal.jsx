import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { format, parseISO } from 'date-fns'
import { tr } from 'date-fns/locale'
import {
  BookOpen, Save, ChevronLeft, ChevronRight,
  Eye, Pencil, Bold, Italic, List, BarChart2, Hash,
  ImagePlus, X, Loader2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmt = d => format(d, 'yyyy-MM-dd')
const display = d => format(typeof d === 'string' ? parseISO(d) : d, 'd MMMM yyyy', { locale: tr })
const wordCount = text => (text?.trim() ? text.trim().split(/\s+/).length : 0)

const MOOD_EMOJIS = ['😞', '😕', '😐', '🙂', '😊']

const PROMPTS = [
  'Bugün ne öğrendim?',
  'Minnettar olduğum 3 şey neler?',
  'Yarın ne yapmak istiyorum?',
  'Bugün ne iyi gitti?',
  'Kendime bugün ne söylemek isterim?',
  'Bugün neye odaklandım?',
  'Bugün en zorlandığım an neydi?',
  'Bu haftadan çıkardığım ders?',
  'Kendimi bugün nasıl hissettim?',
  'Yarın daha iyi yapmak istediğim bir şey?',
  'Bu ay hangi hedeflere ilerliyorum?',
  'Başarılı hissettiğim bir an?',
]

function getDailyPrompts(dateStr) {
  const d = parseISO(dateStr)
  const start = new Date(d.getFullYear(), 0, 0)
  const dayOfYear = Math.floor((d - start) / 86_400_000)
  return [0, 1, 2].map(i => PROMPTS[(dayOfYear + i) % PROMPTS.length])
}

function getImageUrl(path) {
  const { data } = supabase.storage.from('journal-images').getPublicUrl(path)
  return data.publicUrl
}

function calcStreak(entries) {
  let streak = 0
  const d = new Date()
  while (true) {
    const key = fmt(d)
    if (!entries[key]?.content?.trim()) break
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}

// Simple markdown → HTML (no external dep, user content only so dangerouslySetInnerHTML is safe)
function renderMarkdown(text) {
  if (!text) return ''
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const inline = s => {
    let r = esc(s)
    r = r.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    r = r.replace(/\*(.+?)\*/g, '<em>$1</em>')
    return r
  }
  const lines = text.split('\n')
  let html = ''
  let inList = false
  for (const line of lines) {
    if (line.startsWith('### ')) {
      if (inList) { html += '</ul>'; inList = false }
      html += `<h3 class="text-base font-bold mt-3 mb-1">${inline(line.slice(4))}</h3>`
    } else if (line.startsWith('## ')) {
      if (inList) { html += '</ul>'; inList = false }
      html += `<h2 class="text-lg font-bold mt-4 mb-1">${inline(line.slice(3))}</h2>`
    } else if (line.startsWith('# ')) {
      if (inList) { html += '</ul>'; inList = false }
      html += `<h1 class="text-xl font-bold mt-4 mb-2">${inline(line.slice(2))}</h1>`
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      if (!inList) { html += '<ul class="list-disc pl-5 my-2 space-y-0.5">'; inList = true }
      html += `<li class="leading-relaxed">${inline(line.slice(2))}</li>`
    } else {
      if (inList) { html += '</ul>'; inList = false }
      if (line.trim() === '') {
        html += '<div class="h-2"></div>'
      } else {
        html += `<p class="leading-relaxed my-1">${inline(line)}</p>`
      }
    }
  }
  if (inList) html += '</ul>'
  return html
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Journal() {
  const { user } = useAuth()
  const [entries, setEntries] = useState({})
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(fmt(new Date()))
  const [content, setContent] = useState('')
  const [mood, setMood] = useState(null)
  const [preview, setPreview] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [summaryPeriod, setSummaryPeriod] = useState(7)
  const [images, setImages] = useState([])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const saveTimer = useRef(null)
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)

  // Initial load
  useEffect(() => {
    supabase.from('journal_entries').select('*').eq('user_id', user.id)
      .then(({ data }) => {
        const map = {}
        ;(data || []).forEach(e => { map[e.date] = e })
        setEntries(map)
        const today = fmt(new Date())
        setContent(map[today]?.content || '')
        setMood(map[today]?.mood ?? null)
        setImages(map[today]?.images || [])
        setLoading(false)
      })
  }, [])

  // Reset editor when date changes (NOT on entries change — avoids mid-type resets)
  useEffect(() => {
    setContent(entries[selectedDate]?.content || '')
    setMood(entries[selectedDate]?.mood ?? null)
    setImages(entries[selectedDate]?.images || [])
    setPreview(false)
  }, [selectedDate]) // eslint-disable-line react-hooks/exhaustive-deps

  function scheduleAutosave(val, currentMood = mood) {
    setContent(val)
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => save(val, currentMood), 1500)
  }

  async function save(val = content, currentMood = mood, currentImages = images) {
    setSaving(true)
    const wc = wordCount(val)
    const payload = { content: val, mood: currentMood, word_count: wc, images: currentImages }
    const existing = entries[selectedDate]
    let result
    if (existing) {
      const { data } = await supabase
        .from('journal_entries').update(payload).eq('id', existing.id).select().single()
      result = data
    } else {
      const { data } = await supabase
        .from('journal_entries')
        .insert({ user_id: user.id, date: selectedDate, ...payload })
        .select().single()
      result = data
    }
    if (result) {
      setEntries(e => ({ ...e, [selectedDate]: result }))
      toast.success('Kaydedildi!', { duration: 1000 })
    }
    setSaving(false)
  }

  function handleMoodSelect(val) {
    const next = val === mood ? null : val
    setMood(next)
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => save(content, next), 400)
  }

  async function uploadImage(file) {
    if (!file || !file.type.startsWith('image/')) {
      toast.error('Sadece resim dosyaları yüklenebilir')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Maksimum dosya boyutu 10 MB')
      return
    }
    setUploading(true)
    const ext = file.name.split('.').pop().toLowerCase()
    const path = `${user.id}/${selectedDate}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('journal-images').upload(path, file)
    if (error) {
      toast.error('Resim yüklenemedi')
      setUploading(false)
      return
    }
    const newImages = [...images, path]
    setImages(newImages)
    await save(content, mood, newImages)
    setUploading(false)
    toast.success('Resim eklendi', { duration: 1500 })
  }

  async function deleteImage(path) {
    await supabase.storage.from('journal-images').remove([path])
    const newImages = images.filter(p => p !== path)
    setImages(newImages)
    await save(content, mood, newImages)
    toast.success('Resim silindi', { duration: 1500 })
  }

  function changeDay(delta) {
    const d = parseISO(selectedDate)
    d.setDate(d.getDate() + delta)
    if (d > new Date()) return
    setSelectedDate(fmt(d))
  }

  function insertPrompt(prompt) {
    const insert = content.trim() ? `\n\n## ${prompt}\n` : `## ${prompt}\n`
    const next = content + insert
    scheduleAutosave(next)
    textareaRef.current?.focus()
  }

  function insertMarkdown(type) {
    const ta = textareaRef.current
    if (!ta || preview) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const sel = content.slice(start, end)
    let rep = ''
    let cursorPos

    switch (type) {
      case 'bold':
        rep = `**${sel || 'metin'}**`
        cursorPos = start + (sel ? rep.length : 2)
        break
      case 'italic':
        rep = `*${sel || 'metin'}*`
        cursorPos = start + (sel ? rep.length : 1)
        break
      case 'heading':
        rep = `\n## ${sel || 'Başlık'}\n`
        cursorPos = start + rep.length
        break
      case 'list':
        rep = `\n- ${sel || 'madde'}`
        cursorPos = start + rep.length
        break
      default:
        return
    }

    const next = content.slice(0, start) + rep + content.slice(end)
    scheduleAutosave(next)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(cursorPos, cursorPos)
    })
  }

  // ─── Derived values ──────────────────────────────────────────────────────

  const entryDates = Object.keys(entries).filter(d => entries[d]?.content?.trim())
  const dailyPrompts = getDailyPrompts(selectedDate)
  const streak = calcStreak(entries)

  const chartData = Array.from({ length: summaryPeriod }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (summaryPeriod - 1 - i))
    const key = fmt(d)
    const e = entries[key]
    return {
      date: format(d, summaryPeriod <= 7 ? 'EEE' : 'dd.MM', { locale: tr }),
      mood: e?.mood ?? null,
      words: wordCount(e?.content),
    }
  })

  const allWithMood = entryDates.filter(d => entries[d]?.mood)
  const longestDate = entryDates.reduce(
    (best, d) => wordCount(entries[d]?.content) > wordCount(entries[best]?.content) ? d : best,
    entryDates[0] || ''
  )
  const happiestDate = allWithMood.reduce(
    (best, d) => (entries[d]?.mood || 0) > (entries[best]?.mood || 0) ? d : best,
    allWithMood[0] || ''
  )

  // ─── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex justify-center items-center h-48">
        <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Günlük</h2>
        <button
          onClick={() => setShowSummary(s => !s)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            showSummary
              ? 'bg-primary-600 text-white'
              : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
          }`}
        >
          <BarChart2 size={14} />
          Özet
        </button>
      </div>

      {/* ── Summary panel ─────────────────────────────────────────────────── */}
      {showSummary && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-4 mb-6">
          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">{streak}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Günlük seri</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{entryDates.length}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Toplam kayıt</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-3 text-center">
              <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">
                {longestDate ? display(longestDate) : '—'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                En uzun yazı
                {longestDate ? ` (${wordCount(entries[longestDate]?.content)}k)` : ''}
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-3 text-center">
              {happiestDate ? (
                <>
                  <p className="text-2xl">{MOOD_EMOJIS[(entries[happiestDate]?.mood || 1) - 1]}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    En mutlu — {display(happiestDate)}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-2xl text-slate-300 dark:text-slate-600">—</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">En mutlu gün</p>
                </>
              )}
            </div>
          </div>

          {/* Period toggle */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Ruh hali trendi
            </p>
            <div className="flex gap-1">
              {[7, 30].map(p => (
                <button
                  key={p}
                  onClick={() => setSummaryPeriod(p)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    summaryPeriod === p
                      ? 'bg-primary-600 text-white'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {p} gün
                </button>
              ))}
            </div>
          </div>

          {chartData.some(d => d.mood !== null) ? (
            <ResponsiveContainer width="100%" height={110}>
              <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -28 }}>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                  interval={summaryPeriod <= 7 ? 0 : Math.floor(summaryPeriod / 7)}
                />
                <YAxis
                  domain={[1, 5]}
                  ticks={[1, 2, 3, 4, 5]}
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  content={({ payload, label }) => {
                    if (!payload?.length || payload[0].value == null) return null
                    return (
                      <div className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1.5 text-xs shadow-lg">
                        <span className="text-slate-400 mr-1">{label}</span>
                        <span className="text-base">{MOOD_EMOJIS[payload[0].value - 1]}</span>
                      </div>
                    )
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="mood"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={{ fill: '#6366f1', r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 4 }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-6">
              Henüz ruh hali kaydı yok — günlük yazarken emoji seç
            </p>
          )}
        </div>
      )}

      {/* ── Date navigation ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => changeDay(-1)}
          className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1 text-center">
          <input
            type="date"
            value={selectedDate}
            max={fmt(new Date())}
            onChange={e => setSelectedDate(e.target.value)}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <p className="text-xs text-slate-400 mt-1">{display(selectedDate)}</p>
        </div>
        <button
          onClick={() => changeDay(1)}
          disabled={selectedDate === fmt(new Date())}
          className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-colors disabled:opacity-40"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* ── Daily prompts ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 mb-4">
        {dailyPrompts.map(prompt => (
          <button
            key={prompt}
            onClick={() => insertPrompt(prompt)}
            className="px-3 py-1.5 rounded-full text-xs font-medium bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-700/50 hover:bg-primary-100 dark:hover:bg-primary-800/40 transition-colors"
          >
            + {prompt}
          </button>
        ))}
      </div>

      {/* ── Mood selector ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">Bugün nasılsın?</span>
        <div className="flex gap-1">
          {MOOD_EMOJIS.map((emoji, i) => (
            <button
              key={i}
              onClick={() => handleMoodSelect(i + 1)}
              title={['Kötü', 'Üzgün', 'Nötr', 'İyi', 'Harika'][i]}
              className={`text-xl w-9 h-9 rounded-lg transition-all ${
                mood === i + 1
                  ? 'bg-primary-100 dark:bg-primary-900/40 scale-110 ring-2 ring-primary-400'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-700 opacity-50 hover:opacity-100'
              }`}
            >
              {emoji}
            </button>
          ))}
          {mood && (
            <button
              onClick={() => handleMoodSelect(null)}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 px-1 ml-1"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ── Editor card ───────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden mb-6">
        {/* Toolbar */}
        <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2 flex-wrap">
          {/* Formatting buttons */}
          <div className="flex items-center gap-0.5">
            {[
              { type: 'bold',    Icon: Bold,   title: 'Kalın' },
              { type: 'italic',  Icon: Italic, title: 'İtalik' },
              { type: 'heading', Icon: Hash,   title: 'Başlık' },
              { type: 'list',    Icon: List,   title: 'Liste' },
            ].map(({ type, Icon, title }) => (
              <button
                key={type}
                onClick={() => insertMarkdown(type)}
                disabled={preview}
                title={title}
                className="p-1.5 rounded text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-30"
              >
                <Icon size={14} />
              </button>
            ))}
          </div>

          <div className="w-px h-4 bg-slate-200 dark:bg-slate-600 mx-1" />

          <div className="flex items-center gap-1.5">
            <BookOpen size={13} className="text-slate-400" />
            <span className="text-xs text-slate-400">{wordCount(content)} kelime</span>
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            title="Resim ekle"
            className="p-1.5 rounded text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-40"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
          </button>

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => setPreview(p => !p)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                preview
                  ? 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              {preview ? <Pencil size={12} /> : <Eye size={12} />}
              {preview ? 'Düzenle' : 'Önizle'}
            </button>
            <button
              onClick={() => save()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs rounded-lg transition-colors"
            >
              <Save size={12} />
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </div>

        {/* Content area */}
        {preview ? (
          <div
            className="min-h-[350px] p-4 text-slate-700 dark:text-slate-200 text-sm"
            dangerouslySetInnerHTML={{
              __html: renderMarkdown(content) ||
                '<p class="text-slate-400 dark:text-slate-600">Önizlenecek içerik yok.</p>',
            }}
          />
        ) : (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={e => scheduleAutosave(e.target.value)}
            placeholder={`${display(selectedDate)} nasıl geçti?`}
            className="w-full min-h-[350px] p-4 bg-transparent text-slate-700 dark:text-slate-200 placeholder-slate-300 dark:placeholder-slate-600 focus:outline-none resize-none text-sm leading-relaxed"
          />
        )}
      </div>

      {/* ── Image thumbnails ──────────────────────────────────────────────── */}
      {images.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
            Görseller ({images.length})
          </p>
          <div className="flex flex-wrap gap-3">
            {images.map(path => (
              <div key={path} className="relative group">
                <a href={getImageUrl(path)} target="_blank" rel="noreferrer">
                  <img
                    src={getImageUrl(path)}
                    alt=""
                    className="w-24 h-24 object-cover rounded-xl border border-slate-200 dark:border-slate-600 hover:opacity-90 transition-opacity"
                  />
                </a>
                <button
                  onClick={() => deleteImage(path)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-24 h-24 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-600 flex flex-col items-center justify-center gap-1 text-slate-400 hover:border-primary-400 hover:text-primary-500 transition-colors disabled:opacity-40"
            >
              {uploading
                ? <Loader2 size={18} className="animate-spin" />
                : <><ImagePlus size={18} /><span className="text-xs">Ekle</span></>
              }
            </button>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) uploadImage(file)
          e.target.value = ''
        }}
      />

      {/* ── History ───────────────────────────────────────────────────────── */}
      {entryDates.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
            Geçmiş Kayıtlar
          </h3>
          <div className="space-y-2">
            {[...entryDates]
              .sort((a, b) => b.localeCompare(a))
              .slice(0, 10)
              .map(d => (
                <button
                  key={d}
                  onClick={() => setSelectedDate(d)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                    d === selectedDate
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{display(d)}</p>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {entries[d]?.mood && (
                        <span className="text-base leading-none">{MOOD_EMOJIS[entries[d].mood - 1]}</span>
                      )}
                      <span className="text-xs text-slate-400">{wordCount(entries[d]?.content)}k</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-1">
                    {entries[d]?.content?.slice(0, 90)}
                  </p>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
