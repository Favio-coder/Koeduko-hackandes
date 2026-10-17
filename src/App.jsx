import { BrowserRouter } from 'react-router-dom'
import AppRouter from '@/app/router'
import { AuthProvider } from '@/contexts/AuthContext'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </BrowserRouter>
  )
}