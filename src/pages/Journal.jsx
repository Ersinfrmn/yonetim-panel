import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { format, parseISO } from 'date-fns'
import { tr } from 'date-fns/locale'
import {
  ChevronLeft, ChevronRight, BarChart2,
  ImagePlus, X, Loader2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmt     = d => format(d, 'yyyy-MM-dd')
const display = d => format(typeof d === 'string' ? parseISO(d) : d, 'd MMMM yyyy', { locale: tr })

const MOOD_EMOJIS = ['😞', '😕', '😐', '🙂', '😄']

function getImageUrl(path) {
  const { data } = supabase.storage.from('journal-images').getPublicUrl(path)
  return data.publicUrl
}

function calcStreak(entries) {
  let streak = 0
  const d = new Date()
  while (true) {
    const key = fmt(d)
    const e   = entries[key]
    if (!e || (!e.images?.length && !e.mood)) break
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Journal() {
  const { user } = useAuth()

  const [entries,        setEntries]        = useState({})
  const [loading,        setLoading]        = useState(true)
  const [selectedDate,   setSelectedDate]   = useState(fmt(new Date()))
  const [mood,           setMood]           = useState(null)
  const [images,         setImages]         = useState([])
  const [uploading,      setUploading]      = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [saving,         setSaving]         = useState(false)   // eslint-disable-line no-unused-vars
  const [showSummary,    setShowSummary]    = useState(false)
  const [summaryPeriod,  setSummaryPeriod]  = useState(7)
  const [dragging,       setDragging]       = useState(false)
  const [lightbox,       setLightbox]       = useState(null)

  const saveTimer    = useRef(null)
  const fileInputRef = useRef(null)

  // ── Escape closes lightbox ───────────────────────────────────────────────

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') setLightbox(null) }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  // ── Initial load ─────────────────────────────────────────────────────────

  useEffect(() => {
    supabase.from('journal_entries').select('*').eq('user_id', user.id)
      .then(({ data }) => {
        const map = {}
        ;(data || []).forEach(e => { map[e.date] = e })
        setEntries(map)
        const today = fmt(new Date())
        setMood(map[today]?.mood ?? null)
        setImages(map[today]?.images || [])
        setLoading(false)
      })
  }, [])

  // ── Reset when date changes ───────────────────────────────────────────────

  useEffect(() => {
    setMood(entries[selectedDate]?.mood ?? null)
    setImages(entries[selectedDate]?.images || [])
  }, [selectedDate]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Persist mood + images to DB ───────────────────────────────────────────

  async function save(currentMood = mood, currentImages = images, { notify = false } = {}) {
    setSaving(true)
    const payload  = { mood: currentMood, images: currentImages }
    const existing = entries[selectedDate]
    let result
    if (existing) {
      const { data } = await supabase
        .from('journal_entries').update(payload).eq('id', existing.id).select().single()
      result = data
    } else {
      const { data } = await supabase
        .from('journal_entries')
        .insert({ user_id: user.id, date: selectedDate, content: '', ...payload })
        .select().single()
      result = data
    }
    if (result) {
      setEntries(e => ({ ...e, [selectedDate]: result }))
      if (notify) toast.success('Kaydedildi!', { duration: 1000 })
    }
    setSaving(false)
  }

  // ── Mood ─────────────────────────────────────────────────────────────────

  function handleMoodSelect(val) {
    const next = val === mood ? null : val
    setMood(next)
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => save(next, images, { notify: true }), 400)
  }

  // ── Image upload ──────────────────────────────────────────────────────────

  async function uploadFiles(files) {
    const valid   = files.filter(f => f.type.startsWith('image/') && f.size <= 10 * 1024 * 1024)
    const invalid = files.length - valid.length
    if (invalid > 0) toast.error(`${invalid} dosya geçersiz (tür veya boyut)`)

    const slots = 5 - images.length
    if (slots <= 0) { toast.error('En fazla 5 görsel ekleyebilirsiniz'); return }

    const toUpload = valid.slice(0, slots)
    if (!toUpload.length) return

    let current = [...images]
    for (const file of toUpload) {
      setUploading(true)
      setUploadProgress(0)
      const ext  = file.name.split('.').pop().toLowerCase()
      const path = `${user.id}/${selectedDate}/${Date.now()}.${ext}`
      const { error } = await supabase.storage
        .from('journal-images')
        .upload(path, file, {
          onUploadProgress: evt => {
            if (evt.total) setUploadProgress(Math.round((evt.loaded / evt.total) * 100))
          },
        })
      if (error) {
        toast.error(`${file.name}: yüklenemedi`)
      } else {
        current = [...current, path]
        setImages(current)
      }
    }
    setUploading(false)
    setUploadProgress(0)
    await save(mood, current)
    toast.success(
      toUpload.length === 1 ? 'Görsel eklendi' : `${toUpload.length} görsel eklendi`,
      { duration: 1500 },
    )
  }

  async function deleteImage(path) {
    await supabase.storage.from('journal-images').remove([path])
    const next = images.filter(p => p !== path)
    setImages(next)
    await save(mood, next)
    toast.success('Görsel silindi', { duration: 1500 })
  }

  // ── Date navigation ───────────────────────────────────────────────────────

  function changeDay(delta) {
    const d = parseISO(selectedDate)
    d.setDate(d.getDate() + delta)
    if (d > new Date()) return
    setSelectedDate(fmt(d))
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const entryDates = Object.keys(entries).filter(d => {
    const e = entries[d]
    return e?.images?.length > 0 || e?.mood
  })

  const streak = calcStreak(entries)

  const mostImagesDate = entryDates.reduce(
    (best, d) => (entries[d]?.images?.length || 0) > (entries[best]?.images?.length || 0) ? d : best,
    entryDates[0] || '',
  )

  const allWithMood  = entryDates.filter(d => entries[d]?.mood)
  const happiestDate = allWithMood.reduce(
    (best, d) => (entries[d]?.mood || 0) > (entries[best]?.mood || 0) ? d : best,
    allWithMood[0] || '',
  )

  const chartData = Array.from({ length: summaryPeriod }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (summaryPeriod - 1 - i))
    const key = fmt(d)
    const e   = entries[key]
    return {
      date: format(d, summaryPeriod <= 7 ? 'EEE' : 'dd.MM', { locale: tr }),
      mood: e?.mood ?? null,
    }
  })

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

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-ink-primary">Günlük</h2>
        <button
          onClick={() => setShowSummary(s => !s)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            showSummary
              ? 'bg-primary-500 text-white'
              : 'bg-white/5 border border-border-subtle text-ink-secondary hover:bg-white/10 hover:border-border-glow'
          }`}
        >
          <BarChart2 size={14} />
          Özet
        </button>
      </div>

      {/* ── Summary panel ─────────────────────────────────────────────────── */}
      {showSummary && (
        <div className="bg-surface-card/80 backdrop-blur-md border border-border-subtle rounded-xl p-4 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <div className="bg-white/5 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-primary-400">{streak}</p>
              <p className="text-xs text-ink-muted mt-0.5">Günlük seri</p>
            </div>
            <div className="bg-white/5 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-ink-primary">{entryDates.length}</p>
              <p className="text-xs text-ink-muted mt-0.5">Toplam giriş</p>
            </div>
            <div className="bg-white/5 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-ink-primary">
                {mostImagesDate ? (entries[mostImagesDate]?.images?.length || 0) : '—'}
              </p>
              <p className="text-xs text-ink-muted mt-0.5">
                En çok görsel
                {mostImagesDate
                  ? ` — ${format(parseISO(mostImagesDate), 'd MMM', { locale: tr })}`
                  : ''}
              </p>
            </div>
            <div className="bg-white/5 rounded-xl p-3 text-center">
              {happiestDate ? (
                <>
                  <p className="text-2xl">{MOOD_EMOJIS[(entries[happiestDate]?.mood || 1) - 1]}</p>
                  <p className="text-xs text-ink-muted mt-0.5">
                    En mutlu — {format(parseISO(happiestDate), 'd MMM', { locale: tr })}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-2xl text-ink-muted">—</p>
                  <p className="text-xs text-ink-muted mt-0.5">En mutlu gün</p>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-medium text-ink-secondary uppercase tracking-widest">
              Ruh hali trendi
            </p>
            <div className="flex gap-1">
              {[7, 30].map(p => (
                <button key={p} onClick={() => setSummaryPeriod(p)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    summaryPeriod === p
                      ? 'bg-primary-500 text-white'
                      : 'text-ink-muted hover:bg-white/5'
                  }`}>
                  {p} gün
                </button>
              ))}
            </div>
          </div>

          {chartData.some(d => d.mood !== null) ? (
            <ResponsiveContainer width="100%" height={110}>
              <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -28 }}>
                <XAxis dataKey="date"
                  tick={{ fontSize: 10, fill: '#6B6B8A' }} tickLine={false} axisLine={false}
                  interval={summaryPeriod <= 7 ? 0 : Math.floor(summaryPeriod / 7)}
                />
                <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]}
                  tick={{ fontSize: 10, fill: '#6B6B8A' }} tickLine={false} axisLine={false}
                />
                <Tooltip
                  content={({ payload, label }) => {
                    if (!payload?.length || payload[0].value == null) return null
                    return (
                      <div style={{ background: '#111128', border: '1px solid rgba(108,63,232,0.25)', borderRadius: 8, padding: '4px 8px' }}>
                        <span className="text-ink-muted text-xs mr-1">{label}</span>
                        <span className="text-base">{MOOD_EMOJIS[payload[0].value - 1]}</span>
                      </div>
                    )
                  }}
                />
                <Line type="monotone" dataKey="mood" stroke="#6C3FE8" strokeWidth={2}
                  dot={{ fill: '#6C3FE8', r: 3, strokeWidth: 0 }} activeDot={{ r: 4 }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-ink-muted text-center py-6">
              Henüz ruh hali kaydı yok — günlük eklerken emoji seçin
            </p>
          )}
        </div>
      )}

      {/* ── Date navigation ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => changeDay(-1)}
          className="p-2 rounded-lg bg-white/5 border border-border-subtle text-ink-secondary hover:bg-white/10 hover:border-border-glow transition-colors">
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1 text-center">
          <input
            type="date"
            value={selectedDate}
            max={fmt(new Date())}
            onChange={e => setSelectedDate(e.target.value)}
            className="px-4 py-2 rounded-xl border border-border-subtle bg-white/5 text-ink-primary text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <p className="text-xs text-ink-muted mt-1">{display(selectedDate)}</p>
        </div>
        <button onClick={() => changeDay(1)}
          disabled={selectedDate === fmt(new Date())}
          className="p-2 rounded-lg bg-white/5 border border-border-subtle text-ink-secondary hover:bg-white/10 transition-colors disabled:opacity-40">
          <ChevronRight size={18} />
        </button>
      </div>

      {/* ── Mood selector ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs text-ink-muted shrink-0">Bugün nasılsın?</span>
        <div className="flex gap-1">
          {MOOD_EMOJIS.map((emoji, i) => (
            <button key={i} onClick={() => handleMoodSelect(i + 1)}
              title={['Kötü', 'Üzgün', 'Nötr', 'İyi', 'Harika'][i]}
              className={`text-xl w-9 h-9 rounded-lg transition-all ${
                mood === i + 1
                  ? 'bg-primary-500/20 scale-110 ring-2 ring-primary-400'
                  : 'hover:bg-white/10 opacity-50 hover:opacity-100'
              }`}>
              {emoji}
            </button>
          ))}
          {mood && (
            <button onClick={() => handleMoodSelect(null)}
              className="text-xs text-ink-muted hover:text-ink-primary px-1 ml-1">
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ── Image upload card ─────────────────────────────────────────────── */}
      <div className="bg-surface-card/80 backdrop-blur-md border border-border-subtle rounded-xl overflow-hidden mb-6">

        {/* Existing image grid */}
        {images.length > 0 && (
          <div className="p-4 border-b border-border-subtle">
            <p className="text-[11px] font-medium text-ink-secondary uppercase tracking-widest mb-3">
              Görseller ({images.length} / 5)
            </p>
            <div className="grid grid-cols-2 gap-3">
              {images.map((path, idx) => (
                <div key={path}
                  className="relative group aspect-video rounded-xl overflow-hidden bg-white/5">
                  <img
                    src={getImageUrl(path)}
                    alt=""
                    className="w-full h-full object-cover cursor-pointer transition-opacity hover:opacity-90"
                    onClick={() => setLightbox({ images, index: idx })}
                  />
                  <button
                    onClick={() => deleteImage(path)}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 hover:bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                    <X size={12} />
                  </button>
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <span className="bg-black/50 rounded-md px-2 py-0.5 text-white text-[10px] font-medium">
                      Büyüt
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload zone */}
        {images.length < 5 ? (
          <div
            onDragOver={e => { e.preventDefault(); if (!uploading) setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => {
              e.preventDefault()
              setDragging(false)
              if (!uploading) uploadFiles(Array.from(e.dataTransfer.files))
            }}
            onClick={() => { if (!uploading) fileInputRef.current?.click() }}
            className={`m-4 border-2 border-dashed rounded-xl py-12 px-6 flex flex-col items-center justify-center gap-2 select-none transition-colors ${
              uploading
                ? 'border-border-subtle cursor-default'
                : dragging
                  ? 'border-primary-400 bg-primary-500/10 cursor-copy'
                  : 'border-border-subtle cursor-pointer hover:border-border-glow hover:bg-primary-500/5'
            }`}
          >
            {uploading ? (
              <>
                <Loader2 size={38} className="animate-spin text-primary-400 mb-1" />
                <p className="text-sm font-medium text-ink-muted">Yükleniyor...</p>
                {uploadProgress > 0 && (
                  <div className="w-44 mt-2">
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-500 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-center text-ink-muted mt-1">%{uploadProgress}</p>
                  </div>
                )}
              </>
            ) : (
              <>
                <ImagePlus
                  size={40}
                  className={`mb-1 transition-colors ${dragging ? 'text-primary-400' : 'text-ink-muted'}`}
                />
                <p className="text-sm font-semibold text-ink-secondary text-center">
                  {dragging ? 'Bırakın!' : 'Günlük görselinizi yükleyin'}
                </p>
                <p className="text-xs text-ink-muted text-center">
                  Tablet ekran görüntüsü veya fotoğraf — JPG, PNG, WEBP
                </p>
                {images.length > 0 && (
                  <p className="text-xs text-primary-400 mt-1">
                    {5 - images.length} görsel daha ekleyebilirsiniz
                  </p>
                )}
              </>
            )}
          </div>
        ) : (
          <p className="text-xs text-ink-muted text-center py-5">
            Maksimum görsel sayısına ulaşıldı (5 / 5)
          </p>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/*"
        multiple
        className="hidden"
        onChange={e => {
          const files = Array.from(e.target.files || [])
          if (files.length) uploadFiles(files)
          e.target.value = ''
        }}
      />

      {/* ── Past entries list ─────────────────────────────────────────────── */}
      {entryDates.length > 0 && (
        <div>
          <h3 className="text-[11px] font-medium text-ink-secondary uppercase tracking-widest mb-3">
            Geçmiş Kayıtlar
          </h3>
          <div className="space-y-2">
            {[...entryDates]
              .sort((a, b) => b.localeCompare(a))
              .slice(0, 10)
              .map(d => {
                const entry    = entries[d]
                const firstImg = entry?.images?.[0]
                const imgCount = entry?.images?.length || 0
                return (
                  <button
                    key={d}
                    onClick={() => setSelectedDate(d)}
                    className={`w-full text-left px-3 py-3 rounded-xl border transition-colors flex items-center gap-3 ${
                      d === selectedDate
                        ? 'border-primary-500 bg-primary-500/10'
                        : 'border-border-subtle bg-surface-card/80 hover:border-border-glow hover:bg-white/5'
                    }`}
                  >
                    {/* Thumbnail */}
                    <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-white/5 flex items-center justify-center">
                      {firstImg
                        ? <img src={getImageUrl(firstImg)} alt="" className="w-full h-full object-cover" />
                        : <ImagePlus size={16} className="text-ink-muted" />
                      }
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="text-sm font-medium text-ink-primary truncate">
                          {display(d)}
                        </p>
                        {entry?.mood && (
                          <span className="text-base leading-none shrink-0 ml-2">
                            {MOOD_EMOJIS[entry.mood - 1]}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-ink-muted">
                        {imgCount > 0 ? `${imgCount} görsel` : 'Görsel yok'}
                      </p>
                    </div>
                  </button>
                )
              })}
          </div>
        </div>
      )}

      {/* ── Lightbox ──────────────────────────────────────────────────────── */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.92)' }}
          onClick={e => e.target === e.currentTarget && setLightbox(null)}
        >
          {lightbox.images.length > 1 && (
            <div className="absolute top-4 left-4 bg-black/50 rounded-full px-3 py-1 text-white text-xs font-medium pointer-events-none">
              {lightbox.index + 1} / {lightbox.images.length}
            </div>
          )}

          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X size={22} />
          </button>

          {lightbox.images.length > 1 && (
            <button
              onClick={e => {
                e.stopPropagation()
                setLightbox(l => ({
                  ...l,
                  index: (l.index - 1 + l.images.length) % l.images.length,
                }))
              }}
              className="absolute left-4 z-10 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <ChevronLeft size={28} />
            </button>
          )}

          <img
            src={getImageUrl(lightbox.images[lightbox.index])}
            alt=""
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
            onClick={e => e.stopPropagation()}
          />

          {lightbox.images.length > 1 && (
            <button
              onClick={e => {
                e.stopPropagation()
                setLightbox(l => ({
                  ...l,
                  index: (l.index + 1) % l.images.length,
                }))
              }}
              className="absolute right-4 z-10 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <ChevronRight size={28} />
            </button>
          )}

          {lightbox.images.length > 1 && (
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2">
              {lightbox.images.map((_, i) => (
                <button
                  key={i}
                  onClick={e => { e.stopPropagation(); setLightbox(l => ({ ...l, index: i })) }}
                  className={`rounded-full transition-all ${
                    i === lightbox.index
                      ? 'w-3 h-3 bg-white'
                      : 'w-2 h-2 bg-white/35 hover:bg-white/60'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  )
}
