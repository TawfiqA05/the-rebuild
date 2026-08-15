import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// --- PWA: register the service worker so the app is installable & offline ----
// This is a cache-first shell. When you later wrap this in a proper PWA push
// setup, the reminders in the (upcoming) notifications module become real
// background push notifications instead of best-effort in-page ones.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((err) => {
      console.warn('Service worker registration failed:', err)
    })
  })
}
