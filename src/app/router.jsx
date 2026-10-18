import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { LoadingState } from '@/components/ui/States'
import { USER_ROLES } from '@/shared/constants/contracts'
import { useAuth } from '@/contexts/AuthContext'
import ProtectedRoute from './ProtectedRoute'

function RoleRedirect() {
  const { isTeacher, role } = useAuth()
  if (role === null) return <LoadingState label="Cargando perfil..." />
  return <Navigate to={isTeacher ? '/dashboard/teacher' : '/dashboard/student'} replace />
}

/* ---------- DESARROLLADOR 1: auth + dashboard ---------- */
import Login from '@/features/auth/pages/Login'
import Register from '@/features/auth/pages/Register'
import ForgotPassword from '@/features/auth/pages/ForgotPassword'
import TeacherDashboard from '@/features/dashboard/pages/TeacherDashboard'
import StudentsPage from '@/features/dashboard/pages/StudentsPage'
import StudentDashboard from '@/features/dashboard/pages/StudentDashboard'

/* ---------- DESARROLLADOR 2: assessments + matching ---------- */
const AssessmentsPage = lazy(() => import('@/features/assessments/pages/AssessmentsPage'))
const MatchingPage = lazy(() => import('@/features/matching/pages/MatchingPage'))
const MatchingResultsPage = lazy(() => import('@/features/matching/pages/MatchingResultsPage'))

/* ---------- DESARROLLADOR 3: sessions + AI ---------- */
const SessionsPage = lazy(() => import('@/features/sessions/pages/SessionsPage'))
const SessionDetailPage = lazy(() => import('@/features/sessions/pages/SessionDetailPage'))
const TutorPage = lazy(() => import('@/features/ai/pages/TutorPage'))

const routes = [
  { path: '/', element: <Navigate to="/dashboard" replace /> },
  { path: '/login', element: <Login /> },
  { path: '/register', element: <Register /> },
  { path: '/forgot-password', element: <ForgotPassword /> },
  { path: '/students', element: <StudentsPage />, roles: [USER_ROLES.TEACHER] },
  { path: '/assessments', element: <AssessmentsPage />, roles: ['teacher', 'student'] },
  { path: '/sessions', element: <SessionsPage />, roles: ['teacher', 'student'] },
  { path: '/sessions/:sessionId', element: <SessionDetailPage />, roles: ['teacher', 'student'] },
  { path: '/sessions/:sessionId/tutor', element: <TutorPage />, roles: ['teacher', 'student'] },
]

function guard(element, roles) {
  return (
    <ProtectedRoute allowedRoles={roles}>
      <DashboardLayout>{element}</DashboardLayout>
    </ProtectedRoute>
  )
}

export default function AppRouter() {
  return (
    <Suspense fallback={<LoadingState />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<RoleRedirect />} />
          <Route path="teacher" element={<TeacherDashboard />} />
          <Route path="student" element={<StudentDashboard />} />
        </Route>

        <Route
          path="/matching"
          element={
            <ProtectedRoute allowedRoles={[USER_ROLES.TEACHER]}>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<MatchingPage />} />
          <Route path="results" element={<MatchingResultsPage />} />
        </Route>

        {routes
          .filter((r) => r.path !== '/' && !['/login', '/register', '/forgot-password'].includes(r.path))
          .map((r) => (
            <Route key={r.path} path={r.path} element={guard(r.element, r.roles)} />
          ))}

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  )
}
