import css from './styles.css?inline'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { useStore } from './lib/store'
import { fetchFingerprint } from './lib/bili/api'

declare const GM_registerMenuCommand: ((name: string, fn: () => void) => void) | undefined

const HOST_ID = 'stereo-defense-host'

function mount(): void {
  if (document.getElementById(HOST_ID)) return

  const host = document.createElement('div')
  host.id = HOST_ID
  document.documentElement.appendChild(host)
  const shadow = host.attachShadow({ mode: 'open' })

  const style = document.createElement('style')
  style.textContent = css
  shadow.appendChild(style)

  const container = document.createElement('div')
  container.className = 'sd-root'
  shadow.appendChild(container)

  const launcher = document.createElement('button')
  launcher.className = 'sd-launcher'
  launcher.textContent = '防御'
  container.appendChild(launcher)

  const overlay = document.createElement('div')
  overlay.className = 'sd-overlay'
  overlay.style.display = 'none'
  container.appendChild(overlay)

  const root = createRoot(overlay)

  const setOpen = (open: boolean) => {
    overlay.style.display = open ? 'block' : 'none'
    launcher.style.display = open ? 'none' : 'block'
    if (open) root.render(createElement(App, { onClose: () => setOpen(false) }))
  }

  launcher.addEventListener('click', () => setOpen(true))
  GM_registerMenuCommand?.('打开立体防御', () => setOpen(true))

  // 首次使用直接展开，之后保持悬浮入口，不打扰浏览
  if (!useStore.getState().profile) setOpen(true)

  // 补种匿名指纹，降低后续请求被风控的概率
  void fetchFingerprint()
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount, { once: true })
} else {
  mount()
}
