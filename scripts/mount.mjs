/**
 * 用户脚本形态的挂载测试：把构建产物注入页面，确认 Shadow DOM 里的界面能起来。
 * 只用于开发自查，不参与发布。
 */
import { launch } from 'puppeteer-core'
import { existsSync, readFileSync } from 'node:fs'

const CHROME = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
]
  .filter(Boolean)
  .find((p) => existsSync(p))

const browser = await launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu'],
})
const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e.message)))

await page.goto('http://localhost:4173/', { waitUntil: 'domcontentloaded' })
const source = readFileSync('dist/stereo-defense.user.js', 'utf8')
await page.addScriptTag({ content: source })
await new Promise((r) => setTimeout(r, 2500))

const result = await page.evaluate(() => {
  const host = document.getElementById('stereo-defense-host')
  const shadow = host?.shadowRoot
  return {
    host: Boolean(host),
    root: Boolean(shadow?.querySelector('.sd-root')),
    launcher: Boolean(shadow?.querySelector('.sd-launcher')),
    overlayVisible: shadow?.querySelector('.sd-overlay')?.style.display,
    text: shadow?.querySelector('.sd-overlay')?.textContent?.slice(0, 60) ?? '',
  }
})
await browser.close()
console.log(JSON.stringify({ ...result, errors }, null, 2))
if (!result.host || !result.root) process.exit(1)
