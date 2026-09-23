/**
 * 逐个标签截图，输出到 docs/。
 *
 * 用法：pnpm preview 后运行 node scripts/shots.mjs [url]
 */
import { launch } from 'puppeteer-core'
import { existsSync, mkdirSync } from 'node:fs'

const CHROME = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
]
  .filter(Boolean)
  .find((p) => existsSync(p))

if (!CHROME) {
  console.error('未找到 Chrome，设置 CHROME_PATH 后重试')
  process.exit(2)
}

const url = process.argv[2] ?? 'http://localhost:4173/'
const outDir = 'docs'
mkdirSync(outDir, { recursive: true })

const browser = await launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1320, height: 900, deviceScaleFactor: 2 })
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
await page.waitForSelector('.sd-root', { timeout: 15000 })
await new Promise((r) => setTimeout(r, 4000))

const NAMES = { 账号: 'account', 画像: 'profile', 扫描: 'scan', 复核: 'review', 黑名单: 'blacklist', 设置: 'settings' }

for (const [label, file] of Object.entries(NAMES)) {
  const ok = await page.evaluate((l) => {
    const b = [...document.querySelectorAll('nav button')].find((x) => x.textContent.trim().startsWith(l))
    b?.click()
    return Boolean(b)
  }, label)
  if (!ok) continue
  await new Promise((r) => setTimeout(r, 350))
  await page.screenshot({ path: `${outDir}/${file}.png` })
  console.log(`${outDir}/${file}.png`)
}

await browser.close()
