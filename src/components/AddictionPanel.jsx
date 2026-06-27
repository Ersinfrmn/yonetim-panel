import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function AddictionPanel({ isOpen, onClose }) {
  console.log('[AddictionPanel] isOpen:', isOpen)
  const { user } = useAuth()
  const [quitDate, setQuitDate] = useState(null)
  const [inputDate, setInputDate] = useState('')
  const [elapsed, setElapsed] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })
  const [journalText, setJournalText] = useState('')
  const [savedJournal, setSavedJournal] = useState(null)
  const [editing, setEditing] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [pastEntries, setPastEntries] = useState([])
  const [showPast, setShowPast] = useState(false)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (!isOpen || !user) return
    loadData()
  }, [isOpen, user])

  useEffect(() => {
    if (quitDate) {
      intervalRef.current = setInterval(() => {
        const diff = Date.now() - new Date(quitDate).getTime()
        const totalSeconds = Math.floor(diff / 1000)
        setElapsed({
          days: Math.floor(totalSeconds / 86400),
          hours: Math.floor((totalSeconds % 86400) / 3600),
          minutes: Math.floor((totalSeconds % 3600) / 60),
          seconds: totalSeconds % 60
        })
      }, 1000)
    }
    return () => clearInterval(intervalRef.current)
  }, [quitDate])

  async function loadData() {
    const today = new Date().toISOString().split('T')[0]
    const { data: tracker } = await supabase
      .from('addiction_tracker')
      .select('quit_date')
      .eq('user_id', user.id)
      .single()
    if (tracker) setQuitDate(tracker.quit_date)

    const { data: journal } = await supabase
      .from('addiction_journal')
      .select('content')
      .eq('user_id', user.id)
      .eq('journal_date', today)
      .single()
    if (journal) setSavedJournal(journal.content)
  }

  async function handleStart() {
    if (!inputDate) return
    await supabase.from('addiction_tracker').upsert({ user_id: user.id, quit_date: inputDate, addiction_name: 'Sigara' })
    setQuitDate(inputDate)
  }

  async function handleReset() {
    if (!confirm('Sayacı sıfırlamak istediğinize emin misiniz?')) return
    await supabase.from('addiction_tracker').delete().eq('user_id', user.id)
    setQuitDate(null)
    setElapsed({ days: 0, hours: 0, minutes: 0, seconds: 0 })
  }

  async function handleSaveJournal() {
    const today = new Date().toISOString().split('T')[0]
    await supabase.from('addiction_journal').upsert({ user_id: user.id, content: journalText, journal_date: today }, { onConflict: 'user_id,journal_date' })
    setSavedJournal(journalText)
    setEditing(false)
    setSaveMsg('Kaydedildi ✓')
    setTimeout(() => setSaveMsg(''), 2000)
  }

  async function loadPastEntries() {
    const { data } = await supabase
      .from('addiction_journal')
      .select('content, journal_date')
      .eq('user_id', user.id)
      .order('journal_date', { ascending: false })
      .limit(7)
    setPastEntries(data || [])
    setShowPast(true)
  }

  const pad = n => String(n).padStart(2, '0')

  return (
    <div style={{
      position: 'fixed',
      left: '64px',
      top: '32px',
      width: '280px',
      height: 'calc(100vh - 32px)',
      backgroundColor: '#0d0d0d',
      borderRight: '1px solid rgba(255,255,255,0.08)',
      zIndex: 100,
      transform: isOpen ? 'translateX(0)' : 'translateX(-280px)',
      transition: 'transform 250ms ease',
      overflowY: 'auto',
      padding: '20px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      boxSizing: 'border-box'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#444444', marginBottom: '4px' }}>BAĞIMLILIK</div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff' }}>Sigara</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#444444', cursor: 'pointer', padding: '0' }}>
          <X size={16} />
        </button>
      </div>

      {/* Sayaç */}
      <div>
        {!quitDate ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '11px', color: '#888888' }}>Bırakma tarihinizi girin</div>
            <input
              type="datetime-local"
              value={inputDate}
              onChange={e => setInputDate(e.target.value)}
              style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#ffffff', padding: '8px', fontSize: '12px', width: '100%', boxSizing: 'border-box' }}
            />
            <button onClick={handleStart} style={{ background: '#b91c1c', border: 'none', borderRadius: '2px', color: '#ffffff', padding: '8px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.1em', cursor: 'pointer', width: '100%' }}>
              BAŞLAT
            </button>
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', fontWeight: 700, color: '#ffffff', lineHeight: 1 }}>{elapsed.days}</div>
            <div style={{ fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#444444', marginBottom: '12px' }}>GÜN</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
              {[['SA', elapsed.hours], ['DK', elapsed.minutes], ['SN', elapsed.seconds]].map(([label, val]) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: 600, color: '#ffffff' }}>{pad(val)}</div>
                  <div style={{ fontSize: '9px', letterSpacing: '0.1em', color: '#444444' }}>{label}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: '11px', color: '#444444', marginTop: '12px' }}>Sigarasız geçen süre</div>
            <button onClick={handleReset} style={{ background: 'none', border: 'none', color: '#333333', fontSize: '10px', cursor: 'pointer', marginTop: '8px' }}>
              Tarihi sıfırla
            </button>
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }} />

      {/* Gün Sonu Defteri */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#444444' }}>GÜN SONU DEFTERİ</div>
        {savedJournal && !editing ? (
          <div>
            <div style={{ fontSize: '13px', color: '#888888', lineHeight: 1.5 }}>{savedJournal}</div>
            <button onClick={() => { setJournalText(savedJournal); setEditing(true) }} style={{ background: 'none', border: 'none', color: '#b91c1c', fontSize: '11px', cursor: 'pointer', padding: '4px 0' }}>Düzenle</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <textarea
              value={journalText}
              onChange={e => setJournalText(e.target.value)}
              placeholder="Bugün nasıl geçti? Direnç anları, hisler..."
              style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: '#ffffff', padding: '10px', fontSize: '13px', width: '100%', height: '120px', resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
            />
            <button onClick={handleSaveJournal} style={{ background: '#b91c1c', border: 'none', borderRadius: '2px', color: '#ffffff', padding: '8px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.1em', cursor: 'pointer', width: '100%' }}>
              {saveMsg || 'KAYDET'}
            </button>
          </div>
        )}
        <button onClick={showPast ? () => setShowPast(false) : loadPastEntries} style={{ background: 'none', border: 'none', color: '#444444', fontSize: '11px', cursor: 'pointer', textAlign: 'left', padding: '0' }}>
          {showPast ? 'Geçmişi gizle ↑' : 'Geçmiş kayıtlar ↓'}
        </button>
        {showPast && pastEntries.map(e => (
          <div key={e.journal_date} style={{ borderLeft: '2px solid rgba(185,28,28,0.3)', paddingLeft: '8px' }}>
            <div style={{ fontSize: '10px', color: '#444444' }}>{new Date(e.journal_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}</div>
            <div style={{ fontSize: '11px', color: '#666666' }}>{e.content.slice(0, 60)}{e.content.length > 60 ? '...' : ''}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
