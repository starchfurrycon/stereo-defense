import { md5 } from './md5'

const MIXIN_KEY_ENC_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49, 33, 9, 42, 19, 29, 28,
  14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54,
  21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52,
]

export interface WbiKeys {
  imgKey: string
  subKey: string
  fetchedAt: number
}

const KEY_TTL = 20 * 60 * 1000

let cache: WbiKeys | null = null

function fileStem(url: string): string {
  const path = url.split('?')[0]
  const base = path.slice(path.lastIndexOf('/') + 1)
  const dot = base.lastIndexOf('.')
  return dot > 0 ? base.slice(0, dot) : base
}

export function deriveMixinKey(imgKey: string, subKey: string): string {
  const merged = imgKey + subKey
  let out = ''
  for (const idx of MIXIN_KEY_ENC_TAB) {
    if (idx < merged.length) out += merged[idx]
    if (out.length === 32) break
  }
  return out
}

function sanitize(value: string): string {
  return value.replace(/[!'()*]/g, '')
}

function encode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())
}

export function extractKeysFromNav(body: unknown): { imgKey: string; subKey: string } | null {
  const data = (body as { data?: { wbi_img?: { img_url?: string; sub_url?: string } } })?.data
  const img = data?.wbi_img?.img_url
  const sub = data?.wbi_img?.sub_url
  if (!img || !sub) return null
  return { imgKey: fileStem(img), subKey: fileStem(sub) }
}

export function setWbiKeys(keys: { imgKey: string; subKey: string }): WbiKeys {
  cache = { ...keys, fetchedAt: Date.now() }
  return cache
}

export function cachedWbiKeys(): WbiKeys | null {
  if (!cache) return null
  if (Date.now() - cache.fetchedAt > KEY_TTL) return null
  return cache
}

export function clearWbiKeys(): void {
  cache = null
}

/**
 * 对已归一化的查询参数做 WBI 签名。
 * 返回带 wts / w_rid 的完整查询串。
 */
export function signQuery(
  params: Record<string, string | number | undefined>,
  keys: WbiKeys,
  timestampSecs = Math.floor(Date.now() / 1000),
): string {
  const mixinKey = deriveMixinKey(keys.imgKey, keys.subKey)
  const pairs: string[] = []
  for (const key of Object.keys(params).sort()) {
    const raw = params[key]
    if (raw === undefined || raw === null || raw === '') continue
    pairs.push(`${encode(key)}=${encode(sanitize(String(raw)))}`)
  }
  const query = pairs.join('&')
  const wts = timestampSecs
  const signed = `${query}&wts=${wts}`
  const wRid = md5(signed + mixinKey)
  return `${signed}&w_rid=${wRid}`
}
