import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import { App } from './app/App'

const el = document.getElementById('root')
if (el) {
  el.className = 'sd-root sd-page'
  createRoot(el).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
