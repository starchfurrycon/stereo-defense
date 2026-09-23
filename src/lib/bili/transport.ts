import { RateLimiter, sleep } from './queue'

export interface HttpRequest {
  url: string
  method?: 'GET' | 'POST'
  /** POST 表单体 */
  form?: Record<string, string | number>
  /** 覆盖默认 Referer */
  referer?: string
  timeoutMs?: number
  retries?: number
}

export interface HttpResponse {
  status: number
  text: string
}

export type TransportMode = 'userscript' | 'fetch' | 'proxy'

interface GmResponse {
  status: number
  responseText: string
}

type GmRequest = (details: Record<string, unknown>) => { abort: () => void }

declare const GM_xmlhttpRequest: GmRequest | undefined

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

/**
 * B 站风控对同一出口 IP 相当敏感：实测约 25 次快速请求即触发 412，
 * 需冷却约 60s。默认串行 + 明显间隔。
 */
export const limiter = new RateLimiter(1, 1200)

let proxyPrefix = ''
let modeOverride: TransportMode | null = null
let requestCounter = 0
let lastError = ''

export function setProxyPrefix(prefix: string): void {
  proxyPrefix = prefix.trim().replace(/\/+$/, '')
}

export function setTransportMode(mode: TransportMode | null): void {
  modeOverride = mode
}

export function transportMode(): TransportMode {
  if (modeOverride) return modeOverride
  if (typeof GM_xmlhttpRequest === 'function') return 'userscript'
  if (proxyPrefix) return 'proxy'
  return 'fetch'
}

export function transportError(): string {
  return lastError
}

export function requestCount(): number {
  return requestCounter
}

export function resetRequestCount(): void {
  requestCounter = 0
}

function buildUrl(url: string): string {
  if (!proxyPrefix) return url
  return proxyPrefix + url
}

function gmRequest(req: HttpRequest): Promise<HttpResponse> {
  const fn = GM_xmlhttpRequest as GmRequest
  return new Promise((resolve, reject) => {
    fn({
      method: req.method ?? 'GET',
      url: buildUrl(req.url),
      data: req.form ? new URLSearchParams(req.form as Record<string, string>).toString() : undefined,
      headers: {
        'User-Agent': UA,
        Referer: req.referer ?? 'https://www.bilibili.com/',
        Origin: 'https://www.bilibili.com',
        ...(req.form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      },
      timeout: req.timeoutMs ?? 15000,
      responseType: 'text',
      onload: (res: GmResponse) => resolve({ status: res.status, text: res.responseText ?? '' }),
      onerror: () => reject(new Error('网络错误')),
      ontimeout: () => reject(new Error('请求超时')),
      onabort: () => reject(new Error('请求已取消')),
    })
  })
}

async function fetchRequest(req: HttpRequest): Promise<HttpResponse> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), req.timeoutMs ?? 15000)
  try {
    const res = await fetch(buildUrl(req.url), {
      method: req.method ?? 'GET',
      credentials: 'include',
      headers: req.form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : undefined,
      body: req.form ? new URLSearchParams(req.form as Record<string, string>).toString() : undefined,
      signal: controller.signal,
    })
    return { status: res.status, text: await res.text() }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) {
      throw new Error('接口不可达（跨域被拦截）')
    }
    throw new Error(msg)
  } finally {
    clearTimeout(timer)
  }
}

/** 单次原始请求，不含重试与限流。 */
async function rawRequest(req: HttpRequest): Promise<HttpResponse> {
  requestCounter++
  return transportMode() === 'userscript' ? gmRequest(req) : fetchRequest(req)
}

const BILI_HOSTS = /^https?:\/\/([a-z0-9-]+\.)*(bilibili\.com|hdslb\.com|bilivideo\.com)\//i

/** 纯浏览器直连必然被 CORS 拦截，直接给出结论，不做无谓重试。 */
function unreachable(): string | null {
  if (transportMode() !== 'fetch' || proxyPrefix) return null
  const host = location.hostname
  if (host === 'bilibili.com' || host.endsWith('.bilibili.com')) return null
  return '接口不可达（跨域被拦截）'
}

const RETRYABLE_STATUS = new Set([412, 429, 500, 502, 503, 504])

export async function httpRequest(req: HttpRequest): Promise<HttpResponse> {
  if (BILI_HOSTS.test(req.url)) {
    const reason = unreachable()
    if (reason) {
      lastError = reason
      throw new Error(reason)
    }
  }
  const retries = req.retries ?? 2
  let attempt = 0
  for (;;) {
    try {
      const res = await limiter.run(() => rawRequest(req))
      if (RETRYABLE_STATUS.has(res.status) && attempt < retries) {
        limiter.cooldown(1500 * (attempt + 1))
        await sleep(800 * (attempt + 1))
        attempt++
        continue
      }
      lastError = ''
      return res
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      lastError = msg
      if (attempt >= retries) throw new Error(msg)
      await sleep(600 * (attempt + 1))
      attempt++
    }
  }
}
