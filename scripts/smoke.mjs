/**
 * 渲染冒烟测试：用本机 Chrome 打开构建产物，检查应用是否真正挂载、
 * 样式是否生效、控制台是否有报错。不依赖任何测试框架。
 *
 * 用法：node scripts/smoke.mjs [url]
 */
import { launch } from 'puppeteer-core'
import { existsSync } from 'node:fs'

const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean)

const executablePath = CANDIDATES.find((p) => existsSync(p))
if (!executablePath) {
  console.error('未找到 Chrome，设置 CHROME_PATH 后重试')
  process.exit(2)
}

const url = process.argv[2] ?? 'http://localhost:4173/'
const browser = await launch({
  executablePath,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
})

const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 1000 })

const errors = []
// 静态页面脱离 bilibili.com 运行时，CORS 拦截是预期行为，不算缺陷
const EXPECTED = /CORS policy|Failed to load resource|ERR_|net::/i
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error' && !EXPECTED.test(m.text())) errors.push(`console: ${m.text()}`)
})

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
await page.waitForSelector('.sd-root', { timeout: 15000 })
// 接口不可达时应用会重试若干次，等它稳定下来再断言
await new Promise((r) => setTimeout(r, 5000))

const report = await page.evaluate(() => {
  const root = document.querySelector('.sd-root')
  const bg = getComputedStyle(root).backgroundColor
  const header = document.querySelector('header')
  const headerBg = header ? getComputedStyle(header).backgroundColor : ''
  const tabs = [...document.querySelectorAll('nav button')].map((b) => b.textContent.trim())
  const text = document.body.innerText
  const css = [...document.styleSheets]
    .flatMap((s) => {
      try {
        return [...s.cssRules].map((r) => r.cssText)
      } catch {
        return []
      }
    })
    .join('\n')
  return {
    mounted: !!root && root.children.length > 0,
    bg,
    headerBg,
    tabs,
    textLength: text.length,
    hasTitle: text.includes('立体防御'),
    hasAccountPanel: text.includes('账号') && text.includes('UID'),
    tokenVars: ['--color-ink', '--color-accent', '--color-line'].filter((v) => css.includes(v)),
    classesPresent: ['.sd-mono', '.sd-overlay', '.sd-launcher'].filter((c) => css.includes(c)),
    buttons: document.querySelectorAll('button').length,
    inputs: document.querySelectorAll('input, textarea, select').length,
  }
})

// 逐个切换标签，确认每个视图都能渲染
const views = {}
for (const label of report.tabs) {
  const clicked = await page.evaluate((l) => {
    const btn = [...document.querySelectorAll('nav button')].find((b) => b.textContent.trim().startsWith(l))
    if (!btn) return false
    btn.click()
    return true
  }, label)
  if (clicked) {
    await new Promise((r) => setTimeout(r, 250))
    views[label] = await page.evaluate(() => document.querySelector('main')?.innerText.slice(0, 60) ?? '')
  }
}

await browser.close()

const failures = []
if (!report.mounted) failures.push('应用未挂载')
if (!report.hasTitle) failures.push('缺少标题')
if (!report.hasAccountPanel) failures.push('账号面板未渲染')
if (report.tabs.length !== 6) failures.push(`标签数异常: ${report.tabs.length}`)
if (report.bg !== 'rgb(10, 11, 13)') failures.push(`背景色未生效: ${report.bg}`)
if (report.tokenVars.length !== 3) failures.push(`主题变量缺失: ${report.tokenVars.join(',')}`)
if (report.classesPresent.length !== 3) failures.push(`样式类缺失: ${report.classesPresent.join(',')}`)
if (errors.length) failures.push(`控制台报错: ${errors.slice(0, 3).join(' | ')}`)
for (const [k, v] of Object.entries(views)) if (!v) failures.push(`视图为空: ${k}`)

console.log(JSON.stringify({ ...report, views, errors }, null, 2))
if (failures.length) {
  console.error('\n失败:\n' + failures.map((f) => ` - ${f}`).join('\n'))
  process.exit(1)
}
console.log('\n冒烟测试通过')
