/**
 * 渲染冒烟测试：用本机 Chrome 打开构建产物，检查应用是否真正挂载、
 * 样式是否真的生效（读计算样式而非 CSS 文本）、控制台是否有报错。
 *
 * 用法：pnpm preview 后运行 node scripts/smoke.mjs [url]
 */
import { launch } from 'puppeteer-core'
import { existsSync, mkdirSync } from 'node:fs'

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
const shot = process.argv[3]

const browser = await launch({
  executablePath,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
})

const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 2 })

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
await new Promise((r) => setTimeout(r, 4000))

const read = await page.evaluate(() => {
  const probe = (el) => {
    if (!el) return null
    const s = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    return {
      w: Math.round(r.width),
      h: Math.round(r.height),
      bg: s.backgroundColor,
      borderWidth: s.borderTopWidth,
      borderColor: s.borderTopColor,
      radius: s.borderTopLeftRadius,
      shadow: s.boxShadow === 'none' ? 'none' : 'yes',
      color: s.color,
      fontSize: s.fontSize,
      padding: s.padding,
    }
  }
  const root = document.querySelector('.sd-root')
  const panel = document.querySelector('.sd-panel')
  const panelBody = document.querySelector('.sd-panel > div')
  const header = document.querySelector('header')
  const btn = document.querySelector('button[class*="h-8"], button[class*="h-7"]')
  const input = document.querySelector('input, textarea')

  // 面板内部一点的最终底色，用来确认层次真的画出来了
  const r = panel?.getBoundingClientRect()
  const inside = r ? document.elementFromPoint(r.left + r.width / 2, r.top + 20) : null
  let insideBg = null
  if (inside) {
    let n = inside
    while (n && getComputedStyle(n).backgroundColor === 'rgba(0, 0, 0, 0)') n = n.parentElement
    insideBg = n ? getComputedStyle(n).backgroundColor : null
  }

  return {
    mounted: !!root && root.children.length > 0,
    headerPosition: header ? getComputedStyle(header).position : null,
    headerBlur: header ? getComputedStyle(header).backdropFilter : null,
    bodyBg: getComputedStyle(root).backgroundColor,
    rootFontSize: getComputedStyle(root).fontSize,
    panel: probe(panel),
    panelBody: probe(panelBody),
    header: probe(header),
    button: probe(btn),
    input: probe(input),
    insideBg,
    tabs: [...document.querySelectorAll('nav button')].map((b) => b.textContent.trim()),
    hasTitle: document.body.innerText.includes('立体防御'),
  }
})

const views = {}
for (const label of read.tabs) {
  const ok = await page.evaluate((l) => {
    const btn = [...document.querySelectorAll('nav button')].find((b) => b.textContent.trim().startsWith(l))
    if (!btn) return false
    btn.click()
    return true
  }, label)
  if (ok) {
    await new Promise((r) => setTimeout(r, 220))
    views[label] = await page.evaluate(() => document.querySelector('main')?.innerText.replace(/\s+/g, ' ').slice(0, 70) ?? '')
  }
}

if (shot) {
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('nav button')].find((x) => x.textContent.trim().startsWith('账号'))
    b?.click()
  })
  await new Promise((r) => setTimeout(r, 300))
  mkdirSync(shot.replace(/[/\\][^/\\]+$/, ''), { recursive: true })
  await page.screenshot({ path: shot, fullPage: true })
}

await browser.close()

const f = []
const P = read.panel
if (!read.mounted) f.push('应用未挂载')
if (!read.hasTitle) f.push('缺少标题')
if (read.tabs.length !== 6) f.push(`标签数异常: ${read.tabs.length}`)
if (read.rootFontSize !== '13px') f.push(`根字号异常: ${read.rootFontSize}`)

// 样式是否真的落到元素上——这几条曾经全部失败
if (!P) f.push('找不到面板元素')
else {
  if (P.bg === 'rgba(0, 0, 0, 0)') f.push('面板背景被重置规则吃掉')
  if (P.borderWidth !== '1px') f.push(`面板无描边: ${P.borderWidth}`)
  if (P.radius === '0px') f.push('面板无圆角')
  if (P.shadow === 'none') f.push('面板无投影')
}
if (read.panelBody && read.panelBody.padding === '0px') f.push('面板内容区无内边距')
if (read.headerPosition !== 'sticky') f.push(`头部未吸顶: ${read.headerPosition}`)
if (!read.headerBlur?.includes('blur')) f.push('头部无毛玻璃')
if (read.button && read.button.bg === 'rgba(0, 0, 0, 0)' && read.button.borderWidth === '0px')
  f.push('按钮既无背景也无描边')
if (read.input && read.input.bg === 'rgba(0, 0, 0, 0)') f.push('输入框无背景')
if (read.insideBg && read.insideBg === read.bodyBg) f.push('面板与页面底色一致，层次未拉开')
if (errors.length) f.push(`控制台报错: ${errors.slice(0, 3).join(' | ')}`)
for (const [k, v] of Object.entries(views)) if (!v) f.push(`视图为空: ${k}`)

console.log(JSON.stringify({ ...read, views, errors }, null, 2))
if (f.length) {
  console.error('\n失败:\n' + f.map((x) => ` - ${x}`).join('\n'))
  process.exit(1)
}
console.log('\n冒烟测试通过')
