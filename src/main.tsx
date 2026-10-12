import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
// Order matters: Tailwind's reset, then the house theme, then LogNinja's own styles and utilities
import './tailwind-base.css'
import './theme.css'
import './index.css'

const container = document.getElementById('root')!
createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
