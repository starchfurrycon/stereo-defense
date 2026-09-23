import { FAMILIES, matchLexicon, weightToScore, type LexFamily } from './lexicon'
import { buildAnchors } from './local'
import { cosine, embed, normalizeSimilarity } from './embed'
import type { Candidate, Evidence, Profile, SourceKind, Verdict } from '../types'

export interface Thresholds {
  /** 达到该分数才建议拉黑 */
  block: number
  /** 达到该分数进入人工复核 */
  review: number
}

export const DEFAULT_THRESHOLDS: Thresholds = { block: 0.72, review: 0.42 }

export interface Scorer {
  profile: Profile
  families: LexFamily[]
  anchors: Float32Array[] | null
  thresholds: Thresholds
}

export async function makeScorer(profile: Profile, thresholds = DEFAULT_THRESHOLDS): Promise<Scorer> {
  const families = FAMILIES.filter((f) => profile.families.includes(f.id))
  const anchors = await buildAnchors(profile)
  return { profile, families, anchors, thresholds }
}

export interface RawEvidence {
  source: SourceKind
  text: string
  url?: string
  ts?: number
  /** 评论者昵称等附加信息 */
  extra?: string
}

const SOURCE_TRUST: Record<SourceKind, number> = {
  // 本人主动产出的内容，可信度最高
  video: 1,
  dynamic: 0.96,
  article: 0.96,
  reply: 0.92,
  sign: 0.9,
  name: 0.5,
  // 他人评价只能作为佐证
  peer: 0.62,
  follow: 0.7,
  account: 0.2,
}

/** 单条证据的分数上限，避免弱来源单独定案。 */
const SOURCE_CAP: Partial<Record<SourceKind, number>> = {
  peer: 0.7,
  follow: 0.55,
  name: 0.45,
  account: 0.3,
}

/**
 * 对一批文本打分。
 * lexical 走词表并带反驳语境降权，semantic 走内置小模型，
 * 两者都低则丢弃，避免把「只是聊到该话题」当成立场证据。
 */
export async function scoreBatch(scorer: Scorer, items: RawEvidence[]): Promise<Evidence[]> {
  if (!items.length) return []
  const texts = items.map((i) => i.text.slice(0, 480))
  const vectors = scorer.anchors ? await embed(texts) : null

  const out: Evidence[] = []
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const lex = matchLexicon(item.text, scorer.families, scorer.profile.markers, scorer.profile.guards)
    const lexical = weightToScore(lex.weight)

    let semantic = 0
    if (vectors && scorer.anchors) {
      const v = vectors[i]
      if (v) {
        for (const a of scorer.anchors) {
          const sim = normalizeSimilarity(cosine(v, a))
          if (sim > semantic) semantic = sim
        }
      }
    } else if (!scorer.anchors) {
      // 无模型时把词表信号当作语义近似，整体更保守
      semantic = lexical * 0.75
    }

    const trust = SOURCE_TRUST[item.source]
    let score = (lexical * 0.58 + semantic * 0.42) * trust

    // 只有话题重合、没有立场信号：明确压制，防止误伤国际时事类内容
    if (lexical < 0.08 && semantic < 0.5) score = Math.min(score, 0.22)
    // 词表命中但语义完全不像：多半是引用/转述/批判
    if (lexical > 0.3 && semantic < 0.28) score *= 0.45

    const cap = SOURCE_CAP[item.source]
    if (cap !== undefined) score = Math.min(score, cap)

    if (score < 0.1) continue
    out.push({
      source: item.source,
      text: item.text.slice(0, 200),
      hits: [...new Set(lex.hits.map((h) => h.term))].slice(0, 8),
      guardHits: lex.guards.slice(0, 6),
      lexical,
      semantic,
      score: Math.min(1, score),
      url: item.url,
      ts: item.ts,
    })
  }
  return out.sort((a, b) => b.score - a.score)
}

const OFFICIAL_ROLES = new Set([3, 4, 5, 6])

/** 把证据汇总成账号级结论，并附上需要人工确认的理由。 */
export function aggregate(scorer: Scorer, candidate: Candidate): void {
  const ev = [...candidate.evidences].sort((a, b) => b.score - a.score).slice(0, 12)
  candidate.evidences = ev
  candidate.flags = []

  const top = ev[0]?.score ?? 0
  const second = ev[1]?.score ?? 0
  const third = ev[2]?.score ?? 0
  const strong = ev.filter((e) => e.score >= 0.5)
  const breadth = new Set(strong.map((e) => e.source)).size
  candidate.breadth = breadth

  // 单一来源即使分高也只给有限权重，多源互相印证才显著加分
  let score = top * 0.6 + second * 0.17 + third * 0.08 + Math.min(breadth, 3) * 0.05

  const selfProduced = strong.some((e) => e.source === 'video' || e.source === 'dynamic' || e.source === 'article')
  const strongSingle = top >= 0.88 && (ev[0]?.lexical ?? 0) >= 0.75
  const corroborated = strong.length >= 2 || breadth >= 2

  if (!strongSingle && !corroborated) {
    score = Math.min(score, scorer.thresholds.block - 0.02)
    if (top > scorer.thresholds.review) candidate.flags.push('证据单薄')
  }

  // 本人署名内容只出现在评论里 → 需要人看一眼，避免把「路过吐槽」当成长期立场
  if (!selfProduced && top > scorer.thresholds.review) candidate.flags.push('仅评论证据')

  if (candidate.officialType >= 0 || OFFICIAL_ROLES.has(candidate.officialRole)) {
    candidate.flags.push('机构认证')
    if (score < scorer.thresholds.block + 0.12) score = Math.min(score, scorer.thresholds.block - 0.01)
  }

  if (candidate.silence > 0 || candidate.banned) {
    candidate.flags.push('账号已封禁')
  }

  if ((candidate.fans ?? 0) >= 100000 && score >= scorer.thresholds.review) {
    candidate.flags.push('大号')
  }

  const allowHit = scorer.profile.allow.find((a) => a && (candidate.uname.includes(a) || candidate.sign.includes(a)))
  if (allowHit) {
    candidate.flags.push('命中白名单')
    score = 0
  }

  candidate.score = Math.max(0, Math.min(1, score))
  candidate.verdict = verdictOf(candidate.score, scorer.thresholds)
}

function verdictOf(score: number, t: Thresholds): Verdict {
  if (score >= t.block) return 'block'
  if (score >= t.review) return 'review'
  return 'skip'
}

export function applyThresholds(candidates: Candidate[], t: Thresholds): void {
  for (const c of candidates) c.verdict = verdictOf(c.score, t)
}
