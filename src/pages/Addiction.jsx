import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function Addiction() {
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
    if (!user) return
    loadData()
  }, [user])

  useEffect(() => {
    if (quitDate) {
      intervalRef.current = setInterval(() => {
        const diff = Date.now() - new Date(quitDate).getTime()
        const totalSeconds = Math.floor(diff / 1000)
        setElapsed({
          days: Math.floor(totalSeconds / 86400),
          hours: Math.floor((totalSeconds % 86400) / 3600),
          minutes: Math.floor((totalSeconds % 3600) / 60),
          seconds: totalSeconds % 60,
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
    await supabase.from('addiction_journal').upsert(
      { user_id: user.id, content: journalText, journal_date: today },
      { onConflict: 'user_id,journal_date' }
    )
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

  const card = {
    background: '#111111',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 4,
    padding: 20,
  }

  const lbl = {
    fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#444444', margin: 0,
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Page header */}
      <div>
        <p style={{ ...lbl, marginBottom: 6 }}>BAĞIMLILIK TAKİPÇİSİ</p>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#ffffff', margin: 0 }}>Sigara</h1>
      </div>

      {/* Counter card */}
      <div style={card}>
        <p style={{ ...lbl, marginBottom: 16 }}>SAYAÇ</p>
        {!quitDate ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 11, color: '#888888' }}>Bırakma tarihinizi girin</div>
            <input
              type="datetime-local"
              value={inputDate}
              onChange={e => setInputDate(e.target.value)}
              style={{
                background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 4, color: '#ffffff', padding: 8, fontSize: 12,
                width: '100%', boxSizing: 'border-box', colorScheme: 'dark',
              }}
            />
            <button onClick={handleStart} style={{ background: '#b91c1c', border: 'none', borderRadius: 2, color: '#ffffff', padding: 8, fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', cursor: 'pointer', width: '100%' }}>
              BAŞLAT
            </button>
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 64, fontWeight: 700, color: '#ffffff', lineHeight: 1 }}>{elapsed.days}</div>
            <div style={{ ...lbl, marginBottom: 20, marginTop: 4 }}>GÜN</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginBottom: 16 }}>
              {[['SA', elapsed.hours], ['DK', elapsed.minutes], ['SN', elapsed.seconds]].map(([label, val]) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 600, color: '#ffffff' }}>{pad(val)}</div>
                  <div style={{ fontSize: 9, letterSpacing: '0.1em', color: '#444444' }}>{label}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: '#444444', marginBottom: 12 }}>Sigarasız geçen süre</div>
            <button onClick={handleReset} style={{ background: 'none', border: 'none', color: '#333333', fontSize: 10, cursor: 'pointer' }}>
              Tarihi sıfırla
            </button>
          </div>
        )}
      </div>

      {/* Journal card */}
      <div style={card}>
        <p style={{ ...lbl, marginBottom: 12 }}>GÜN SONU DEFTERİ</p>
        {savedJournal && !editing ? (
          <div>
            <div style={{ fontSize: 13, color: '#888888', lineHeight: 1.5, marginBottom: 8 }}>{savedJournal}</div>
            <button
              onClick={() => { setJournalText(savedJournal); setEditing(true) }}
              style={{ background: 'none', border: 'none', color: '#b91c1c', fontSize: 11, cursor: 'pointer', padding: '4px 0' }}
            >Düzenle</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <textarea
              value={journalText}
              onChange={e => setJournalText(e.target.value)}
              placeholder="Bugün nasıl geçti? Direnç anları, hisler..."
              style={{
                background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 4, color: '#ffffff', padding: 10, fontSize: 13,
                width: '100%', height: 120, resize: 'none', boxSizing: 'border-box',
                fontFamily: 'inherit', outline: 'none',
              }}
            />
            <button onClick={handleSaveJournal} style={{ background: '#b91c1c', border: 'none', borderRadius: 2, color: '#ffffff', padding: 8, fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', cursor: 'pointer', width: '100%' }}>
              {saveMsg || 'KAYDET'}
            </button>
          </div>
        )}
        <button
          onClick={showPast ? () => setShowPast(false) : loadPastEntries}
          style={{ background: 'none', border: 'none', color: '#444444', fontSize: 11, cursor: 'pointer', textAlign: 'left', padding: '12px 0 0', display: 'block' }}
        >
          {showPast ? 'Geçmişi gizle ↑' : 'Geçmiş kayıtlar ↓'}
        </button>
        {showPast && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pastEntries.map(e => (
              <div key={e.journal_date} style={{ borderLeft: '2px solid rgba(185,28,28,0.3)', paddingLeft: 8 }}>
                <div style={{ fontSize: 10, color: '#444444' }}>
                  {new Date(e.journal_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                </div>
                <div style={{ fontSize: 11, color: '#666666' }}>
                  {e.content.slice(0, 60)}{e.content.length > 60 ? '...' : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
