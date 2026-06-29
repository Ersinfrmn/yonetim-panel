import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit2, Trash2, Library, Image, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import { BookModal, STATUS_MAP } from './Books'

export default function BookDetail() {
  const { id }     = useParams()
  const { user }   = useAuth()
  const navigate   = useNavigate()
  const [book,     setBook]     = useState(null)
  const [notes,    setNotes]    = useState('')
  const [loading,  setLoading]  = useState(true)
  const [saveMsg,  setSaveMsg]  = useState('')
  const [showEdit,   setShowEdit]   = useState(false)
  const [noteImages, setNoteImages] = useState([])
  const [uploading,  setUploading]  = useState(false)
  const [hoveredImg, setHoveredImg] = useState(null)

  useEffect(() => { loadBook() }, [id]) // eslint-disable-line

  async function loadBook() {
    const { data } = await supabase
      .from('books').select('*').eq('id', id).eq('user_id', user.id).single()
    if (!data) { navigate('/books'); return }
    setBook(data)
    setNotes(data.content || '')
    setNoteImages(data.note_images || [])
    setLoading(false)
  }

  async function saveNotes() {
    const { error } = await supabase.from('books').update({ content: notes }).eq('id', id)
    if (error) { toast.error('Kaydedilemedi'); return }
    setSaveMsg('Kaydedildi ✓')
    setTimeout(() => setSaveMsg(''), 2500)
  }

  async function deleteBook() {
    if (!confirm('Bu kitabı silmek istediğinize emin misiniz?')) return
    if (book.cover_url) {
      const path = book.cover_url.split('/book-covers/')[1]
      if (path) await supabase.storage.from('book-covers').remove([decodeURIComponent(path)])
    }
    const { error } = await supabase.from('books').delete().eq('id', id)
    if (error) { toast.error('Silinemedi'); return }
    toast.success('Kitap silindi')
    navigate('/books')
  }

  if (loading) return (
    <div style={{ color: '#444444', padding: 40, textAlign: 'center', fontSize: 12 }}>Yükleniyor...</div>
  )

  const status = STATUS_MAP[book.status] ?? STATUS_MAP.to_read

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>

      {/* Back */}
      <button
        onClick={() => navigate('/books')}
        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', padding: '0 0 24px', fontFamily: 'inherit' }}
      >
        <ArrowLeft size={13} /> Kitaplar
      </button>

      {/* Book header */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 36, flexWrap: 'wrap' }}>

        {/* Cover */}
        <div style={{
          width: 160, flexShrink: 0, aspectRatio: '2/3',
          borderRadius: 4, overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.08)',
          background: '#111111',
          boxShadow: '0 8px 32px rgba(185,28,28,0.25)',
        }}>
          {book.cover_url
            ? <img src={book.cover_url} alt={book.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Library size={40} style={{ color: '#222222' }} />
              </div>
            )
          }
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column' }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#ffffff', margin: '0 0 6px', textTransform: 'uppercase', lineHeight: 1.2 }}>
            {book.title}
          </h1>
          {book.author && (
            <p style={{ fontSize: 13, color: '#666666', margin: '0 0 14px' }}>{book.author}</p>
          )}

          <span style={{
            display: 'inline-block', width: 'fit-content',
            fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
            color: status.color,
            border: `1px solid ${status.color}44`,
            background: `${status.color}11`,
            padding: '3px 8px', borderRadius: 2,
          }}>
            {status.label}
          </span>

          <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 20 }}>
            <button
              onClick={() => setShowEdit(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2, color: '#888888', padding: '6px 12px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <Edit2 size={12} /> Düzenle
            </button>
            <button
              onClick={deleteBook}
              style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 2, color: '#3a3a3a', padding: '6px 12px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <Trash2 size={12} /> Kitabı Sil
            </button>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div>
        <p style={{ fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#b91c1c', margin: '0 0 12px' }}>
          NOTLARIM
        </p>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Kitap hakkındaki düşüncelerinizi, notlarınızı veya özetinizi buraya yazın..."
          style={{
            width: '100%', minHeight: 400, boxSizing: 'border-box',
            background: 'rgba(255,255,255,0.02)',
            border: 'none',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            color: '#ffffff', fontSize: 14, lineHeight: 1.8,
            fontFamily: 'inherit', padding: '12px 4px',
            resize: 'vertical', outline: 'none',
            transition: 'border-bottom-color 200ms ease',
          }}
          onFocus={e => { e.target.style.borderBottomColor = '#b91c1c' }}
          onBlur={e => { e.target.style.borderBottomColor = 'rgba(255,255,255,0.06)' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
          {saveMsg && <span style={{ fontSize: 11, color: '#22c55e' }}>{saveMsg}</span>}
          <button
            onClick={saveNotes}
            style={{ background: '#b91c1c', border: 'none', borderRadius: 2, color: '#fff', padding: '8px 20px', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            KAYDET
          </button>
        </div>
      </div>

      {/* Edit modal */}
      {showEdit && (
        <BookModal
          user={user}
          book={book}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); loadBook() }}
        />
      )}
    </div>
  )
}
