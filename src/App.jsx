import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import Layout from './components/Layout'
import Dashboard from './components/Dashboard'
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
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  return user ? children : <Navigate to="/login" replace />
}

function AnimatedRoutes() {
  const { user } = useAuth()
  const location = useLocation()
  return (
    <div key={location.pathname} className="page-enter">
      <Routes>
        <Route path="/login"     element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
        <Route path="/"          element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<PrivateRoute><Layout><Dashboard /></Layout></PrivateRoute>} />
        <Route path="/habits"    element={<PrivateRoute><Layout><Habits /></Layout></PrivateRoute>} />
        <Route path="/todos"     element={<PrivateRoute><Layout><Todos /></Layout></PrivateRoute>} />
        <Route path="/journal"   element={<PrivateRoute><Layout><Journal /></Layout></PrivateRoute>} />
        <Route path="/goals"     element={<PrivateRoute><Layout><Goals /></Layout></PrivateRoute>} />
        <Route path="/pomodoro"  element={<PrivateRoute><Layout><Pomodoro /></Layout></PrivateRoute>} />
        <Route path="/stats"     element={<PrivateRoute><Layout><Stats /></Layout></PrivateRoute>} />
      </Routes>
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AnimatedRoutes />
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: '#111128',
                color: '#F0F0FF',
                borderRadius: '10px',
                border: '1px solid rgba(108,63,232,0.25)',
                fontSize: '14px',
              },
            }}
          />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
