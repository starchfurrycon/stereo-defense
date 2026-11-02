import { ALL_PACKS, getPack, type Pack, type Rule } from './packs'
import { NEGATIONS, SOFT_GUARDS, STRONG_GUARDS } from './packs/shared'
import { TermMatcher, type TermHit } from './matcher'
import { isQuoted, normalize, prepare, CONTRAST_CUES, hasReportingBefore, indexOfAny } from './text'
import type { FamilyId } from './families'

/**
 * 反射层：单条文本 → 每个目标分类的强度。
 *
 * 三条防线叠在一起，用来把「话题」和「立场」分开：
 * 1. 共现约束：彩礼单独出现不算，必须和「应该 / 凭什么」同框；
 * 2. 反驳语境：窗口里出现「反对 / 揭露 / 辟谣」之类的词，权重压到 12%；
 * 3. 引号与否定：引用的别人的话、被否定的表述，一律降权。
 */

export interface RuleHit {
  family: FamilyId
  term: string
  reason: string
  /** 降权后的权重 */
  weight: number
  /** 规则原始权重 */
  rawWeight: number
  guarded: boolean
  quoted: boolean
  negated: boolean
  /** 被任何一种语境信号降过权 */
  penalized: boolean
  start: number
}

export interface FamilyVerdict {
  family: FamilyId
  /** 0..1 */
  score: number
  /** 最强一条干净命中的原始权重，用来判断能不能单条定案 */
  soloWeight: number
  /** 是否存在「没被引号 / 没被反驳」的强命中 */
  clean: boolean
  hits: RuleHit[]
}

interface RuleRef {
  pack: number
  rule: number
  ruleData: Rule
}

const GUARD_WINDOW = 28
const DEFAULT_WINDOW = 26

export class Reflex {
  private readonly packs: Pack[]
  private readonly anyMatcher: TermMatcher
  private readonly anyRefs: RuleRef[][]
  private readonly strongGuards: TermMatcher
  private readonly strongGuardPack: number[]
  private readonly softGuards: TermMatcher
  private readonly extraGuards: string[]

  constructor(families: FamilyId[], extras?: { markers?: string[]; guards?: string[] }) {
    const selected = families.length ? families : ALL_PACKS.map((p) => p.id)
    const base = selected
      .map((id) => ALL_PACKS.find((p) => p.id === id))
      .filter((p): p is Pack => Boolean(p))

    const markers = (extras?.markers ?? []).map((m) => m.trim()).filter(Boolean)
    this.packs = markers.length
      ? base.map((p) => ({
          ...p,
          rules: [
            ...p.rules,
            {
              any: markers,
              weight: 0.6,
              reason: '你补充的话术',
            },
          ],
        }))
      : base
    this.extraGuards = (extras?.guards ?? []).map((g) => g.trim()).filter(Boolean)

    /* 触发词：全部分类共用一台自动机，一次扫描拿到所有命中 */
    const termIndex = new Map<string, number>()
    const terms: string[] = []
    const refs: RuleRef[][] = []
    const register = (term: string, ref: RuleRef): void => {
      const norm = normalize(term)
      if (norm.length < 2) return
      let idx = termIndex.get(norm)
      if (idx === undefined) {
        idx = terms.length
        termIndex.set(norm, idx)
        terms.push(norm)
        refs.push([])
      }
      const bucket = refs[idx]
      if (!bucket.some((r) => r.pack === ref.pack && r.rule === ref.rule)) bucket.push(ref)
    }
    this.packs.forEach((pack, pi) => {
      pack.rules.forEach((rule, ri) => {
        for (const term of rule.any) register(term, { pack: pi, rule: ri, ruleData: rule })
      })
    })
    this.anyMatcher = new TermMatcher(terms)
    this.anyRefs = refs

    /* 强反驳词：通用词对所有族生效，族内词只对同族生效 */
    const strongTerms: string[] = []
    const strongPack: number[] = []
    for (const g of STRONG_GUARDS) {
      strongTerms.push(normalize(g))
      strongPack.push(-1)
    }
    this.packs.forEach((pack, pi) => {
      for (const g of pack.guards) {
        const norm = normalize(g)
        if (norm.length < 2) continue
        strongTerms.push(norm)
        strongPack.push(pi)
      }
    })
    for (const g of this.extraGuards) {
      const norm = normalize(g)
      if (norm.length < 2) continue
      strongTerms.push(norm)
      strongPack.push(-1)
    }

    this.strongGuards = new TermMatcher(strongTerms)
    this.strongGuardPack = strongPack

    this.softGuards = new TermMatcher(SOFT_GUARDS.map(normalize).filter((t) => t.length >= 2))
  }

  get families(): FamilyId[] {
    return this.packs.map((p) => p.id)
  }

  packOf(family: FamilyId): Pack {
    return getPack(family)
  }

  evaluate(raw: string): FamilyVerdict[] {
    const text = raw.trim()
    if (!text) return []
    const prepared = prepare(text)
    const norm = prepared.norm
    if (norm.length < 2) return []

    const anyHits = this.anyMatcher.find(norm)
    if (!anyHits.length) return []

    const guardHits = this.strongGuards.find(norm)
    const softHits = this.softGuards.find(norm)
    // 「但是 / 然而」之前多半是铺垫或转述，之后才是真立场
    const contrastAt = indexOfAny(norm, CONTRAST_CUES)

    const byFamily = new Map<FamilyId, Map<string, RuleHit>>()

    for (const hit of anyHits) {
      const refs = this.anyRefs[hit.index]
      if (!refs?.length) continue
      for (const ref of refs) {
        const pack = this.packs[ref.pack]
        const rule = ref.ruleData
        const start = hit.start
        const end = hit.end
        const radius = rule.window ?? DEFAULT_WINDOW
        const windowStart = Math.max(0, start - radius)
        const windowEnd = Math.min(norm.length, end + radius)
        const window = norm.slice(windowStart, windowEnd)

        if (rule.all && !containsAny(window, rule.all)) continue
        if (rule.also && !containsAny(window, rule.also)) continue
        if (rule.none && containsAny(window, rule.none)) continue

        const quoted = isQuoted(prepared, start, end)
        const guarded = hasGuard(
          guardHits,
          this.strongGuardPack,
          ref.pack,
          windowStart,
          windowEnd,
        )
        const soft = hasGuard(softHits, null, -1, windowStart, windowEnd)
        const negated = isNegated(norm, start, end)
        const reported = hasReportingBefore(norm, start)
        const afterContrast = contrastAt >= 0 && start < contrastAt

        let weight = rule.weight
        if (quoted) weight *= 0.14
        if (guarded) weight *= 0.12
        else if (soft) weight *= 0.45
        if (negated) weight *= 0.35
        if (afterContrast) weight *= 0.55
        if (reported) weight *= 0.45

        const term = norm.slice(start, end)
        const key = `${ref.rule}:${term}`
        const family = pack.id
        let bucket = byFamily.get(family)
        if (!bucket) {
          bucket = new Map()
          byFamily.set(family, bucket)
        }
        const prev = bucket.get(key)
        if (!prev || weight > prev.weight) {
          bucket.set(key, {
            family,
            term: text.slice(
              prepared.map[start] ?? 0,
              (prepared.map[end - 1] ?? prepared.map[start] ?? 0) + 1,
            ),
            reason: rule.reason,
            weight,
            rawWeight: rule.weight,
            guarded,
            quoted,
            negated,
            penalized: quoted || guarded || soft || negated || reported || afterContrast,
            start,
          })
        }
      }
    }

    const out: FamilyVerdict[] = []
    for (const [family, bucket] of byFamily) {
      const hits = [...bucket.values()].sort((a, b) => b.weight - a.weight)
      let score = 0
      for (let i = 0; i < hits.length; i++) {
        score += hits[i].weight * (1 - score) * Math.pow(0.62, i)
      }
      const cleanHit = hits.find((h) => !h.penalized)
      if (score < 0.05) continue
      out.push({
        family,
        score: Math.min(0.98, score),
        soloWeight: cleanHit?.rawWeight ?? 0,
        clean: Boolean(cleanHit),
        hits: hits.slice(0, 8),
      })
    }
    return out.sort((a, b) => b.score - a.score)
  }
}

function containsAny(text: string, terms: string[]): boolean {
  for (const t of terms) {
    if (t && text.includes(t)) return true
  }
  return false
}

function hasGuard(
  hits: TermHit[],
  packs: number[] | null,
  packIndex: number,
  from: number,
  to: number,
): boolean {
  for (const hit of hits) {
    if (hit.end <= from || hit.start >= to) continue
    if (packs) {
      const owner = packs[hit.index]
      if (owner !== -1 && owner !== packIndex) continue
    }
    return true
  }
  return false
}

function isNegated(norm: string, start: number, _end: number): boolean {
  const before = norm.slice(Math.max(0, start - 2), start)
  for (const ch of before) {
    if (NEGATIONS.includes(ch)) return true
  }
  return false
}

/** 供界面展示：把命中折成「哪一类 / 因为哪句话」。 */
export function describeHits(verdict: FamilyVerdict[]): string[] {
  const out: string[] = []
  for (const v of verdict) {
    for (const h of v.hits.slice(0, 2)) {
      out.push(`${getPack(v.family).label} · ${h.reason}`)
    }
  }
  return out
}

export { GUARD_WINDOW }
