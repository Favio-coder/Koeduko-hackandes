import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import MatchingPage from './pages/MatchingPage'
import MatchingResultsPage from './pages/MatchingResultsPage'

/** Prueba local del motor: no importa autenticación ni Firebase. */
export default function MatchingDemo() {
  return (
    <HashRouter>
      <main className="min-h-screen bg-[#F8FAF6] px-4 py-6 sm:px-8">
        <div className="mx-auto max-w-5xl">
          <Routes>
            <Route path="/matching" element={<MatchingPage />} />
            <Route path="/matching/results" element={<MatchingResultsPage />} />
            <Route path="*" element={<Navigate to="/matching" replace />} />
          </Routes>
        </div>
      </main>
    </HashRouter>
  )
}
