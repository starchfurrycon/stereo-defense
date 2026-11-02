/**
 * 文本预处理：归一化、引号区间、分句。
 *
 * 归一化的目标是「同样的意思不该因为写法不同而漏掉」：
 * 全角转半角（NFKC）、大小写折叠、去掉空白与符号。
 * 同时保留一张下标映射表，用来把归一化后的位置还原到原文，
 * 这样才能判断一次命中是否落在引号里（引用 / 转述）。
 */

const CJK = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/
const ALNUM = /[0-9a-z]/

const CJK_RE = new RegExp(CJK.source)
const ALNUM_RE = new RegExp(ALNUM.source)

export interface PreparedText {
  raw: string
  norm: string
  /** norm 下标 -> raw 下标 */
  map: number[]
  /** 引号区间，norm 下标，左闭右开 */
  quotes: Array<[number, number]>
}

export function isCjk(ch: string): boolean {
  return CJK_RE.test(ch)
}

/** 只保留中英文数字，其余一概丢弃。 */
export function normalize(input: string): string {
  const lower = input.normalize('NFKC').toLowerCase()
  let out = ''
  for (const ch of lower) {
    if (CJK_RE.test(ch) || ALNUM_RE.test(ch)) out += ch
  }
  return out
}

const OPEN_QUOTE = new Set(['「', '『', '“', '‘', '《', '〈', '【', '〔', '［'])
const CLOSE_QUOTE = new Set(['」', '』', '”', '’', '》', '〉', '】', '〕', '］'])

/**
 * 引号里通常是「别人的话」：反串、转述、批判对象。
 * 对这类命中强力降权，是防误伤的重要一环。
 */
export function prepare(raw: string): PreparedText {
  const lower = raw.normalize('NFKC').toLowerCase()
  const normChars: string[] = []
  const map: number[] = []
  const quotes: Array<[number, number]> = []

  // 栈式处理，容忍不闭合的引号：末尾一律闭合
  const stack: number[] = []
  let straightStart = -1

  for (let i = 0; i < lower.length; i++) {
    const ch = lower[i]
    const open = OPEN_QUOTE.has(ch)
    const close = CLOSE_QUOTE.has(ch)

    if (open) {
      stack.push(normChars.length)
    } else if (close) {
      const start = stack.pop()
      if (start !== undefined && normChars.length > start) quotes.push([start, normChars.length])
    } else if (ch === '"') {
      if (straightStart >= 0) {
        if (normChars.length > straightStart) quotes.push([straightStart, normChars.length])
        straightStart = -1
      } else {
        straightStart = normChars.length
      }
    }

    if (CJK_RE.test(ch) || ALNUM_RE.test(ch)) {
      normChars.push(ch)
      map.push(i)
    }
  }

  for (const start of stack) {
    if (normChars.length > start) quotes.push([start, normChars.length])
  }
  if (straightStart >= 0 && normChars.length > straightStart) quotes.push([straightStart, normChars.length])

  return { raw, norm: normChars.join(''), map, quotes }
}

/** 归一化区间 [start, end) 是否整体落在某个引号区间内。 */
export function isQuoted(prepared: PreparedText, start: number, end: number): boolean {
  for (const [qs, qe] of prepared.quotes) {
    if (start >= qs && end <= qe) return true
  }
  return false
}

/**
 * 反讽标记：括号补充、doge、狗头、笑死、绷不住了。
 * 反讽既可能是攻击，也可能是自嘲，因此只做轻微降权而不是直接排除。
 */
const SARCASM_MARKS = ['（', '(', 'doge', '狗头', '笑死', '乐了', '绷不住', '蚌埠住', '滑稽', '斜眼', '吃瓜', '狗头保命']

export function hasSarcasm(raw: string): boolean {
  const lower = raw.toLowerCase()
  return SARCASM_MARKS.some((m) => lower.includes(m))
}

/** 句子的粗略切分，用于「同一段里出现正反两面」这类判断。 */
export function sentences(text: string): string[] {
  return text
    .split(/[。！？!?；;\n\r]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** 转述动词：命中在前文时，说明后面的内容是「别人说的」。 */
export const REPORTING_CUES = [
  '他说',
  '她说',
  '有人说',
  '据称',
  '据悉',
  '网传',
  '据说',
  '号称',
  '宣称',
  '声称',
  '原文',
  '引用',
  '转述',
  '有人认为',
  '这些人说',
]

/** 转折词：转折之前多半是铺垫或引述，转折之后才是真立场。 */
export const CONTRAST_CUES = [
  '但是',
  '然而',
  '不过',
  '其实',
  '实际上',
  '说白了',
  '说到底',
  '问题是',
  '话虽如此',
  '话又说回来',
]

export function indexOfAny(text: string, cues: string[]): number {
  let best = -1
  for (const cue of cues) {
    const at = text.indexOf(cue)
    if (at >= 0 && (best < 0 || at < best)) best = at
  }
  return best
}

/** 命中位置之前 span 个字符内是否出现转述动词。 */
export function hasReportingBefore(text: string, position: number, span = 14): boolean {
  const from = Math.max(0, position - span)
  const window = text.slice(from, position)
  return REPORTING_CUES.some((c) => window.includes(c))
}

/**
 * 64 位 SimHash。
 * 精确哈希只能抓「一字不差」的复制，水军改两个字就失效；
 * SimHash 用汉明距离度量近似重复，能把「换皮模板」也抓出来。
 */
export function simhash(text: string): { hi: number; lo: number } {
  const norm = normalize(text)
  if (norm.length < 4) return { hi: 0, lo: 0 }
  const counts = new Array<number>(64).fill(0)

  const add = (gram: string, weight: number): void => {
    let h1 = 0x811c9dc5
    let h2 = 0x1000193
    for (let i = 0; i < gram.length; i++) {
      const c = gram.charCodeAt(i)
      h1 = ((h1 ^ c) * 0x01000193) >>> 0
      h2 = ((h2 + c) * 0x85ebca6b) >>> 0
    }
    for (let bit = 0; bit < 32; bit++) {
      counts[bit] += (h1 >>> bit) & 1 ? weight : -weight
    }
    for (let bit = 0; bit < 32; bit++) {
      counts[32 + bit] += (h2 >>> bit) & 1 ? weight : -weight
    }
  }

  // 双字 + 三字组合，短文本也能有足够特征
  for (let i = 0; i + 1 < norm.length; i++) add(norm.slice(i, i + 2), 1)
  for (let i = 0; i + 2 < norm.length; i++) add(norm.slice(i, i + 3), 2)

  let lo = 0
  let hi = 0
  for (let bit = 0; bit < 32; bit++) {
    if (counts[bit] > 0) lo |= 1 << bit
    if (counts[32 + bit] > 0) hi |= 1 << bit
  }
  return { hi: hi >>> 0, lo: lo >>> 0 }
}

function popcount(n: number): number {
  n = n - ((n >>> 1) & 0x55555555)
  n = (n & 0x33333333) + ((n >>> 2) & 0x33333333)
  n = (n + (n >>> 4)) & 0x0f0f0f0f
  return (n * 0x01010101) >>> 24
}

export function hamming(a: { hi: number; lo: number }, b: { hi: number; lo: number }): number {
  return popcount((a.hi ^ b.hi) >>> 0) + popcount((a.lo ^ b.lo) >>> 0)
}

/** 去重用的粗指纹：把数字、@、表情拿掉，留下骨架。 */
export function skeleton(text: string): string {
  return normalize(text)
    .replace(/[0-9]+/g, '')
    .replace(/[a-z]{4,}/g, '')
}

/** 截断到指定长度，避免超长文本拖慢匹配。 */
export function clip(text: string, max = 600): string {
  return text.length > max ? text.slice(0, max) : text
}
