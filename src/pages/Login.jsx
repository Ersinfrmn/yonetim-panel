import { useAuth } from '../contexts/AuthContext'
import { Zap } from 'lucide-react'

export default function Login() {
  const { signInWithGoogle } = useAuth()

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-surface-card/80 backdrop-blur-md border border-border-subtle rounded-xl p-8 w-full max-w-sm text-center">
        <div className="w-16 h-16 bg-primary-500/10 border border-border-subtle rounded-xl flex items-center justify-center mx-auto mb-4">
          <Zap size={28} className="text-primary-400" />
        </div>
        <h1 className="text-2xl font-semibold text-ink-primary mb-1">EF Komuta Merkezi</h1>
        <p className="text-ink-secondary text-sm mb-8">Kişisel verimlilik çalışma alanınız</p>

        <div className="space-y-3 text-left mb-8">
          {[
            'Alışkanlık takibi ve seriler',
            'Akıllı görev listesi',
            'Günlük journal',
            'Hedef takibi',
            'Pomodoro zamanlayıcı',
            'İstatistik paneli',
          ].map(f => (
            <div key={f} className="flex items-center gap-2 text-sm text-ink-secondary">
              <div className="w-1.5 h-1.5 rounded-full bg-primary-500 shrink-0" />
              {f}
            </div>
          ))}
        </div>

        <button
          onClick={signInWithGoogle}
          className="w-full flex items-center justify-center gap-3 bg-white/5 border border-border-subtle rounded-xl px-4 py-3 text-sm font-medium text-ink-primary hover:bg-white/10 hover:border-border-glow transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
            <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z"/>
          </svg>
          Google ile Giriş Yap
        </button>
      </div>
    </div>
  )
}
