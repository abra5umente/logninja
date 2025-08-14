import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

const container = document.getElementById('root')!
// Default dark mode
document.documentElement.classList.add('dark')
createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
