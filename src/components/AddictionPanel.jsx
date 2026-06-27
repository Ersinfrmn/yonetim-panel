import { useState, useEffect, useRef, useCallback } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const MONTHS = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara']

function todayISO() {
  const d = new Date()
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function shortDate(str) {
  const d = new Date(str + 'T00:00:00')
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}

export default function AddictionPanel({ isOpen, onClose }) {
  const { user } = useAuth()

  const [quitDate,     setQuitDate]     = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [setupDate,    setSetupDate]    = useState('')
  const [tick,         setTick]         = useState(() => new Date())
  const [journalText,  setJournalText]  = useState('')
  const [savedToday,   setSavedToday]   = useState(null)
  const [editMode,     setEditMode]     = useState(false)
  const [saveMsg,      setSaveMsg]      = useState('')
  const [showPast,     setShowPast]     = useState(false)
  const [pastEntries,  setPastEntries]  = useState([])
  const [confirmReset, setConfirmReset] = useState(false)
  const loadedRef = useRef(false)

  const today = todayISO()

  const load = useCallback(async () => {
    if (!user || loadedRef.current) return
    loadedRef.current = true
    const [{ data: tracker }, { data: journal }] = await Promise.all([
      supabase.from('addiction_tracker').select('quit_date').eq('user_id', user.id).maybeSingle(),
      supabase.from('addiction_journal').select('content').eq('user_id', user.id).eq('journal_date', today).maybeSingle(),
    ])
    setQuitDate(tracker?.quit_date ?? null)
    if (journal?.content) { setSavedToday(journal.content); setJournalText(journal.content) }
    setLoading(false)
  }, [user, today])

  useEffect(() => {
    if (isOpen) load()
  }, [isOpen, load])

  useEffect(() => {
    const id = setInterval(() => setTick(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const elapsed = quitDate ? Math.max(0, Math.floor((tick - new Date(quitDate)) / 1000)) : 0
  const days = Math.floor(elapsed / 86400)
  const hrs  = Math.floor((elapsed % 86400) / 3600)
  const mns  = Math.floor((elapsed % 3600) / 60)
  const scs  = elapsed % 60
  const p2   = n => String(n).padStart(2, '0')

  async function handleStart() {
    if (!setupDate || !user) return
    const { data } = await supabase.from('addiction_tracker')
      .upsert({ user_id: user.id, quit_date: setupDate, addiction_name: 'Sigara' }, { onConflict: 'user_id' })
      .select().maybeSingle()
    if (data) setQuitDate(data.quit_date)
  }

  async function handleReset() {
    if (!user) return
    await supabase.from('addiction_tracker').delete().eq('user_id', user.id)
    setQuitDate(null); setSetupDate(''); setConfirmReset(false)
  }

  async function handleSave() {
    if (!user) return
    const { error } = await supabase.from('addiction_journal')
      .upsert({ user_id: user.id, content: journalText, journal_date: today }, { onConflict: 'user_id,journal_date' })
    if (!error) {
      setSavedToday(journalText); setEditMode(false)
      setSaveMsg('Kaydedildi ✓')
      setTimeout(() => setSaveMsg(''), 2000)
    }
  }

  async function handleTogglePast() {
    if (showPast) { setShowPast(false); return }
    if (!user) return
    const { data } = await supabase.from('addiction_journal')
      .select('journal_date, content').eq('user_id', user.id)
      .order('journal_date', { ascending: false }).limit(7)
    setPastEntries(data || [])
    setShowPast(true)
  }

  const lbl = {
    fontSize: 9, color: '#444444', letterSpacing: '0.15em',
    textTransform: 'uppercase', fontWeight: 500, margin: 0,
  }

  return (
    <div style={{
      position:    'fixed',
      left:        64,
      top:         32,
      width:       280,
      height:      'calc(100vh - 32px)',
      background:  '#0d0d0d',
      borderRight: '1px solid rgba(255,255,255,0.06)',
      zIndex:      60,
      overflowY:   'auto',
      padding:     '20px 16px',
      boxSizing:   'border-box',
      transform:   isOpen ? 'translateX(0)' : 'translateX(-280px)',
      transition:  'transform 250ms ease',
    }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <p style={{ ...lbl, letterSpacing: '0.2em', marginBottom: 4 }}>BAĞIMLILIK</p>
          <p style={{ fontSize: 14, color: '#ffffff', fontWeight: 600, margin: 0 }}>Sigara</p>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#444444', padding: 0, lineHeight: 1 }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Sayaç */}
      {loading ? (
        <p style={{ fontSize: 11, color: '#444444', margin: 0 }}>Yükleniyor...</p>
      ) : !quitDate ? (
        <div>
          <p style={{ fontSize: 12, color: '#888888', marginBottom: 12 }}>Bırakma tarihinizi girin</p>
          <input
            type="datetime-local"
            value={setupDate}
            onChange={e => setSetupDate(e.target.value)}
            style={{
              width: '100%', padding: '8px 10px', boxSizing: 'border-box',
              background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 4, color: '#ffffff', fontSize: 12,
              outline: 'none', marginBottom: 10, colorScheme: 'dark',
            }}
          />
          <button
            onClick={handleStart}
            style={{
              width: '100%', padding: '8px 0', background: '#b91c1c',
              border: 'none', borderRadius: 4, color: '#ffffff', fontSize: 11,
              fontWeight: 600, letterSpacing: '0.15em', cursor: 'pointer', textTransform: 'uppercase',
            }}
          >BAŞLAT</button>
        </div>
      ) : (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, fontWeight: 700, color: '#ffffff', lineHeight: 1, marginBottom: 4 }}>
            {days}
          </div>
          <p style={{ ...lbl, marginBottom: 14 }}>GÜN</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 10 }}>
            {[{ v: hrs, l: 'SA' }, { v: mns, l: 'DK' }, { v: scs, l: 'SN' }].map(({ v, l }) => (
              <div key={l} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#ffffff', lineHeight: 1, marginBottom: 3 }}>
                  {p2(v)}
                </div>
                <p style={lbl}>{l}</p>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11, color: '#444444', marginBottom: 10 }}>Sigarasız geçen süre</p>
          {confirmReset ? (
            <div>
              <p style={{ fontSize: 10, color: '#666666', marginBottom: 6 }}>Emin misiniz?</p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button onClick={handleReset}
                  style={{ fontSize: 10, color: '#b91c1c', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  Evet, sıfırla
                </button>
                <button onClick={() => setConfirmReset(false)}
                  style={{ fontSize: 10, color: '#444444', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  İptal
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmReset(true)}
              style={{ fontSize: 10, color: '#333333', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              Tarihi sıfırla
            </button>
          )}
        </div>
      )}

      {/* Divider */}
      <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '16px 0' }} />

      {/* Gün Sonu Defteri */}
      <div>
        <p style={{ ...lbl, marginBottom: 12 }}>GÜN SONU DEFTERİ</p>

        {savedToday && !editMode ? (
          <div>
            <div style={{
              background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 4, padding: '10px 12px', color: '#888888',
              fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap',
              wordBreak: 'break-word', marginBottom: 6,
            }}>{savedToday}</div>
            <button
              onClick={() => setEditMode(true)}
              style={{ fontSize: 11, color: '#555555', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              Düzenle
            </button>
          </div>
        ) : (
          <div>
            <textarea
              value={journalText}
              onChange={e => setJournalText(e.target.value)}
              placeholder="Bugün nasıl geçti? Direnç anları, hisler..."
              onFocus={e => { e.target.style.borderColor = '#b91c1c' }}
              onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)' }}
              style={{
                width: '100%', height: 120, padding: '10px 12px',
                background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 4, color: '#ffffff', fontSize: 13, resize: 'none',
                outline: 'none', boxSizing: 'border-box',
                fontFamily: 'inherit', lineHeight: 1.5, display: 'block',
              }}
            />
            {saveMsg ? (
              <p style={{ textAlign: 'center', fontSize: 11, color: '#22c55e', padding: '6px 0', margin: 0 }}>
                {saveMsg}
              </p>
            ) : (
              <button
                onClick={handleSave}
                style={{
                  width: '100%', padding: '7px 0', marginTop: 8,
                  background: '#b91c1c', border: 'none', borderRadius: 4,
                  color: '#ffffff', fontSize: 11, fontWeight: 600,
                  letterSpacing: '0.12em', cursor: 'pointer', textTransform: 'uppercase',
                }}
              >KAYDET</button>
            )}
          </div>
        )}

        <button
          onClick={handleTogglePast}
          style={{ fontSize: 11, color: '#444444', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 14, display: 'block' }}
        >
          {showPast ? 'Geçmiş kayıtlar ↑' : 'Geçmiş kayıtlar ↓'}
        </button>

        {showPast && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pastEntries.length === 0 ? (
              <p style={{ fontSize: 11, color: '#444444', margin: 0 }}>Geçmiş kayıt yok.</p>
            ) : pastEntries.map(e => (
              <div key={e.journal_date}>
                <span style={{ fontSize: 11, color: '#555555', marginRight: 6 }}>{shortDate(e.journal_date)}</span>
                <span style={{ fontSize: 11, color: '#444444' }}>
                  {e.content.length > 60 ? e.content.slice(0, 60) + '…' : e.content}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
