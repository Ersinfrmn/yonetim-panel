import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { format, parseISO } from 'date-fns'
import { tr } from 'date-fns/locale'
import { BookOpen, Save, ChevronLeft, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'

const fmt = d => format(d, 'yyyy-MM-dd')
const display = d => format(typeof d === 'string' ? parseISO(d) : d, 'd MMMM yyyy', { locale: tr })

export default function Journal() {
  const { user } = useAuth()
  const [entries, setEntries] = useState({})
  const [selectedDate, setSelectedDate] = useState(fmt(new Date()))
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const saveTimer = useRef(null)

  useEffect(() => {
    supabase.from('journal_entries').select('*').eq('user_id', user.id)
      .then(({ data }) => {
        const map = {}
        ;(data || []).forEach(e => { map[e.date] = e })
        setEntries(map)
        setContent(map[fmt(new Date())]?.content || '')
      })
  }, [])

  useEffect(() => {
    setContent(entries[selectedDate]?.content || '')
  }, [selectedDate, entries])

  function scheduleAutosave(val) {
    setContent(val)
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => save(val), 1500)
  }

  async function save(val = content) {
    setSaving(true)
    const existing = entries[selectedDate]
    let result
    if (existing) {
      const { data } = await supabase
        .from('journal_entries').update({ content: val }).eq('id', existing.id).select().single()
      result = data
    } else {
      const { data } = await supabase
        .from('journal_entries')
        .insert({ user_id: user.id, date: selectedDate, content: val })
        .select().single()
      result = data
    }
    if (result) {
      setEntries(e => ({ ...e, [selectedDate]: result }))
      toast.success('Kaydedildi!', { duration: 1000 })
    }
    setSaving(false)
  }

  function changeDay(delta) {
    const d = parseISO(selectedDate)
    d.setDate(d.getDate() + delta)
    if (d > new Date()) return
    setSelectedDate(fmt(d))
  }

  const entryDates = Object.keys(entries).filter(d => entries[d]?.content?.trim())

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">Günlük</h2>

      {/* Tarih gezinme */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => changeDay(-1)} className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-colors">
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

      {/* Editör */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <BookOpen size={16} />
            <span className="text-sm">
              {entries[selectedDate]?.content?.trim()
                ? `${entries[selectedDate].content.trim().split(/\s+/).length} kelime`
                : 'Yazmaya başlayın...'}
            </span>
          </div>
          <button
            onClick={() => save()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded-lg transition-colors"
          >
            <Save size={14} />
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
        <textarea
          value={content}
          onChange={e => scheduleAutosave(e.target.value)}
          placeholder={`${display(selectedDate)} nasıl geçti?`}
          className="w-full min-h-[400px] p-4 bg-transparent text-slate-700 dark:text-slate-200 placeholder-slate-300 dark:placeholder-slate-600 focus:outline-none resize-none text-base leading-relaxed"
        />
      </div>

      {/* Geçmiş kayıtlar */}
      {entryDates.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Geçmiş Kayıtlar</h3>
          <div className="space-y-2">
            {entryDates
              .sort((a, b) => b.localeCompare(a))
              .slice(0, 10)
              .map(d => (
                <button
                  key={d}
                  onClick={() => setSelectedDate(d)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                    d === selectedDate
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750'
                  }`}
                >
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{display(d)}</p>
                  <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                    {entries[d]?.content?.slice(0, 80)}...
                  </p>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
