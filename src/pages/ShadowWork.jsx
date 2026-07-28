import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLoadOnce } from '../lib/useLoadOnce'
import {
  Plus, Trash2, ChevronLeft, Brain,
  Circle, Clock, CheckCircle2, ChevronDown, ChevronUp,
} from 'lucide-react'
import toast from 'react-hot-toast'

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS = {
  todo:        { label: 'Yapılacak',  icon: Circle,       color: '#444444', next: 'in_progress' },
  in_progress: { label: 'İşlemde',   icon: Clock,        color: '#F59E0B', next: 'done'        },
  done:        { label: 'Tamamlandı', icon: CheckCircle2, color: '#22C55E', next: 'todo'        },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function progressOf(tasks) {
  if (!tasks || tasks.length === 0) return 0
  return Math.round((tasks.filter(t => t.status === 'done').length / tasks.length) * 100)
}

function ProgressBar({ pct }) {
  return (
    <div style={{ height: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 1, overflow: 'hidden', marginTop: 8 }}>
      <div style={{
        width: pct + '%', height: '100%',
        background: pct === 100 ? '#22C55E' : '#b91c1c',
        transition: 'width 400ms ease',
      }} />
    </div>
  )
}

// ─── TaskItem ─────────────────────────────────────────────────────────────────

function TaskItem({ task, onStatusCycle, onNoteChange, onDelete }) {
  const [noteOpen, setNoteOpen] = useState(false)
  const [localNote, setLocalNote] = useState(task.notes || '')
  const [saving, setSaving] = useState(false)
  const cfg = STATUS[task.status] || STATUS.todo
  const Icon = cfg.icon

  async function saveNote() {
    if (localNote === task.notes) { setNoteOpen(false); return }
    setSaving(true)
    await onNoteChange(task.id, localNote)
    setSaving(false)
    setNoteOpen(false)
  }

  return (
    <div style={{
      background: '#111111',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 4,
      overflow: 'hidden',
      transition: 'border-color 150ms ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
        <button
          onClick={() => onStatusCycle(task)}
          title={'Sonraki: ' + (STATUS[cfg.next] ? STATUS[cfg.next].label : '')}
          style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', lineHeight: 1 }}
        >
          <Icon size={16} style={{ color: cfg.color }} />
        </button>

        <span style={{
          flex: 1, fontSize: 13,
          color: task.status === 'done' ? '#444444' : '#ffffff',
          textDecoration: task.status === 'done' ? 'line-through' : 'none',
          transition: 'color 150ms ease',
        }}>
          {task.title}
        </span>

        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
          color: cfg.color, opacity: 0.9, whiteSpace: 'nowrap', flexShrink: 0,
        }}>
          {cfg.label}
        </span>

        <button
          onClick={() => setNoteOpen(function(o){ return !o })}
          title="Notlar"
          style={{
            flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer',
            padding: 0, display: 'flex',
            color: localNote ? '#888888' : '#333333',
          }}
        >
          {noteOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        <button
          onClick={() => onDelete(task.id)}
          style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: '#333333' }}
          onMouseEnter={function(e){ e.currentTarget.style.color = '#b91c1c' }}
          onMouseLeave={function(e){ e.currentTarget.style.color = '#333333' }}
        >
          <Trash2 size={13} />
        </button>
      </div>

      {noteOpen && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', padding: '10px 12px' }}>
          <textarea
            value={localNote}
            onChange={function(e){ setLocalNote(e.target.value) }}
            placeholder="Oturumda çıkan düşünceler, gözlemler…"
            rows={4}
            style={{
              width: '100%', background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              color: '#ffffff', fontSize: 12, padding: '8px 10px',
              resize: 'vertical', outline: 'none', fontFamily: 'inherit',
              lineHeight: 1.6, borderRadius: 2,
            }}
            onFocus={function(e){ e.currentTarget.style.borderColor = 'rgba(185,28,28,0.4)' }}
            onBlur={function(e){ e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
            <button
              onClick={function(){ setLocalNote(task.notes || ''); setNoteOpen(false) }}
              style={{ fontSize: 11, color: '#444444', background: 'none', border: 'none', cursor: 'pointer' }}
              onMouseEnter={function(e){ e.currentTarget.style.color = '#ffffff' }}
              onMouseLeave={function(e){ e.currentTarget.style.color = '#444444' }}
            >
              İptal
            </button>
            <button
              onClick={saveNote}
              disabled={saving}
              style={{
                fontSize: 11, color: '#ffffff', background: '#b91c1c',
                border: 'none', cursor: 'pointer', padding: '4px 12px',
                opacity: saving ? 0.6 : 1, borderRadius: 2,
              }}
            >
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── SectionCard ──────────────────────────────────────────────────────────────

function SectionCard({ section, tasks, onClick, onDelete }) {
  const pct   = progressOf(tasks)
  const total = tasks.length
  const done  = tasks.filter(function(t){ return t.status === 'done' }).length

  return (
    <div
      onClick={onClick}
      style={{
        background: '#111111',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 4,
        padding: '16px 20px',
        cursor: 'pointer',
        transition: 'border-color 150ms ease',
        position: 'relative',
      }}
      onMouseEnter={function(e){ e.currentTarget.style.borderColor = 'rgba(185,28,28,0.4)' }}
      onMouseLeave={function(e){ e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)' }}
    >
      <button
        onClick={function(e){ e.stopPropagation(); onDelete(section.id) }}
        style={{
          position: 'absolute', top: 12, right: 12,
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#333333', display: 'flex', padding: 4,
        }}
        onMouseEnter={function(e){ e.currentTarget.style.color = '#b91c1c' }}
        onMouseLeave={function(e){ e.currentTarget.style.color = '#333333' }}
        title="Bölümü sil"
      >
        <Trash2 size={13} />
      </button>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, paddingRight: 24 }}>
        <Brain size={15} style={{ color: '#b91c1c', flexShrink: 0, marginTop: 1 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#ffffff', lineHeight: 1.3 }}>
            {section.title}
          </p>
          {section.description && (
            <p style={{ fontSize: 11, color: '#555555', marginTop: 3, lineHeight: 1.4 }}>
              {section.description}
            </p>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
        <span style={{ fontSize: 11, color: '#444444' }}>
          {total === 0 ? 'Henüz görev yok' : done + ' / ' + total + ' tamamlandı'}
        </span>
        {total > 0 && (
          <span style={{ fontSize: 11, color: pct === 100 ? '#22C55E' : '#b91c1c', fontWeight: 700 }}>
            %{pct}
          </span>
        )}
      </div>

      {total > 0 && <ProgressBar pct={pct} />}
    </div>
  )
}

// ─── AddForm ──────────────────────────────────────────────────────────────────

function AddForm({ placeholder, onAdd, onCancel, secondField, secondPlaceholder }) {
  const [val, setVal]     = useState('')
  const [extra, setExtra] = useState('')

  function submit(e) {
    e.preventDefault()
    if (!val.trim()) return
    onAdd(val.trim(), extra.trim())
    setVal(''); setExtra('')
  }

  return (
    <form onSubmit={submit}>
      <input
        autoFocus
        type="text"
        value={val}
        onChange={function(e){ setVal(e.target.value) }}
        placeholder={placeholder}
        style={{
          width: '100%', background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: '#ffffff', fontSize: 13, padding: '9px 12px',
          outline: 'none', fontFamily: 'inherit', borderRadius: 2,
        }}
        onFocus={function(e){ e.currentTarget.style.borderColor = 'rgba(185,28,28,0.4)' }}
        onBlur={function(e){ e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
      />
      {secondField && (
        <input
          type="text"
          value={extra}
          onChange={function(e){ setExtra(e.target.value) }}
          placeholder={secondPlaceholder}
          style={{
            width: '100%', background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)', borderTop: 'none',
            color: '#ffffff', fontSize: 12, padding: '8px 12px',
            outline: 'none', fontFamily: 'inherit',
          }}
          onFocus={function(e){ e.currentTarget.style.borderColor = 'rgba(185,28,28,0.4)' }}
          onBlur={function(e){ e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
        />
      )}
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        <button
          type="submit"
          style={{
            flex: 1, height: 34, background: '#b91c1c', border: 'none',
            color: '#ffffff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            letterSpacing: '0.05em', borderRadius: 2,
          }}
        >
          Ekle
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            height: 34, padding: '0 16px', background: 'transparent',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#888888', fontSize: 12, cursor: 'pointer', borderRadius: 2,
          }}
          onMouseEnter={function(e){ e.currentTarget.style.color = '#ffffff' }}
          onMouseLeave={function(e){ e.currentTarget.style.color = '#888888' }}
        >
          İptal
        </button>
      </div>
    </form>
  )
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

function EmptyState({ onAdd }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 16, padding: '64px 24px', textAlign: 'center',
    }}>
      <div style={{
        width: 56, height: 56,
        border: '1px solid rgba(185,28,28,0.25)',
        background: 'rgba(185,28,28,0.06)',
        borderRadius: 4,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Brain size={24} style={{ color: '#b91c1c' }} />
      </div>
      <div>
        <p style={{ fontSize: 14, fontWeight: 600, color: '#ffffff', marginBottom: 6 }}>
          Henüz hiç bölüm yok
        </p>
        <p style={{ fontSize: 12, color: '#444444', lineHeight: 1.6, maxWidth: 280 }}>
          Shadow work, bilinçdışı kalıpları ve duyguları keşfetme sürecidir.
          Bir bölüm oluşturarak başla.
        </p>
      </div>
      <button
        onClick={onAdd}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          height: 36, padding: '0 20px',
          background: '#b91c1c', border: 'none',
          color: '#ffffff', fontSize: 12, fontWeight: 600,
          cursor: 'pointer', letterSpacing: '0.08em', textTransform: 'uppercase',
          borderRadius: 2,
        }}
      >
        <Plus size={14} />
        İlk Bölümü Oluştur
      </button>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ShadowWork() {
  const { user } = useAuth()

  const [sections,        setSections]        = useState([])
  const [tasksBySection,  setTasksBySection]  = useState({})
  const [loading,         setLoading]         = useState(true)
  const [activeSection,   setActiveSection]   = useState(null)
  const [showSectionForm, setShowSectionForm] = useState(false)
  const [showTaskForm,    setShowTaskForm]    = useState(false)

  useLoadOnce(function() {
    Promise.all([
      supabase
        .from('shadow_work_sections')
        .select('*')
        .eq('user_id', user.id)
        .order('order_index', { ascending: true })
        .order('created_at',  { ascending: true }),
      supabase
        .from('shadow_work_tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('order_index', { ascending: true })
        .order('created_at',  { ascending: true }),
    ]).then(function(results) {
      var secs  = results[0].data
      var tasks = results[1].data
      setSections(secs || [])
      var map = {}
      ;(tasks || []).forEach(function(t) {
        if (!map[t.section_id]) map[t.section_id] = []
        map[t.section_id].push(t)
      })
      setTasksBySection(map)
      setLoading(false)
    })
  }, [user.id])

  var currentSection = activeSection
    ? (sections.find(function(s){ return s.id === activeSection.id }) || activeSection)
    : null
  var currentTasks = currentSection ? (tasksBySection[currentSection.id] || []) : []

  // ── Section CRUD ────────────────────────────────────────────────────────────

  async function addSection(title, description) {
    var orderIndex = sections.length
    var result = await supabase
      .from('shadow_work_sections')
      .insert({ user_id: user.id, title: title, description: description, order_index: orderIndex })
      .select().single()
    if (result.error) { toast.error('Bölüm eklenemedi'); return }
    var data = result.data
    setSections(function(s){ return [...s, data] })
    setTasksBySection(function(m){ return Object.assign({}, m, { [data.id]: [] }) })
    setShowSectionForm(false)
    toast.success('Bölüm eklendi')
  }

  async function deleteSection(id) {
    if (!window.confirm('Bu bölümü ve içindeki tüm görevleri silmek istiyor musun?')) return
    await supabase.from('shadow_work_sections').delete().eq('id', id)
    setSections(function(s){ return s.filter(function(x){ return x.id !== id }) })
    setTasksBySection(function(m){ var n = Object.assign({}, m); delete n[id]; return n })
    if (activeSection && activeSection.id === id) setActiveSection(null)
    toast.success('Bölüm silindi')
  }

  // ── Task CRUD ───────────────────────────────────────────────────────────────

  async function addTask(title) {
    if (!currentSection) return
    var existing = tasksBySection[currentSection.id] || []
    var result = await supabase
      .from('shadow_work_tasks')
      .insert({
        user_id: user.id, section_id: currentSection.id,
        title: title, notes: '', status: 'todo', order_index: existing.length,
      })
      .select().single()
    if (result.error) { toast.error('Görev eklenemedi'); return }
    var data = result.data
    var sid  = currentSection.id
    setTasksBySection(function(m){
      return Object.assign({}, m, { [sid]: [...(m[sid] || []), data] })
    })
    setShowTaskForm(false)
    toast.success('Görev eklendi')
  }

  async function deleteTask(taskId) {
    await supabase.from('shadow_work_tasks').delete().eq('id', taskId)
    var sid = currentSection.id
    setTasksBySection(function(m){
      return Object.assign({}, m, { [sid]: (m[sid] || []).filter(function(t){ return t.id !== taskId }) })
    })
  }

  async function cycleStatus(task) {
    var next = STATUS[task.status] ? STATUS[task.status].next : 'todo'
    var patch = {
      status: next,
      completed_at: next === 'done' ? new Date().toISOString() : null,
    }
    var result = await supabase
      .from('shadow_work_tasks')
      .update(patch)
      .eq('id', task.id)
      .select().single()
    if (result.error) { toast.error('Durum güncellenemedi'); return }
    var data = result.data
    var sid  = task.section_id
    setTasksBySection(function(m){
      return Object.assign({}, m, { [sid]: (m[sid] || []).map(function(t){ return t.id === task.id ? data : t }) })
    })
  }

  async function updateNote(taskId, notes) {
    var result = await supabase
      .from('shadow_work_tasks')
      .update({ notes: notes })
      .eq('id', taskId)
      .select().single()
    if (result.error) { toast.error('Not kaydedilemedi'); return }
    var data = result.data
    var sid  = currentSection.id
    setTasksBySection(function(m){
      return Object.assign({}, m, { [sid]: (m[sid] || []).map(function(t){ return t.id === taskId ? data : t }) })
    })
  }

  // ── Render: Loading ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ background: 'transparent' }}>
        <div className="mb-6 pl-3 border-l-2 border-primary-500">
          <h2 className="text-2xl font-bold tracking-widest uppercase text-ink-primary">Shadow Work</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2, 3].map(function(i){ return (
            <div key={i} className="h-28 animate-pulse bg-surface-card/60 rounded border border-border-subtle" />
          )})}
        </div>
      </div>
    )
  }

  // ── Render: Section Detail ──────────────────────────────────────────────────

  if (currentSection) {
    var pct = progressOf(currentTasks)
    return (
      <div style={{ background: 'transparent' }}>

        <div className="mb-6">
          <button
            onClick={function(){ setActiveSection(null); setShowTaskForm(false) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#444444', fontSize: 11, letterSpacing: '0.12em',
              textTransform: 'uppercase', marginBottom: 16, padding: 0,
            }}
            onMouseEnter={function(e){ e.currentTarget.style.color = '#ffffff' }}
            onMouseLeave={function(e){ e.currentTarget.style.color = '#444444' }}
          >
            <ChevronLeft size={13} />
            Tüm Bölümler
          </button>

          <div className="pl-3 border-l-2 border-primary-500">
            <h2 className="text-2xl font-bold tracking-widest uppercase text-ink-primary">
              {currentSection.title}
            </h2>
            {currentSection.description && (
              <p className="text-sm text-ink-muted mt-0.5">{currentSection.description}</p>
            )}
          </div>

          {currentTasks.length > 0 && (
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, height: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 1, overflow: 'hidden' }}>
                <div style={{
                  width: pct + '%', height: '100%',
                  background: pct === 100 ? '#22C55E' : '#b91c1c',
                  transition: 'width 400ms ease',
                }} />
              </div>
              <span style={{ fontSize: 11, color: '#555555', whiteSpace: 'nowrap' }}>
                {currentTasks.filter(function(t){ return t.status === 'done' }).length} / {currentTasks.length} · %{pct}
              </span>
            </div>
          )}
        </div>

        {/* Status legend */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          {Object.entries(STATUS).map(function(entry) {
            var key = entry[0], cfg = entry[1]
            var count = currentTasks.filter(function(t){ return t.status === key }).length
            var Icon  = cfg.icon
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Icon size={12} style={{ color: cfg.color }} />
                <span style={{ fontSize: 10, color: '#444444', letterSpacing: '0.08em' }}>
                  {cfg.label.toUpperCase()} <span style={{ color: '#666666' }}>({count})</span>
                </span>
              </div>
            )
          })}
        </div>

        {/* Task list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {currentTasks.length === 0 && !showTaskForm && (
            <div style={{
              padding: '32px 20px', textAlign: 'center',
              border: '1px solid rgba(255,255,255,0.04)', borderRadius: 4,
            }}>
              <p style={{ fontSize: 12, color: '#444444' }}>
                Bu bölümde henüz görev yok. İlk görevi ekle.
              </p>
            </div>
          )}
          {currentTasks.map(function(task){ return (
            <TaskItem
              key={task.id}
              task={task}
              onStatusCycle={cycleStatus}
              onNoteChange={updateNote}
              onDelete={deleteTask}
            />
          )})}
        </div>

        {/* Add task */}
        <div style={{ marginTop: 12 }}>
          {showTaskForm ? (
            <div style={{
              background: '#111111',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 4, padding: 12,
            }}>
              <AddForm
                placeholder="Görev başlığı…"
                onAdd={function(title){ addTask(title) }}
                onCancel={function(){ setShowTaskForm(false) }}
              />
            </div>
          ) : (
            <button
              onClick={function(){ setShowTaskForm(true) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                height: 36, padding: '0 16px',
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#555555', fontSize: 12, cursor: 'pointer',
                width: '100%', justifyContent: 'center', borderRadius: 2,
              }}
              onMouseEnter={function(e){ e.currentTarget.style.borderColor = 'rgba(185,28,28,0.4)'; e.currentTarget.style.color = '#ffffff' }}
              onMouseLeave={function(e){ e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#555555' }}
            >
              <Plus size={13} />
              Görev Ekle
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── Render: Section List ────────────────────────────────────────────────────

  return (
    <div style={{ background: 'transparent' }}>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div className="pl-3 border-l-2 border-primary-500">
          <h2 className="text-2xl font-bold tracking-widest uppercase text-ink-primary">Shadow Work</h2>
          <p className="text-sm text-ink-muted mt-0.5">{sections.length} bölüm</p>
        </div>
        {sections.length > 0 && !showSectionForm && (
          <button
            onClick={function(){ setShowSectionForm(true) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              height: 34, padding: '0 16px',
              background: '#b91c1c', border: 'none',
              color: '#ffffff', fontSize: 11, fontWeight: 600,
              cursor: 'pointer', letterSpacing: '0.08em', textTransform: 'uppercase',
              flexShrink: 0, borderRadius: 2,
            }}
          >
            <Plus size={13} />
            Yeni Bölüm
          </button>
        )}
      </div>

      {showSectionForm && (
        <div style={{
          background: '#111111',
          border: '1px solid rgba(185,28,28,0.3)',
          borderRadius: 4, padding: 14, marginBottom: 16,
        }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#b91c1c', marginBottom: 10 }}>
            YENİ BÖLÜM
          </p>
          <AddForm
            placeholder="Bölüm başlığı (örn. Öfke, Korku, Aile Kalıpları…)"
            secondField={true}
            secondPlaceholder="Kısa açıklama (opsiyonel)"
            onAdd={addSection}
            onCancel={function(){ setShowSectionForm(false) }}
          />
        </div>
      )}

      {sections.length === 0 && !showSectionForm && (
        <EmptyState onAdd={function(){ setShowSectionForm(true) }} />
      )}

      {sections.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sections.map(function(section){ return (
            <SectionCard
              key={section.id}
              section={section}
              tasks={tasksBySection[section.id] || []}
              onClick={function(){ setActiveSection(section); setShowTaskForm(false) }}
              onDelete={deleteSection}
            />
          )})}
        </div>
      )}

    </div>
  )
}
