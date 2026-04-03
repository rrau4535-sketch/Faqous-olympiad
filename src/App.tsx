import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import StudentDashboard from './pages/StudentDashboard'
import StudentProfile from './pages/StudentProfile'
import AdminDashboard from './pages/AdminDashboard'
import LoadingScreen from './components/shared/LoadingScreen'

function AppRoutes() {
  const { profile, loading } = useAuth()

  if (loading) return <LoadingScreen />

  // Not logged in
  if (!profile) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  // Admin or Superadmin
  if (profile.role === 'admin' || profile.role === 'superadmin') {
    return (
      <Routes>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    )
  }

  // Regular student
  return (
    <Routes>
      <Route path="/" element={<StudentDashboard />} />
      <Route path="/profile" element={<StudentProfile />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
