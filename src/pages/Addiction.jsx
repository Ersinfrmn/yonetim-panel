import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const MILESTONES = [
  { id: 1,  time: 20, unit: 'dk',    label: 'Kalp atış hızı normale döner',          detail: 'Kan basıncı düşer. El ve ayaklardaki kılcal damarlar genişler, buralardaki kan dolaşımı ve cilt sıcaklığı artar.',                                                                                      minutes: 20      },
  { id: 2,  time: 2,  unit: 'sa',    label: 'Nikotin isteği başlar',                  detail: 'Kullanıcıda huzursuzluk, kaygı ve konsantrasyon bozukluğu gibi ilk psikolojik yoksunluk belirtileri tetiklenir.',                                                                                           minutes: 120     },
  { id: 3,  time: 8,  unit: 'sa',    label: 'Karbonmonoksit yarıya azalır',           detail: 'Kandaki zehirli karbonmonoksit gazı yarı yarıya azalır. Oksijen seviyesi yükselmeye başlar. Hücrelerin beslenmesi normale döner.',                                                                           minutes: 480     },
  { id: 4,  time: 12, unit: 'sa',    label: 'CO seviyesi tamamen normale döner',      detail: 'Kandaki karbonmonoksit seviyesi tamamen normale düşer. Kalbin dokulara oksijen göndermek için ekstra çalışması durur.',                                                                                     minutes: 720     },
  { id: 5,  time: 24, unit: 'sa',    label: 'Kalp krizi riski düşmeye başlar',        detail: 'Vücuttaki akut pıhtılaşma riski azalır. Kan basıncının ve arterlerin rahatlaması sayesinde kalp krizi geçirme riski istatistiksel olarak düşmeye başlar.',                                                  minutes: 1440    },
  { id: 6,  time: 48, unit: 'sa',    label: 'Koku ve tat duyuları keskinleşir',       detail: 'Nikotinin körelttiği koku ve tat alma sinir uçları yeniden büyümeye başlar. Hasarlı akciğer hücreleri kendini tamir etmeye başlar.',                                                                        minutes: 2880    },
  { id: 7,  time: 72, unit: 'sa',    label: 'Nikotin vücuttan temizlenir',            detail: 'Nikotin vücuttan ve idrardan tamamen temizlenir. Akciğerlerdeki bronşiyoller gevşer, akciğer kapasitesi artar. Yoksunluk krizleri bu saatte zirve yapar.',                                                  minutes: 4320    },
  { id: 8,  time: 10, unit: 'gün',   label: 'Fiziksel bağımlılık tamamen biter',      detail: 'Günde 2-3 kez gelen yoğun sigara krizlerinin süresi 3 dakikanın altına iner. Psikolojik alışkanlık dönemi başlar.',                                                                                        minutes: 14400   },
  { id: 9,  time: 2,  unit: 'hafta', label: 'Kan dolaşımı optimize olur',             detail: 'Kanın akışkanlığı düzelir. Bacaklardaki ve kollardaki büyük damarlarda dolaşım optimize olur. Yürürken yaşanan bacak ağrıları ve kesilmeler biter.',                                                       minutes: 20160   },
  { id: 10, time: 1,  unit: 'ay',    label: 'Akciğer temizliği başlar',               detail: 'Akciğerlerdeki siller hızla yeniden büyür. Sigaranın biriktirdiği katran ve mukusu dışarı atmak için sağlıklı öksürük dönemi başlar.',                                                                     minutes: 43200   },
  { id: 11, time: 2,  unit: 'ay',    label: 'Akciğer fonksiyonu %30 artar',           detail: 'Akciğer fonksiyonları %30 oranında artar. Diş eti hastalıkları geriler, ağız kokusu tamamen yok olur. Ciltteki solgunluk gider, deri kendini yeniler.',                                                    minutes: 86400   },
  { id: 12, time: 3,  unit: 'ay',    label: 'Kronik semptomlar tamamen biter',        detail: 'Kronik öksürük, sinüs tıkanıklığı ve nefes darlığı tamamen ortadan kalkar. Bağışıklık sistemi güçlenir.',                                                                                                    minutes: 129600  },
  { id: 13, time: 6,  unit: 'ay',    label: 'Dopamin dengesi normale döner',          detail: 'Dopamin reseptörleri sigara öncesi doğal dengesine kavuşur. Sigara olmadan da hayattan keyif almak, stresle doğal yollarla baş etmek mümkün hale gelir.',                                                   minutes: 259200  },
  { id: 14, time: 9,  unit: 'ay',    label: 'Akciğer kapasitesi maksimuma ulaşır',   detail: 'Akciğerler hücresel düzeyde temizliğini tamamlar. Oksijen alma kapasitesi maksimum seviyeye ulaşır. Ses tonu berraklaşır.',                                                                                  minutes: 388800  },
  { id: 15, time: 1,  unit: 'yıl',   label: 'Kalp krizi riski %50 düşer',            detail: 'Damarların iç çeperindeki hasar iyileşir. Koroner kalp hastalığı ve kalp krizi riski sigara içmeye devam eden birine kıyasla %51 oranında düşer.',                                                         minutes: 525600  },
  { id: 16, time: 5,  unit: 'yıl',   label: 'İnme riski hiç içmemiş seviyeye iner', detail: 'Sigaranın neden olduğu damar sertliği süreci durur ve geriler. Felç ve inme riski, hayatı boyunca hiç sigara içmemiş bir insanın seviyesine düşer.',                                                        minutes: 2628000 },
  { id: 17, time: 10, unit: 'yıl',   label: 'Akciğer kanseri riski yarıya iner',     detail: 'Hücrelerdeki DNA mutasyon hızı normale döner. Akciğer kanseri riski sigara içenlerin yarısına iner. Birçok kanser türünün riski büyük oranda azalır.',                                                     minutes: 5256000 },
  { id: 18, time: 15, unit: 'yıl',   label: 'Tüm riskler normale döner',             detail: 'Vücuttaki tüm hücresel, vasküler ve dokusal hasarlar tamamen restore edilmiştir. Koroner kalp hastalığı riski ve ölüm oranları hiç içmemiş biriyle tamamen eşitlenir.',                                    minutes: 7884000 },
]

const MILESTONE_GROUPS = [
  { title: 'AKUT DÖNEM — İLK 3 GÜN',            items: MILESTONES.slice(0,  7)  },
  { title: 'SUBAKUT DÖNEM — 1 HAFTA - 3 AY',    items: MILESTONES.slice(7,  11) },
  { title: 'STABİLİZASYON — 3 AY - 1 YIL',      items: MILESTONES.slice(11, 14) },
  { title: 'UZUN VADELİ — 1 YIL - 15 YIL',      items: MILESTONES.slice(14, 18) },
]

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
  const [openDetails, setOpenDetails] = useState(new Set())
  const intervalRef = useRef(null)

  useEffect(() => {
    if (!user) return
    loadData()
  }, [user])

  useEffect(() => {
    if (quitDate) {
      intervalRef.current = setInterval(() => {
        const diff = Math.max(0, Date.now() - new Date(quitDate).getTime())
        const totalSeconds = Math.floor(diff / 1000)
        setElapsed({
          days:    Math.floor(totalSeconds / 86400),
          hours:   Math.floor((totalSeconds % 86400) / 3600),
          minutes: Math.floor((totalSeconds % 3600) / 60),
          seconds: totalSeconds % 60,
        })
      }, 1000)
    }
    return () => clearInterval(intervalRef.current)
  }, [quitDate])

  async function loadData() {
    // Fast path: restore from localStorage immediately (no network wait)
    const cached = localStorage.getItem('quit_datetime')
    if (cached) setQuitDate(cached)

    const today = new Date().toISOString().split('T')[0]
    const { data: tracker } = await supabase
      .from('addiction_tracker')
      .select('quit_date')
      .eq('user_id', user.id)
      .single()

    if (tracker?.quit_date) {
      // Authoritative value from DB — keep localStorage in sync
      setQuitDate(tracker.quit_date)
      localStorage.setItem('quit_datetime', tracker.quit_date)
    } else if (!cached) {
      // No data anywhere — ensure state is clear
      setQuitDate(null)
    }

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
    // Convert local datetime-local string to UTC ISO so Supabase stores it correctly.
    // Without this, a UTC+3 user entering "14:30" gets stored as 14:30 UTC,
    // making the calculated diff negative by their offset.
    const isoDate = new Date(inputDate).toISOString()
    localStorage.setItem('quit_datetime', isoDate)
    await supabase.from('addiction_tracker').upsert({ user_id: user.id, quit_date: isoDate, addiction_name: 'Sigara' })
    setQuitDate(isoDate)
  }

  async function handleReset() {
    if (!confirm('Sayacı sıfırlamak istediğinize emin misiniz?')) return
    localStorage.removeItem('quit_datetime')
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

  function toggleDetail(id) {
    setOpenDetails(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const pad = n => String(n).padStart(2, '0')

  const elapsedMinutes = quitDate
    ? elapsed.days * 1440 + elapsed.hours * 60 + elapsed.minutes
    : -1

  const nextId = quitDate
    ? (MILESTONES.find(m => m.minutes > elapsedMinutes)?.id ?? null)
    : null

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
    <>
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.75); }
        }
      `}</style>

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

        {/* Milestones card */}
        <div style={card}>
          <p style={{ ...lbl, marginBottom: 12 }}>SAĞLIK MİLESTONE'LARI</p>

          {!quitDate && (
            <p style={{ fontSize: 11, color: '#444444', margin: '0 0 12px' }}>
              Sayacı başlatınca milestone'lar aktif olur
            </p>
          )}

          {MILESTONE_GROUPS.map(group => (
            <div key={group.title}>
              <div style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#333333', marginTop: 16, marginBottom: 8 }}>
                {group.title}
              </div>
              {group.items.map(m => {
                const reached = elapsedMinutes >= m.minutes
                const isNext  = !reached && m.id === nextId

                if (reached) {
                  return (
                    <div key={m.id} style={{ padding: '10px 12px', borderRadius: 4, marginBottom: 4, borderLeft: '2px solid #22c55e', background: 'rgba(34,197,94,0.05)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ marginBottom: 4 }}>
                            <span style={{ fontSize: 10, fontWeight: 600, color: '#22c55e', background: 'rgba(34,197,94,0.15)', padding: '1px 6px', borderRadius: 2 }}>
                              {m.time} {m.unit.toUpperCase()}
                            </span>
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: '#ffffff', marginBottom: 4 }}>{m.label}</div>
                          <div style={{ fontSize: 11, color: '#666666', lineHeight: 1.5 }}>{m.detail}</div>
                        </div>
                        <div style={{ color: '#22c55e', fontSize: 12, flexShrink: 0 }}>✓</div>
                      </div>
                    </div>
                  )
                }

                if (isNext) {
                  return (
                    <div key={m.id} style={{ padding: '10px 12px', borderRadius: 4, marginBottom: 4, borderLeft: '2px solid #b91c1c', background: 'rgba(185,28,28,0.05)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ marginBottom: 4 }}>
                            <span style={{ fontSize: 10, fontWeight: 600, color: '#b91c1c', background: 'rgba(185,28,28,0.15)', padding: '1px 6px', borderRadius: 2 }}>
                              {m.time} {m.unit.toUpperCase()}
                            </span>
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: '#ffffff', marginBottom: 4 }}>{m.label}</div>
                          <div style={{ fontSize: 11, color: '#666666', lineHeight: 1.5 }}>{m.detail}</div>
                        </div>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#b91c1c', flexShrink: 0, marginTop: 4, animation: 'pulse-dot 2s ease-in-out infinite' }} />
                      </div>
                    </div>
                  )
                }

                // NOT YET
                return (
                  <div
                    key={m.id}
                    onClick={() => toggleDetail(m.id)}
                    style={{ padding: '10px 12px', borderRadius: 4, marginBottom: 4, cursor: 'pointer', borderLeft: '2px solid rgba(255,255,255,0.06)', background: 'transparent' }}
                  >
                    <div style={{ marginBottom: openDetails.has(m.id) ? 4 : 0 }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: '#333333', background: 'rgba(255,255,255,0.04)', padding: '1px 6px', borderRadius: 2 }}>
                        {m.time} {m.unit.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: '#444444', marginTop: 4 }}>{m.label}</div>
                    {openDetails.has(m.id) && (
                      <div style={{ fontSize: 11, color: '#666666', lineHeight: 1.5, marginTop: 4 }}>{m.detail}</div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
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
    </>
  )
}
