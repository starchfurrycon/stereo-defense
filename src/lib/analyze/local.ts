import { FAMILIES, type LexFamily } from './lexicon'
import { extractKeywords } from './segment'
import { cosine, embed, normalizeSimilarity } from './embed'
import type { Profile } from '../types'

export interface FamilyMatch {
  family: LexFamily
  /** 0..1 */
  relevance: number
}

/** 把用户原话映射到词库中的立场族。 */
export async function matchFamilies(raw: string): Promise<FamilyMatch[]> {
  const { keywords } = extractKeywords(raw, 30)
  const vectors = await embed([raw, ...FAMILIES.flatMap((f) => f.exemplars)])
  const results: FamilyMatch[] = []

  let cursor = 1
  for (const family of FAMILIES) {
    const count = family.exemplars.length
    let best = 0
    if (vectors) {
      const anchor = vectors[0]
      for (let i = 0; i < count; i++) {
        const sim = normalizeSimilarity(cosine(anchor, vectors[cursor + i]))
        if (sim > best) best = sim
      }
    }
    cursor += count

    // 关键词与词表直接重合，是无模型时的主要依据
    const pool = [...family.markers.map((m) => m.term), ...family.topics]
    let overlap = 0
    for (const kw of keywords) {
      if (pool.some((term) => term.includes(kw) || kw.includes(term))) overlap += 1
    }
    const overlapScore = Math.min(1, overlap / 2.5)
    const relevance = Math.max(best, overlapScore * 0.92)
    if (relevance > 0.18) results.push({ family, relevance })
  }

  return results.sort((a, b) => b.relevance - a.relevance)
}

/**
 * 无 LLM 时的画像构建：词表族映射 + 原话切词。
 * 关键词只用于检索，判定依赖标记词与语义锚点。
 */
export async function buildLocalProfile(raw: string): Promise<Profile> {
  const { keywords } = extractKeywords(raw, 22)
  const matches = await matchFamilies(raw)
  const selected = matches.filter((m) => m.relevance >= 0.3).map((m) => m.family)
  const effective = selected.length ? selected : matches.slice(0, 1).map((m) => m.family)

  const topics = new Set<string>(keywords)
  for (const f of effective) for (const t of f.topics) topics.add(t)

  const markers = new Set<string>()
  for (const f of effective) {
    for (const m of f.markers) {
      if (m.tier === 'weak') continue
      markers.add(m.term)
    }
  }

  // 原话里直接出现的词表条目视为高置信标记
  for (const f of FAMILIES) {
    for (const m of f.markers) {
      if (raw.includes(m.term)) markers.add(m.term)
    }
  }

  const guards = new Set<string>()
  for (const f of effective) for (const g of f.guards) guards.add(g)

  const exemplars = new Set<string>()
  for (const f of effective) for (const x of f.exemplars) exemplars.add(x)
  exemplars.add(raw)

  return {
    raw,
    target: raw.slice(0, 120),
    families: effective.map((f) => f.id),
    topics: [...topics].slice(0, 30),
    markers: [...markers].slice(0, 160),
    exemplars: [...exemplars].slice(0, 24),
    guards: [...guards].slice(0, 60),
    allow: [],
    engine: 'local',
  }
}

/** 供打分器使用的语义锚点。 */
export async function buildAnchors(profile: Profile): Promise<Float32Array[] | null> {
  const texts = [profile.target, ...profile.exemplars].filter(Boolean).slice(0, 20)
  const vectors = await embed(texts)
  return vectors
}
