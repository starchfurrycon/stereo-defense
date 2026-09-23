import { estimateCost } from './pricing'
import { FAMILIES } from '../analyze/lexicon'
import type { Profile, Usage } from '../types'

export interface LlmConfig {
  baseUrl: string
  apiKey: string
  model: string
  /** 覆盖自动查表的价格（美元/百万 token） */
  priceInput?: number
  priceOutput?: number
  temperature?: number
}

export const DEFAULT_LLM: LlmConfig = {
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
  temperature: 0.2,
}

export function emptyUsage(): Usage {
  return { promptTokens: 0, completionTokens: 0, totalTokens: 0, calls: 0, costUsd: 0, authoritative: true }
}

const CJK_RE = /[\u3400-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/

/**
 * 分词估算。仅在接口未返回 usage 时作为兜底；
 * 接口返回的 usage 始终优先，因此计费以服务端口径为准。
 * 中日韩字符按约 0.75 token/字，其余按约 3.6 字符/token。
 */
export function estimateTokens(text: string): number {
  let cjk = 0
  let other = 0
  for (const ch of text) {
    if (CJK_RE.test(ch)) cjk++
    else other++
  }
  return Math.ceil(cjk * 0.75 + other / 3.6)
}

function cost(cfg: LlmConfig, p: number, c: number): number {
  if (cfg.priceInput !== undefined || cfg.priceOutput !== undefined) {
    return (p / 1e6) * (cfg.priceInput ?? 0) + (c / 1e6) * (cfg.priceOutput ?? 0)
  }
  return estimateCost(cfg.model, p, c)
}

interface ChatChoice {
  message?: { content?: string }
}

interface ChatResponse {
  choices?: ChatChoice[]
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
  error?: { message?: string }
}

export interface ChatResult {
  content: string
  usage: Usage
}

async function chat(cfg: LlmConfig, system: string, user: string, json: boolean): Promise<ChatResult> {
  if (!cfg.apiKey) throw new Error('未配置 API Key')
  const base = cfg.baseUrl.trim().replace(/\/+$/, '')
  const url = /\/chat\/completions$/.test(base) ? base : `${base}/chat/completions`

  const body: Record<string, unknown> = {
    model: cfg.model,
    temperature: cfg.temperature ?? 0.2,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  }
  if (json) body.response_format = { type: 'json_object' }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify(body),
  })

  const text = await res.text()
  let parsed: ChatResponse
  try {
    parsed = JSON.parse(text) as ChatResponse
  } catch {
    throw new Error(`接口返回异常 (HTTP ${res.status})`)
  }
  if (!res.ok) throw new Error(parsed.error?.message ?? `请求失败 (HTTP ${res.status})`)

  const content = parsed.choices?.[0]?.message?.content ?? ''
  const authoritative = Boolean(parsed.usage)
  const promptTokens = parsed.usage?.prompt_tokens ?? estimateTokens(system + user)
  const completionTokens = parsed.usage?.completion_tokens ?? estimateTokens(content)

  return {
    content,
    usage: {
      promptTokens,
      completionTokens,
      totalTokens: parsed.usage?.total_tokens ?? promptTokens + completionTokens,
      calls: 1,
      costUsd: cost(cfg, promptTokens, completionTokens),
      authoritative,
    },
  }
}

export function mergeUsage(a: Usage, b: Usage): Usage {
  return {
    promptTokens: a.promptTokens + b.promptTokens,
    completionTokens: a.completionTokens + b.completionTokens,
    totalTokens: a.totalTokens + b.totalTokens,
    calls: a.calls + b.calls,
    costUsd: a.costUsd + b.costUsd,
    authoritative: a.authoritative && b.authoritative,
  }
}

function extractJson(text: string): unknown {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1))
    throw new Error('模型未返回合法 JSON')
  }
}

function asStringArray(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.trim())
    .filter((v) => v.length > 0 && v.length < 60)
    .slice(0, limit)
}

const KNOWN_FAMILIES = new Set(FAMILIES.map((f) => f.id))

export async function generateProfile(
  cfg: LlmConfig,
  system: string,
  user: string,
): Promise<{ profile: Profile; usage: Usage }> {
  const { content, usage } = await chat(cfg, system, user, true)
  const raw = extractJson(content) as Record<string, unknown>

  const families = asStringArray(raw.families, 6).filter((f) => KNOWN_FAMILIES.has(f))
  const markers = asStringArray(raw.markers, 40)
  const guards = asStringArray(raw.guards, 30)

  if (!markers.length) throw new Error('模型未生成有效标记词')

  return {
    profile: {
      raw: user.replace(/^用户描述：/, ''),
      target: typeof raw.target === 'string' && raw.target.trim() ? raw.target.trim().slice(0, 160) : user,
      families,
      topics: asStringArray(raw.topics, 16),
      markers,
      exemplars: asStringArray(raw.exemplars, 12),
      guards,
      allow: asStringArray(raw.allow, 10),
      engine: 'llm',
      usage,
    },
    usage,
  }
}

export interface ArbiterResult {
  decision: 'block' | 'pass' | 'unsure'
  reason: string
  usage: Usage
}

export async function arbitrate(cfg: LlmConfig, system: string, user: string): Promise<ArbiterResult> {
  const { content, usage } = await chat(cfg, system, user, true)
  const raw = extractJson(content) as { decision?: string; reason?: string }
  const decision = raw.decision === 'block' || raw.decision === 'pass' ? raw.decision : 'unsure'
  return { decision, reason: (raw.reason ?? '').slice(0, 60), usage }
}
