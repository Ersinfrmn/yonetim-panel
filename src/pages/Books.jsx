import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Library, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

// ─── Shared constants ─────────────────────────────────────────────────────────

export const STATUS_MAP = {
  reading:  { label: 'OKUNUYOR', color: '#F59E0B' },
  finished: { label: 'OKUNDU',   color: '#22C55E' },
  to_read:  { label: 'OKUNACAK', color: '#666666' },
}

// ─── Shared modal (used by both Books list and BookDetail) ────────────────────

export function BookModal({ user, book: editBook, onClose, onSaved }) {
  const [title,   setTitle]   = useState(editBook?.title  ?? '')
  const [author,  setAuthor]  = useState(editBook?.author ?? '')
  const [status,  setStatus]  = useState(editBook?.status ?? 'to_read')
  const [file,    setFile]    = useState(null)
  const [preview, setPreview] = useState(editBook?.cover_url ?? null)
  const [saving,  setSaving]  = useState(false)

  function pickFile(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  async function handleSave() {
    if (!title.trim()) { toast.error('Başlık gerekli'); return }
    setSaving(true)

    let cover_url = editBook?.cover_url ?? null

    if (file) {
      const path = `${user.id}/${Date.now()}-${file.name.replace(/\s+/g, '_')}`
      const { error: upErr } = await supabase.storage.from('book-covers').upload(path, file)
      if (upErr) { toast.error('Kapak yüklenemedi'); setSaving(false); return }
      const { data: urlData } = supabase.storage.from('book-covers').getPublicUrl(path)
      cover_url = urlData.publicUrl
    }

    const payload = {
      title:     title.trim(),
      author:    author.trim() || null,
      status,
      cover_url,
    }

    if (editBook) {
      const { error } = await supabase.from('books').update(payload).eq('id', editBook.id)
      if (error) { toast.error('Güncellenemedi'); setSaving(false); return }
      toast.success('Güncellendi')
    } else {
      const { error } = await supabase.from('books').insert({ ...payload, user_id: user.id, content: '' })
      if (error) { toast.error('Eklenemedi'); setSaving(false); return }
      toast.success('Kitap eklendi!')
    }

    setSaving(false)
    onSaved()
  }

  const inp = {
    width: '100%', boxSizing: 'border-box',
    background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 4, color: '#ffffff', padding: '8px 12px', fontSize: 13,
    fontFamily: 'inherit', outline: 'none',
  }
  const fieldLbl = {
    fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase',
    color: '#666666', display: 'block', marginBottom: 6,
  }

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: 24, overflowY: 'auto',
      }}
    >
      <div style={{
        background: '#111111', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 4, padding: 24, width: '100%', maxWidth: 460,
        marginTop: 32, position: 'relative',
      }}>
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: '#444444', cursor: 'pointer', padding: 0 }}
        >
          <X size={18} />
        </button>

        <p style={{ fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#444444', margin: '0 0 20px' }}>
          {editBook ? 'KİTABI DÜZENLE' : 'KİTAP EKLE'}
        </p>

        <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
          {/* Cover upload */}
          <label style={{ cursor: 'pointer', flexShrink: 0 }}>
            <div style={{
              width: 100, aspectRatio: '2/3', borderRadius: 4, overflow: 'hidden',
              border: '2px dashed rgba(255,255,255,0.1)', background: '#0a0a0a',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            }}>
              {preview
                ? <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                : <>
                    <Library size={22} style={{ color: '#333333' }} />
                    <span style={{ fontSize: 9, color: '#333333', marginTop: 4 }}>Kapak</span>
                  </>
              }
            </div>
            <p style={{ fontSize: 9, color: '#444444', textAlign: 'center', marginTop: 4 }}>Tıkla / değiştir</p>
            <input type="file" accept="image/*" onChange={pickFile} style={{ display: 'none' }} />
          </label>

          {/* Fields */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={fieldLbl}>Başlık *</label>
              <input value={title} onChange={e => setTitle(e.target.value)} style={inp} placeholder="Kitap adı" />
            </div>
            <div>
              <label style={fieldLbl}>Yazar</label>
              <input value={author} onChange={e => setAuthor(e.target.value)} style={inp} placeholder="Yazar adı" />
            </div>
            <div>
              <label style={fieldLbl}>Durum</label>
              <select value={status} onChange={e => setStatus(e.target.value)} style={{ ...inp, colorScheme: 'dark' }}>
                <option value="to_read">Okunacak</option>
                <option value="reading">Okunuyor</option>
                <option value="finished">Okundu</option>
              </select>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: '8px 0', background: 'none', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2, color: '#888888', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            İptal
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ flex: 2, padding: '8px 0', background: '#b91c1c', border: 'none', borderRadius: 2, color: '#ffffff', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'KAYDEDİLİYOR...' : 'KAYDET'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Book card ────────────────────────────────────────────────────────────────

function BookCard({ book, onClick }) {
  const [hovered, setHovered] = useState(false)
  const s = STATUS_MAP[book.status] ?? STATUS_MAP.to_read

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative', aspectRatio: '2/3', borderRadius: 4,
        overflow: 'hidden', cursor: 'pointer',
        border: '1px solid rgba(255,255,255,0.08)',
        background: '#0d0d0d',
      }}
    >
      {book.cover_url
        ? <img src={book.cover_url} alt={book.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        : (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 10, gap: 6 }}>
            <Library size={24} style={{ color: '#2a2a2a' }} />
            <span style={{ fontSize: 10, color: '#3a3a3a', textAlign: 'center', lineHeight: 1.4, wordBreak: 'break-word' }}>{book.title}</span>
          </div>
        )
      }

      {/* Status badge */}
      <div style={{ position: 'absolute', top: 6, right: 6 }}>
        <span style={{
          fontSize: 8, fontWeight: 700, letterSpacing: '0.08em',
          color: s.color, background: 'rgba(0,0,0,0.8)',
          padding: '2px 5px', borderRadius: 2,
        }}>
          {s.label}
        </span>
      </div>

      {/* Hover overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(185,28,28,0.9)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 10, textAlign: 'center',
        opacity: hovered ? 1 : 0,
        transition: 'opacity 180ms ease',
        pointerEvents: 'none',
      }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#fff', margin: '0 0 4px', lineHeight: 1.3 }}>{book.title}</p>
        {book.author && <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', margin: 0 }}>{book.author}</p>}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Books() {
  const { user }   = useAuth()
  const navigate   = useNavigate()
  const [books,     setBooks]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => { loadBooks() }, [user.id]) // eslint-disable-line

  async function loadBooks() {
    const { data } = await supabase
      .from('books').select('*').eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setBooks(data || [])
    setLoading(false)
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <p style={{ fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#444444', margin: 0 }}>
          KİTAPLAR
        </p>
        <button
          onClick={() => setShowModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#b91c1c', border: 'none', borderRadius: 2, color: '#fff', padding: '6px 14px', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          <Plus size={14} /> Kitap Ekle
        </button>
      </div>

      {/* Content */}
      {loading ? null : books.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: '#444444' }}>
          <Library size={48} style={{ color: '#1a1a1a', marginBottom: 16, display: 'block', margin: '0 auto 16px' }} />
          <p style={{ fontSize: 14, marginBottom: 20 }}>Henüz kitap eklenmedi.</p>
          <button
            onClick={() => setShowModal(true)}
            style={{ background: '#b91c1c', border: 'none', borderRadius: 2, color: '#fff', padding: '8px 20px', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            İlk Kitabı Ekle
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {books.map(book => (
            <BookCard key={book.id} book={book} onClick={() => navigate(`/books/${book.id}`)} />
          ))}
        </div>
      )}

      {showModal && (
        <BookModal
          user={user}
          book={null}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); loadBooks() }}
        />
      )}
    </div>
  )
}
