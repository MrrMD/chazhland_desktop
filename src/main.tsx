import React from 'react'
import { createRoot } from 'react-dom/client'
import './theme/global.css'
import { ThemeProvider } from './theme/ThemeProvider'
import { AuthProvider } from './store/auth'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>,
)
