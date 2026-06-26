# EF Komuta Merkezi — Master Spec

> **Versiyon:** 1.0  
> **Tarih:** 26 Haziran 2026  
> **Durum:** Onay bekliyor — inşa öncesi referans belgesi

---

## İçindekiler

1. [Vizyon](#1-vizyon)
2. [Mevcut Durum (Baseline)](#2-mevcut-durum-baseline)
3. [Temel Kavramlar](#3-temel-kavramlar)
4. [Mimari](#4-mimari)
5. [Navigasyon](#5-navigasyon)
6. [Modül Spesifikasyonları](#6-modül-spesifikasyonları)
7. [İnşa Fazları](#7-inşa-fazları)
8. [Veritabanı Planı](#8-veritabanı-planı)
9. [Sistem Kuralları](#9-sistem-kuralları)
10. [Uygulama İçi İçerik](#10-uygulama-içi-içerik)
11. [v2 Backlog](#11-v2-backlog)
12. [Teknik Kısıtlar](#12-teknik-kısıtlar)
13. [Migration Stratejisi](#13-migration-stratejisi)

---

## 1. Vizyon

**EF Komuta Merkezi**, tek kullanıcılı kişisel operasyon merkezidir. Amaç: plan yapmak, takip etmek, analiz etmek ve kendini yönetmek — hepsini tek akışta.

### Dört katman

| Katman | Soru | Modüller |
|--------|------|----------|
| **Plan** | Nereye gidiyorum, bu hafta ne? | Hedefler, Haftalık Plan |
| **Takip** | Bugün plana uyuyor muyum? | Görevler, Alışkanlıklar, Pomodoro, Günlük |
| **Analiz** | Ne işe yarıyor, nerede kayıyorum? | İstatistik, Review |
| **Yönetim** | Karar ver, düzelt, devam et | Komuta Merkezi, Komuta Modu, sistem kuralları |

### Günlük operasyon ritmi

**Sabah brifingi (5–10 dk)** — Komuta Modu wizard:
1. Alışkanlıkları gözden geçir / işaretle
2. Bugünün 3 kritik görevini (MIT) seç
3. Hedeflerle hizala: “Bu görev hangi hedefe hizmet ediyor?”
4. Pomodoro başlat (isteğe bağlı)

**Gün içi takip:**
- Görev, alışkanlık, pomodoro ilerlemesi
- Komuta Merkezi’nde “bugün % kaç tamamlandı?”

**Gece debrief (5 dk)** — Komuta Modu wizard:
1. Günlük yaz (prompt ile)
2. Ne tamamlandı, ne ertelendi
3. Yarının 1–3 önceliğini belirle

### Kapsam dışı (bilinçli)

Aşağıdakiler v2 backlog’da; çekirdek komuta merkezi olmadan anlamsız veya ayrı sistemlerle daha iyi çözülür:

- Finansal hedefler (opsiyonel, en son)
- Google Calendar tam senkronu
- AI özellikleri
- Native mobil widget (iOS/Android)
- Çok rollü / kurumsal yönetim

---

## 2. Mevcut Durum (Baseline)

### Teknoloji

| Alan | Değer |
|------|-------|
| Frontend | React 19, Vite 8, React Router 7, Tailwind 3 |
| Backend | Supabase (PostgreSQL + RLS) |
| Auth | Google OAuth (tek kullanıcı) |
| Dil | Türkçe UI |
| Deploy | Vercel |

### Rotalar (mevcut)

| Rota | Sayfa | Not |
|------|-------|-----|
| `/` | → `/habits` yönlendirme | **Değişecek** → Komuta Merkezi |
| `/login` | Google giriş | |
| `/habits` | Alışkanlık takibi | Varsayılan ana sayfa (geçici) |
| `/todos` | Görev listesi | |
| `/journal` | Günlük | |
| `/goals` | Hedefler | |
| `/pomodoro` | Pomodoro | |
| `/stats` | İstatistik | |

### Veritabanı tabloları (mevcut)

| Tablo | İçerik |
|-------|--------|
| `habits` | id, user_id, name, created_at |
| `habit_logs` | habit_id, date, completed |
| `habit_break_reasons` | habit_id, break_date, reason (min 100 karakter UI zorunluluğu) |
| `tasks` | title, due_date, priority (low/medium/high), completed |
| `journal_entries` | date, content (unique user+date) |
| `goals` | title, description, type (weekly/monthly), target_date, status |
| `goal_tasks` | goal_id, title, completed |
| `pomodoro_sessions` | started_at, duration_minutes, completed |

### Modül bazında mevcut özellikler

**Alışkanlıklar**
- Ekleme, silme, günlük tamamlama toggle
- 14 günlük zincir görselleştirmesi (ChainBoxes)
- Mevcut seri, en uzun seri, son kırılma tarihi
- Zincir kırılınca 100+ karakter açıklama zorunluluğu (kayıt var, arşiv UI yok)
- Düzenleme yok, süre yok, heatmap yok, kriz yönetimi yok

**Görevler**
- Ekleme, silme, tamamlama toggle
- Son tarih, öncelik (düşük/orta/yüksek)
- Filtreler: Tümü, Aktif, Tamamlanan, Bugün
- Düzenleme, alt görev, etiket, tekrarlama, Eisenhower yok

**Günlük**
- Tarih seçici, otomatik kayıt (1,5 sn debounce), kelime sayısı
- Son 10 geçmiş kayıt
- Prompt, mood, markdown, özet yok

**Hedefler**
- Haftalık/aylık tip, açıklama, hedef tarihi, durum
- Alt görevler + progress bar
- SMART rehber, kilometre taşları, şablon yok

**Pomodoro**
- Çalışma (25), kısa mola (5), uzun mola (15) — ayarlanabilir
- Dairesel progress, Web Audio beep
- Sadece çalışma seansları DB’ye kaydediliyor
- Odak modu, görev bağlantısı, otomatik geçiş, mola önerileri yok

**İstatistik**
- Haftalık/aylık tamamlanan görevler, günlük serisi, pomodoro, aktif alışkanlık sayısı
- Son 7 gün bar chart, son 30 gün line chart
- Hedef, mood, export, review yok

**Genel eksikler**
- Ana dashboard yok
- Haftalık plan yok
- PWA / bildirim yok
- Komuta Modu (sabah/gece ritüeli) yok
- Sidebar gruplama yok

---

## 3. Temel Kavramlar

Notlardaki “3” karmaşasını gidermek için üç ayrı kavram tanımlanır. **Farklı veri, farklı amaç.**

### 3.1 Haftalık Odak (Weekly Focus)

| Özellik | Değer |
|---------|-------|
| **Ne** | Bu haftanın 3 stratejik odağı |
| **Süre** | Pazartesi–Pazar, hafta başında belirlenir |
| **Nerede görünür** | Komuta Merkezi, Haftalık Plan sayfası |
| **Veri** | `weekly_plans.focus_1`, `focus_2`, `focus_3` |
| **Örnek** | “Maraton antrenmanına devam”, “Proje X’i bitir”, “Her gün 30 dk okuma” |

### 3.2 Günlük MIT (Most Important Tasks)

| Özellik | Değer |
|---------|-------|
| **Ne** | Bugün mutlaka bitirilecek en fazla 3 görev |
| **Süre** | Her sabah seçilir (sabah brifingi) |
| **Nerede görünür** | Komuta Merkezi, “Şimdi ne yapmalıyım?” |
| **Veri** | `daily_priorities` → `task_id` referansı, `date`, `rank` (1–3) |
| **Kural** | Günde max 3; 4. eklenmek istenirse uyarı |

### 3.3 Aktif Hedef Limiti

| Özellik | Değer |
|---------|-------|
| **Ne** | Aynı anda devam eden hedef sayısı |
| **Limit** | Max 3 aktif (`status = in-progress`) |
| **Nerede uygulanır** | Hedefler modülü — yeni hedef eklerken |
| **Veri** | Mevcut `goals` tablosu, uygulama katmanında kontrol |

### 3.4 Momentum Skoru

Son 7 günün birleşik performansı. Komuta Merkezi’nde 0–100 gösterilir.

```
Momentum = round(
  habit_rate   × 0.40 +
  task_rate    × 0.30 +
  pomodoro_rate × 0.20 +
  journal_rate  × 0.10
)

habit_rate    = (tamamlanan alışkanlık-günleri) / (toplam alışkanlık × 7) × 100
task_rate     = (7 günde tamamlanan görevler) / (7 günde due olan veya oluşturulan görevler) × 100
pomodoro_rate = min(100, (7 gündeki seans sayısı / hedef_seans) × 100)   // hedef_seans varsayılan: 10
journal_rate  = (7 günde yazılan gün sayısı / 7) × 100
```

Boş veri durumunda: ilgili bileşen 0; en az bir modül doluysa skor hesaplanır.

### 3.5 Motivasyon Cümlesi

Komuta Merkezi’nde günlük gösterilir. Öncelik sırası:

1. Kullanıcının dün veya bugünkü günlük entry’sinden rastgele bir cümle (min 20 karakter)
2. Yoksa: sabit Türkçe verimlilik sözleri havuzundan güne göre deterministik seçim (aynı gün aynı söz)

---

## 4. Mimari

```
                    ┌─────────────────────────┐
                    │   Komuta Merkezi (/)    │
                    │  Dashboard + Komuta Modu│
                    └───────────┬─────────────┘
                                │
          ┌─────────────────────┼─────────────────────┐
          ▼                     ▼                     ▼
    ┌───────────┐        ┌───────────┐        ┌───────────┐
    │   PLAN    │        │   TAKİP   │        │  ANALİZ   │
    │ Hedefler  │        │ Görevler  │        │İstatistik │
    │ Haftalık  │        │Alışkanlık │        │  Review   │
    │   Plan    │        │ Pomodoro  │        │           │
    │           │        │  Günlük   │        │           │
    └───────────┘        └───────────┘        └───────────┘
          │                     │                     │
          └─────────────────────┴─────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │   YÖNETİM KATMANI     │
                    │ Kurallar · Ritüeller  │
                    │ Komuta Notları        │
                    └───────────────────────┘
```

### Komuta Modu

Ayrı nav item **değil**. Komuta Merkezi (`/`) üzerinde:
- Sabah: “Günü Başlat” butonu → adım adım wizard (modal veya tam sayfa akış)
- Akşam: “Günü Kapat” butonu → debrief wizard

---

## 5. Navigasyon

### Yeni sidebar yapısı

```
📍 Komuta Merkezi          →  /
─── Plan ───
   Hedefler                →  /goals
   Haftalık Plan            →  /weekly-plan
─── Takip ───
   Görevler                →  /todos
   Alışkanlıklar           →  /habits
   Pomodoro                →  /pomodoro
   Günlük                  →  /journal
─── Analiz ───
   İstatistik              →  /stats
   Review                  →  /stats?tab=review  (veya /review)
```

Mobil alt nav: Komuta Merkezi + 4 en sık kullanılan (Görevler, Alışkanlıklar, Pomodoro, Günlük). Diğerleri “Daha fazla” menüsünde.

---

## 6. Modül Spesifikasyonları

### 6.1 Komuta Merkezi (`/`)

**Amaç:** Tek ekranda bugünün durumu ve yönlendirme.

#### Dashboard bileşenleri

| Bileşen | Açıklama |
|---------|----------|
| **Günün özeti kartı** | Bugün tamamlanan: alışkanlık X/Y, görev X/Y, pomodoro X seans |
| **Haftalık 3 odak** | `weekly_plans`’tan; tıklanınca Haftalık Plan’a git |
| **Günlük MIT (3)** | `daily_priorities`’tan; checkbox ile tamamla |
| **Şimdi ne yapmalıyım?** | Öncelik: (1) devam eden pomodoro, (2) en yakın son tarihli tamamlanmamış MIT, (3) eksik alışkanlık |
| **Momentum skoru** | 0–100, son 7 gün, mini sparkline |
| **Motivasyon cümlesi** | Bkz. §3.5 |
| **Bugün ilerleme çubuğu** | Alışkanlık + görev + pomodoro ağırlıklı tek yüzde |
| **Dün / geçen hafta mini özet** | 1 satır: “Dün 2/3 MIT, 4/5 alışkanlık” |
| **Komuta Modu CTA** | “Günü Başlat” / “Günü Kapat” (saate göre varsayılan) |

#### Komuta Modu — Sabah brifingi

| Adım | İçerik |
|------|--------|
| 1 | Bugünkü alışkanlıklar listesi — hızlı işaretle |
| 2 | Bugünün 3 MIT’ini görev listesinden seç (veya yeni görev oluştur) |
| 3 | Her MIT için opsiyonel hedef bağlantısı |
| 4 | “Pomodoro başlat” veya “Komuta Merkezi’ne dön” |

#### Komuta Modu — Gece debrief

| Adım | İçerik |
|------|--------|
| 1 | Günlük prompt ile yaz (kısa textarea) |
| 2 | Bugün tamamlanan / ertelenen MIT özeti |
| 3 | Yarının 1–3 önceliğini seç (ertesi gün `daily_priorities`’a yaz) |

---

### 6.2 Haftalık Plan (`/weekly-plan`)

**Amaç:** Taktik planlama — “Bu hafta ne?”

| Özellik | Detay |
|---------|-------|
| Hafta seçici | Pazartesi–Pazar; ok ile önceki/sonraki hafta |
| Haftanın 3 odağı | Metin alanları; Komuta Merkezi ile senkron |
| Günlük dağılım | Pzt–Paz her gün için görev atama (mevcut görevlerden sürükle/bırak veya dropdown) |
| Hedef bağlantısı | Haftalık planda hangi hedef(ler)e hizmet ettiği (opsiyonel `goal_id`) |
| Hafta sonu review | Pazar veya manuel: “Plan vs gerçekleşen” — tamamlanan görev %, odak durumu, not alanı |
| Veri | `weekly_plans`, `weekly_plan_tasks` |

---

### 6.3 Alışkanlıklar (`/habits`)

#### Mevcut (korunacak)
- 14 günlük zincir, seri istatistikleri, kırılma açıklama zorunluluğu

#### Yeni / geliştirilecek

| ID | Özellik | Detay |
|----|---------|-------|
| H1 | **Süre belirleme** | Yeni alışkanlık eklerken ilk adım: süre sor |
| | | Seçenekler: X gün / X hafta / X ay / süresiz |
| | | `duration_type`: `days` \| `weeks` \| `months` \| `indefinite` |
| | | `duration_value`: integer (süresiz ise null) |
| | | `start_date`: default bugün |
| | | `end_date`: hesaplanır veya null |
| H2 | **Süre bitişi davranışı** | Süre dolunca: kart “Tamamlandı” arşiv durumuna geçer; kutlama toast; yenileme veya süresiz uzatma teklifi |
| H3 | **Düzenleme** | Ad, süre, başlangıç tarihi sonradan değiştirilebilir |
| H4 | **365 günlük heatmap** | GitHub tarzı; alışkanlık detayında; yeşil ton = tamamlama |
| H5 | **Alışkanlık geçmişi** | Tamamlama listesi (tarih + durum) + heatmap birlikte |
| H6 | **Kriz yönetimi** | Her alışkanlık kartında genişletilebilir alt bölüm |
| | | Serbest metin; düz yazı; zaman damgalı girdiler (`habit_crisis_notes`) |
| | | Kırılma anında değil — istediğin zaman yaz |
| H7 | **Kırılma arşivi** | `habit_break_reasons` listesi; filtre: alışkanlığa göre |
| H8 | **Pattern analizi** | “En çok hangi gün kırılıyor?” — haftanın günü dağılımı (%); Stats/Review’da da özet |
| H9 | **Şablonlar / kütüphane** | Tek özellik: hazır alışkanlık paketleri |
| | | Tek tıkla ekle veya paket (ör. “Sabah rutini” = 3 alışkanlık) |
| | | Kategoriler: Sabah rutini, Spor, Okuma, Sağlık, Öğrenme |

---

### 6.4 Görevler (`/todos`)

| ID | Özellik | Detay |
|----|---------|-------|
| T1 | **Düzenleme** | Başlık, son tarih, öncelik inline veya modal |
| T2 | **Alt görevler** | `task_subtasks` tablosu; parent task altında checklist |
| T3 | **Etiketler** | `tags` text array veya ayrı tablo; UI: #iş #kişisel #acil |
| T4 | **Tekrarlayan görevler** | `recurrence`: `none` \| `daily` \| `weekly` \| `monthly`; tamamlanınca sonraki oluştur |
| T5 | **Eisenhower matrisi** | `urgent` boolean + `important` boolean; 2×2 görünüm filtresi |
| T6 | **Görev ↔ hedef bağlantısı** | `goal_id` nullable FK |
| T7 | **Erteleme nedeni** | Son tarih ertelenince kısa neden zorunlu (`task_deferrals`) |
| T8 | **MIT işareti** | `daily_priorities` ile bağlantı; görev kartında “Bugünün önceliği” badge |

**Not:** Mevcut `priority` (low/medium/high) korunur; Eisenhower ayrı alanlardır.

---

### 6.5 Günlük (`/journal`)

| ID | Özellik | Detay |
|----|---------|-------|
| J1 | **Prompt’lar** | Üstte günlük soru; kategoriler: reflection, gratitude, planning |
| | | “Bugün ne öğrendim?”, “Minnettar olduğum 3 şey” vb. |
| | | Prompt kütüphanesi: 50+ soru (Faz 4’te tam liste) |
| J2 | **Ruh hali** | 1–5 emoji seçimi; `journal_entries.mood` (1–5) |
| J3 | **Markdown** | `react-markdown` ile render; toolbar: kalın, liste, başlık |
| J4 | **Haftalık/aylık özet** | Kelime sayısı trendi (v1); AI özeti v2 backlog |
| J5 | **Stats korelasyonu** | Alışkanlık × ruh hali grafiği (Stats modülünde) |

---

### 6.6 Hedefler (`/goals`)

| ID | Özellik | Detay |
|----|---------|-------|
| G1 | **SMART rehberi** | Form alanlarında ipuçları: Specific, Measurable, Achievable, Relevant, Time-bound |
| G2 | **Kilometre taşları** | Alt görev % ile: %25, %50, %75’te kutlama toast (konfeti Faz 7) |
| G3 | **Hedef şablonları** | Galeri: “3 ayda İngilizce B1”, “Maraton hazırlığı”, kariyer/sağlık/öğrenme |
| G4 | **Aktif hedef limiti** | Max 3 in-progress; aşılırsa uyarı |
| G5 | **Hedef ↔ görev ↔ alışkanlık** | Stats’ta birlikte izleme (bağlantılı kayıt sayısı) |
| G6 | **Geride kalma refleksiyonu** | Hedef tarihi geçince kısa neden alanı (v2 veya Faz 6) |

---

### 6.7 Pomodoro (`/pomodoro`)

| ID | Özellik | Detay |
|----|---------|-------|
| P1 | **Odak modu** | Tam ekran; sidebar/header gizle; sadece timer |
| P2 | **Görev/alışkanlık bağlantısı** | Seans başlamadan seç: `task_id` veya `habit_id` |
| P3 | **Mola önerileri** | Mola modunda kart: su, esneme, göz dinlendirme, nefes |
| P4 | **Haftalık odak raporu** | Stats/Review: saat dilimine göre seans dağılımı |
| P5 | **Zil sesi** | Mevcut beep korunur; ayarlardan aç/kapa |
| P6 | **Otomatik mola** | Çalışma bitince kısa molaya geç (ayarlanabilir) |
| P7 | **Otomatik pomodoro** | Mola bitince çalışmaya geç (ayarlanabilir) |
| P8 | **Bildirim** | Seans/mola bitince tarayıcı bildirimi (Faz 5) |

---

### 6.8 İstatistik & Review (`/stats`)

#### İstatistik sekmesi

| ID | Özellik | Detay |
|----|---------|-------|
| S1 | **Mevcut grafikler** | Korunur |
| S2 | **Hedef ilerlemesi** | Aktif hedefler progress bar |
| S3 | **Alışkanlık × ruh hali** | Mood ortalaması vs alışkanlık tamamlama oranı |
| S4 | **En verimli gün** | Badge: en yüksek birleşik skorlu gün (son 30 gün) |
| S5 | **Kırılma özeti** | Haftanın günü dağılımı |
| S6 | **Pomodoro saat haritası** | Haftalık odak raporu |
| S7 | **Export** | CSV (v1), PDF (v2 backlog) |

#### Review sekmesi

| ID | Özellik | Detay |
|----|---------|-------|
| R1 | **Haftalık review** | Otomatik özet: hedef %, alışkanlık serisi, pomodoro saat, kırılma sayısı, ertelenen görev |
| R2 | **Trend uyarıları** | “Son 2 hafta günlük yazmadın”, “X alışkanlığı 5 gündür eksik” |
| R3 | **Eylem önerisi** | “Gelecek hafta odak: …” — kullanıcı düzenleyebilir |
| R4 | **Haftalık review checklist** | “Bu hafta ne iyi gitti? Gelecek hafta odak?” |
| R5 | **Plan vs gerçekleşen** | Haftalık Plan modülü verisiyle birleşik |

---

### 6.9 Disiplin Paketi (çapraz modül)

Alışkanlık + Görev + Pomodoro + Review birlikte:

| Özellik | Modül |
|---------|-------|
| 365 heatmap | Alışkanlıklar (H4) |
| Kırılma arşivi + pattern | Alışkanlıklar (H7, H8) + Stats (S5) |
| Odak modu + bağlantı | Pomodoro (P1, P2) |
| Erteleme nedeni | Görevler (T7) |
| Haftalık review özeti | Review (R1) |

---

### 6.10 PWA & Bildirimler

#### PWA (Faz 5)

| Özellik | Detay |
|---------|-------|
| `manifest.json` | name, icons, theme_color, display: standalone |
| Service worker | App shell cache; son görülen veri (read-only offline) |
| Ana ekrana ekle | Add to Home Screen rehberi (ilk ziyaret tooltip) |
| `index.html` | `lang="tr"`, viewport, apple-touch-icon |

**Not:** Native widget (iOS/Android ana ekran widget’ı) v2 — PWA ile karıştırılmaz.

#### Bildirimler (Faz 5)

| Bildirim | Varsayılan saat | Ayar |
|----------|-----------------|------|
| Alışkanlık hatırlatıcı | 20:00 | Açık/kapa + saat |
| Görev son tarih | Due günü 09:00 | Açık/kapa |
| Pomodoro bitiş | Anlık | Açık/kapa |
| Sabah brifingi | 08:00 | Açık/kapa |

**Ayarlar sayfası:** `/settings` — bildirim tercihleri, pomodoro otomatik geçiş, tema.

**iOS kısıtı:** PWA ana ekrana eklendikten sonra bildirimler daha güvenilir; kullanıcıya not göster.

---

## 7. İnşa Fazları

Tek sıralı roadmap. **Her faz bitmeden sonrakine geçilmez.**

### Faz 1 — Komuta Merkezi çekirdeği
**Hedef:** Uygulama hissi; `/` artık komuta merkezi.

| # | İş | Modül |
|---|-----|-------|
| 1.1 | `Dashboard.jsx` — günün özeti, momentum, motivasyon | Komuta Merkezi |
| 1.2 | `weekly_plans` + haftalık 3 odak UI | Komuta Merkezi |
| 1.3 | `daily_priorities` + MIT seçimi | Komuta Merkezi |
| 1.4 | “Şimdi ne yapmalıyım?” mantığı | Komuta Merkezi |
| 1.5 | Sabah brifingi wizard | Komuta Modu |
| 1.6 | Gece debrief wizard | Komuta Modu |
| 1.7 | `/` rotası + sidebar gruplama | App, Layout |
| 1.8 | Aktif hedef limiti (3) | Hedefler |

**Çıktı:** Giriş yapınca komuta merkezi; sabah/akşam ritüeli çalışır.

---

### Faz 2 — Plan katmanı
**Hedef:** Haftalık planlama ve görev temeli.

| # | İş | Modül |
|---|-----|-------|
| 2.1 | Haftalık Plan sayfası | Haftalık Plan |
| 2.2 | Günlere görev dağıtımı | Haftalık Plan |
| 2.3 | Hedef bağlantısı (haftalık plan + görev) | Haftalık Plan, Görevler |
| 2.4 | Hafta sonu mini review | Haftalık Plan |
| 2.5 | Görev düzenleme | Görevler |
| 2.6 | Görev ↔ hedef (`goal_id`) | Görevler |

**Çıktı:** Pazartesi haftayı planla, hafta boyunca takip et.

---

### Faz 3 — Disiplin (alışkanlık + pomodoro)
**Hedef:** Alışkanlık derinleşmesi ve odak.

| # | İş | Modül |
|---|-----|-------|
| 3.1 | Süre belirleme + düzenleme + bitiş davranışı | Alışkanlıklar |
| 3.2 | Kriz yönetimi notları | Alışkanlıklar |
| 3.3 | 365 heatmap + geçmiş listesi | Alışkanlıklar |
| 3.4 | Kırılma arşivi + pattern analizi | Alışkanlıklar, Stats |
| 3.5 | Alışkanlık şablonları | Alışkanlıklar |
| 3.6 | Odak modu | Pomodoro |
| 3.7 | Görev/alışkanlık bağlantısı | Pomodoro |
| 3.8 | Otomatik mola/pomodoro geçişi | Pomodoro |
| 3.9 | Mola önerileri | Pomodoro |

**Çıktı:** Disiplin modülü tam paket.

---

### Faz 4 — Günlük & görev genişletme
**Hedef:** Refleksiyon ve görev esnekliği.

| # | İş | Modül |
|---|-----|-------|
| 4.1 | Günlük prompt’ları + kütüphane (50+ soru) | Günlük |
| 4.2 | Ruh hali (1–5 emoji) | Günlük |
| 4.3 | Markdown desteği | Günlük |
| 4.4 | Kelime sayısı haftalık/aylık trend | Günlük, Stats |
| 4.5 | Alt görevler + etiketler | Görevler |
| 4.6 | Tekrarlayan görevler | Görevler |
| 4.7 | Eisenhower matrisi | Görevler |
| 4.8 | Erteleme nedeni | Görevler |

**Çıktı:** Günlük ve görevler production-ready.

---

### Faz 5 — PWA & bildirimler
**Hedef:** Telefondan erişim ve hatırlatıcılar.

| # | İş | Modül |
|---|-----|-------|
| 5.1 | manifest.json + icons | PWA |
| 5.2 | Service worker + offline shell | PWA |
| 5.3 | `/settings` sayfası | Ayarlar |
| 5.4 | Bildirim izni + zamanlama | Bildirimler |
| 5.5 | Alışkanlık / görev / pomodoro / sabah bildirimleri | Bildirimler |

**Çıktı:** Ana ekrana eklenebilir, hatırlatıcılar çalışır.

---

### Faz 6 — Analiz katmanı
**Hedef:** Sayılar karar üretir.

| # | İş | Modül |
|---|-----|-------|
| 6.1 | Review sekmesi | Stats |
| 6.2 | Haftalık review otomatik özeti | Review |
| 6.3 | Trend uyarıları | Review |
| 6.4 | Hedef ilerlemesi grafikleri | Stats |
| 6.5 | Alışkanlık × ruh hali korelasyonu | Stats |
| 6.6 | En verimli gün badge | Stats |
| 6.7 | Pomodoro saat haritası | Stats |
| 6.8 | CSV export | Stats |
| 6.9 | SMART rehber + hedef şablonları + kilometre taşları | Hedefler |
| 6.10 | JSON export/import (yedekleme) | Ayarlar |

**Çıktı:** Tam analiz ve review döngüsü.

---

### Faz 7 — Derinleşme (v1 son)
**Hedef:** Motivasyon, onboarding, UX cilası.

| # | İş | Modül |
|---|-----|-------|
| 7.1 | Onboarding (3 alışkanlık + 1 hedef) | Genel |
| 7.2 | Komuta notları (“Bu ay odak: X”) | Komuta Merkezi |
| 7.3 | Tema varyantları (Odak, Enerji) | Ayarlar |
| 7.4 | Verimlilik rehberleri (in-app makaleler) | İçerik |
| 7.5 | Gamification: XP, rozetler, meydan okuma | Gamification |
| 7.6 | Streak joker (ayda 1, refleksiyon zorunlu) | Alışkanlıklar |
| 7.7 | Kutlama animasyonları (konfeti) | Hedefler |
| 7.8 | README + SETUP güncelleme | Dokümantasyon |

---

## 8. Veritabanı Planı

### 8.1 Faz 1 — Yeni tablolar

```sql
-- Haftalık plan
create table weekly_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  week_start date not null,  -- ilgili haftanın Pazartesi'si
  focus_1 text default '',
  focus_2 text default '',
  focus_3 text default '',
  review_notes text default '',
  review_completed boolean default false,
  created_at timestamptz default now(),
  unique(user_id, week_start)
);

-- Günlük MIT
create table daily_priorities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  task_id uuid references tasks(id) on delete cascade not null,
  rank integer not null check (rank between 1 and 3),
  created_at timestamptz default now(),
  unique(user_id, date, rank),
  unique(user_id, date, task_id)
);
```

### 8.2 Faz 2 — Görev genişletme

```sql
alter table tasks add column goal_id uuid references goals(id) on delete set null;

create table weekly_plan_tasks (
  id uuid primary key default gen_random_uuid(),
  weekly_plan_id uuid references weekly_plans(id) on delete cascade not null,
  task_id uuid references tasks(id) on delete cascade not null,
  day_of_week integer not null check (day_of_week between 0 and 6),  -- 0=Pzt
  unique(weekly_plan_id, task_id, day_of_week)
);
```

### 8.3 Faz 3 — Alışkanlık & Pomodoro

```sql
alter table habits add column duration_type text
  check (duration_type in ('days','weeks','months','indefinite')) default 'indefinite';
alter table habits add column duration_value integer;
alter table habits add column start_date date default current_date;
alter table habits add column end_date date;
alter table habits add column status text
  check (status in ('active','completed','archived')) default 'active';

create table habit_crisis_notes (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid references habits(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  content text not null,
  created_at timestamptz default now()
);

alter table pomodoro_sessions add column task_id uuid references tasks(id) on delete set null;
alter table pomodoro_sessions add column habit_id uuid references habits(id) on delete set null;
alter table pomodoro_sessions add column session_type text
  check (session_type in ('work','short_break','long_break')) default 'work';
```

### 8.4 Faz 4 — Günlük & görev

```sql
alter table journal_entries add column mood integer check (mood between 1 and 5);

create table task_subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete cascade not null,
  title text not null,
  completed boolean default false,
  sort_order integer default 0
);

alter table tasks add column urgent boolean default false;
alter table tasks add column important boolean default false;
alter table tasks add column tags text[] default '{}';
alter table tasks add column recurrence text
  check (recurrence in ('none','daily','weekly','monthly')) default 'none';

create table task_deferrals (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  old_due_date date,
  new_due_date date,
  reason text not null,
  created_at timestamptz default now()
);
```

### 8.5 Faz 5 — Ayarlar

```sql
create table user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  notification_habits_enabled boolean default true,
  notification_habits_time time default '20:00',
  notification_tasks_enabled boolean default true,
  notification_pomodoro_enabled boolean default true,
  notification_morning_enabled boolean default true,
  notification_morning_time time default '08:00',
  pomodoro_auto_break boolean default false,
  pomodoro_auto_work boolean default false,
  theme_variant text default 'default',
  onboarding_completed boolean default false,
  updated_at timestamptz default now()
);
```

### 8.6 Faz 7 — Gamification & komuta notları

```sql
create table user_gamification (
  user_id uuid primary key references auth.users(id) on delete cascade,
  xp integer default 0,
  level integer default 1,
  jokers_remaining integer default 1,
  jokers_reset_at date,
  updated_at timestamptz default now()
);

create table user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  badge_key text not null,
  earned_at timestamptz default now(),
  unique(user_id, badge_key)
);

create table command_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  period_type text check (period_type in ('monthly','quarterly')) default 'monthly',
  period_start date not null,
  content text not null,
  created_at timestamptz default now()
);
```

**Tüm yeni tablolarda RLS:** `auth.uid() = user_id`

---

## 9. Sistem Kuralları

| Kural | Değer | Uygulama |
|-------|-------|----------|
| Aktif hedef limiti | Max 3 | Goals — insert kontrolü |
| Günlük MIT limiti | Max 3 | Daily priorities — insert kontrolü |
| Haftalık odak | Tam 3 alan önerilir, zorunlu değil | UX uyarısı |
| Alışkanlık kırılma açıklaması | Min 100 karakter | Mevcut — korunur |
| Görev erteleme açıklaması | Min 20 karakter | Faz 4 |
| Streak joker | Ayda 1; kullanımda kısa refleksiyon | Faz 7 |
| Review döngüsü | Haftalık Pazar hatırlatıcı | Faz 5 bildirim + Faz 6 review |

---

## 10. Uygulama İçi İçerik

Statik içerik; Faz 4–7’de modül modül eklenir.

| İçerik | Adet | Faz | Konum |
|--------|------|-----|-------|
| Günlük prompt kütüphanesi | 50+ soru | 4 | Günlük |
| Alışkanlık şablonları | 20–30 + 5 paket | 3 | Alışkanlıklar |
| Hedef şablon galerisi | 10–15 | 6 | Hedefler |
| Mola aktiviteleri | 8–10 kart | 3 | Pomodoro |
| Verimlilik rehberleri | 5 kısa makale | 7 | `/guides` veya modal |
| Motivasyon sözleri | 30+ | 1 | Komuta Merkezi |
| Haftalık review checklist | 1 şablon | 6 | Review |

---

## 11. v2 Backlog

Çekirdek 7 faz tamamlandıktan sonra değerlendirilir.

### Yeni modüller

| Modül | Açıklama | Not |
|-------|----------|-----|
| Notlar / Inbox | Hızlı yakalama → görev/hedefe dönüştür | Orta öncelik |
| Proje panosu | Kanban: Yapılacak → Devam → Bitti | Görev genişlemesi olabilir |
| Okuma listesi | Kitap/makale + sayfa hedefi | Düşük |
| Sağlık rutini | Su, uyku, adım (manuel) | Düşük |
| Zaman çizelgesi | Günün saatlerine blok planlama | Takvim sync ile birlikte |
| Finansal hedefler | Basit birikim takibi | Opsiyonel |

### Entegrasyonlar

| Entegrasyon | Efor |
|-------------|------|
| Google Calendar sync | Yüksek |
| Haftalık e-posta özeti (Edge Function + Resend) | Orta |
| Supabase Realtime (çok cihaz anlık sync) | Orta |
| AI günlük/aylık özet | Orta + maliyet |
| PDF export | Düşük |

### UX / teknik

| Özellik | Not |
|---------|-----|
| Native mobil widget | Ayrı native app gerekir; PWA değil |
| TypeScript migration | İsteğe bağlı |
| Test suite | İsteğe bağlı |
| i18n | UI zaten Türkçe sabit |

---

## 12. Teknik Kısıtlar

| Konu | Kısıt | Çözüm |
|------|-------|-------|
| iOS bildirimleri | Safari kısıtlı | PWA ana ekran rehberi; kullanıcı bilgilendirme |
| Offline | Tam sync zor | Faz 5: shell + son cache |
| AI | API maliyeti | v1: kelime trendi; AI v2 |
| PDF | Ek kütüphane | v2; v1 CSV yeterli |
| Heatmap performans | 365 × N alışkanlık | Lazy load; alışkanlık detayında render |
| Gamification vs disiplin | Joker vs 100 char kural | Joker kullanımında da kısa refleksiyon zorunlu |

---

## 13. Migration Stratejisi

### Mevcut kullanıcı verisi

| Tablo | Migration |
|-------|-----------|
| `habits` | Faz 3: `duration_type = 'indefinite'`, `status = 'active'` default |
| `tasks` | Faz 2/4: yeni kolonlar nullable/default |
| `journal_entries` | Faz 4: `mood` nullable |
| `pomodoro_sessions` | Faz 3: `session_type = 'work'` default |

### SQL dosyaları

```
supabase-setup.sql          — mevcut (baseline)
supabase/migrations/
  001_faz1_command_center.sql
  002_faz2_weekly_plan.sql
  003_faz3_discipline.sql
  004_faz4_journal_tasks.sql
  005_faz5_settings.sql
  006_faz6_review.sql       — gerekirse
  007_faz7_gamification.sql
```

Her migration idempotent (`IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`).

### Dokümantasyon güncellemeleri (Faz 7)

- `README.md` — proje tanımı, EF Komuta Merkezi
- `SETUP.md` — yeni tablolar, settings, PWA notları
- `MASTER_SPEC.md` — bu belge; faz tamamlandıkça durum güncellenir

---

## Ek: Proje adlandırma

| Bağlam | Ad |
|--------|-----|
| UI / kullanıcı | EF Komuta Merkezi |
| Repo / paket | yo-netim-panel |
| Eski dokümantasyon | ProductiFlow → kademeli olarak EF Komuta Merkezi |

---

## Ek: Faz tamamlanma kriterleri

Her faz için **Definition of Done:**

- [ ] Tüm maddeler implement edildi
- [ ] Supabase migration çalıştırıldı ve RLS eklendi
- [ ] Mobil layout bozulmadı
- [ ] Dark mode uyumlu
- [ ] Toast/feedback mesajları Türkçe
- [ ] `MASTER_SPEC.md` faz durumu güncellendi

---

*Bu belge inşa sürecinin tek kaynağıdır (single source of truth). Değişiklikler versiyon numarası ile güncellenir.*
