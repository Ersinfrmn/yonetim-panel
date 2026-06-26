import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Habits from './pages/Habits'
import Todos from './pages/Todos'
import Journal from './pages/Journal'
import Goals from './pages/Goals'
import Pomodoro from './pages/Pomodoro'
import Stats from './pages/Stats'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  return user ? children : <Navigate to="/login" replace />
}

function AppRoutes() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/habits" replace /> : <Login />} />
      <Route path="/" element={<Navigate to="/habits" replace />} />
      <Route path="/habits" element={<PrivateRoute><Layout><Habits /></Layout></PrivateRoute>} />
      <Route path="/todos" element={<PrivateRoute><Layout><Todos /></Layout></PrivateRoute>} />
      <Route path="/journal" element={<PrivateRoute><Layout><Journal /></Layout></PrivateRoute>} />
      <Route path="/goals" element={<PrivateRoute><Layout><Goals /></Layout></PrivateRoute>} />
      <Route path="/pomodoro" element={<PrivateRoute><Layout><Pomodoro /></Layout></PrivateRoute>} />
      <Route path="/stats" element={<PrivateRoute><Layout><Stats /></Layout></PrivateRoute>} />
    </Routes>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
          <Toaster
            position="top-right"
            toastOptions={{
              style: { background: '#1e293b', color: '#f8fafc', borderRadius: '12px' },
            }}
          />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
