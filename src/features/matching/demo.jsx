import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/index.css'
import MatchingDemo from './MatchingDemo'

createRoot(document.getElementById('root')).render(
  <StrictMode><MatchingDemo /></StrictMode>,
)
