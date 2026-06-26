# ProductiFlow — Setup Guide

## 1. Supabase Project Setup

### Create project
1. Go to https://supabase.com and sign in
2. Click **New Project** → give it a name (e.g. "productiflow") → set a DB password → pick a region close to you
3. Wait ~2 minutes for the project to provision

### Enable Google OAuth
1. In your Supabase dashboard → **Authentication → Providers → Google**
2. Toggle **Enable Google provider** ON
3. In [Google Cloud Console](https://console.cloud.google.com):
   - Create a new project (or use existing)
   - Enable **OAuth consent screen** (External, fill required fields)
   - Go to **Credentials → Create Credentials → OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Authorized redirect URIs: `https://<your-project-id>.supabase.co/auth/v1/callback`
4. Copy the **Client ID** and **Client Secret** into Supabase → Google provider settings
5. Save

### Create tables
1. In Supabase dashboard → **SQL Editor → New Query**
2. Paste the contents of `supabase-setup.sql` (included in this repo)
3. Click **Run** — all 7 tables are created with RLS enabled

### Get your API keys
1. Supabase dashboard → **Project Settings → API**
2. Copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public key** → `VITE_SUPABASE_ANON_KEY`

---

## 2. Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

`.env.local`:
```
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

---

## 3. Run Locally

```bash
npm install
npm run dev
```

Open http://localhost:5173 — sign in with Google to get started.

---

## 4. Deploy to Vercel

### Option A — Vercel CLI
```bash
npm install -g vercel
vercel
# Follow prompts — framework: Vite, build: npm run build, output: dist
```

### Option B — Vercel Dashboard (recommended)
1. Push this project to GitHub
2. Go to https://vercel.com → **Add New Project** → Import your repo
3. Framework preset: **Vite**
4. Build command: `npm run build`
5. Output directory: `dist`
6. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
7. Click **Deploy**

### Update Supabase redirect URL for production
After deploying, add your Vercel URL to Supabase:
1. Supabase dashboard → **Authentication → URL Configuration**
2. **Site URL**: `https://your-app.vercel.app`
3. **Redirect URLs**: add `https://your-app.vercel.app`

Also update Google OAuth redirect URIs in Google Cloud Console to include:
`https://<your-project-id>.supabase.co/auth/v1/callback` (already set, no change needed)

---

## Project Structure

```
src/
├── components/
│   └── Layout.jsx          # Sidebar + bottom nav + theme toggle
├── contexts/
│   ├── AuthContext.jsx      # Supabase auth state + Google OAuth
│   └── ThemeContext.jsx     # Dark/light mode
├── lib/
│   └── supabase.js         # Supabase client
├── pages/
│   ├── Login.jsx           # Google sign-in page
│   ├── Habits.jsx          # Habit tracker + heatmap
│   ├── Todos.jsx           # Task list with filters
│   ├── Journal.jsx         # Daily journal with autosave
│   ├── Goals.jsx           # Goal tracker with subtasks
│   ├── Pomodoro.jsx        # Timer with Web Audio beep
│   └── Stats.jsx           # Recharts dashboard
├── App.jsx                 # Routes + providers
└── index.css               # Tailwind base
supabase-setup.sql          # All 7 tables + RLS policies
vercel.json                 # SPA rewrite rule
```
