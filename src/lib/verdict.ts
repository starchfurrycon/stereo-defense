import { PACK_MAP } from './analyze/packs'
import { structuralVerdicts } from './analyze/account'
import { FAMILIES, type FamilyId } from './analyze/families'
import type { FamilyLevel, Pack } from './analyze/packs/shared'
import type { Candidate, Evidence, FamilyMatch, FamilyMode, Preset, Targets, Verdict } from './types'

/**
 * 判定编排：把「每条证据的分类强度」和「账号结构信号」汇总成账号级结论。
 *
 * 力度是这里的核心概念，分成四档，每类的默认值不同：
 * - 关闭：不参与；
 * - 只标记：只会出现在复核区，永远不会进「建议拉黑」；
 * - 标准：达到阈值即可建议拉黑，但需要足够的证据量；
 * - 连坐：阈值更低，并允许顺着粉丝列表继续挖。
 */

const OFFICIAL_ROLES = new Set([3, 4, 5, 6])

export function resolveLevel(pack: Pack, mode: FamilyMode): FamilyLevel {
  if (mode === 'aggressive') return pack.defaults.aggressive
  if (mode === 'watch') {
    return { ...pack.defaults.standard, block: 1, cascade: 0 }
  }
  return pack.defaults.standard
}

export function levelMap(modes: Record<FamilyId, FamilyMode>): Partial<Record<FamilyId, FamilyLevel>> {
  const out: Partial<Record<FamilyId, FamilyLevel>> = {}
  for (const [id, mode] of Object.entries(modes) as Array<[FamilyId, FamilyMode]>) {
    if (mode === 'off') continue
    const pack = PACK_MAP.get(id)
    if (pack) out[id] = resolveLevel(pack, mode)
  }
  return out
}

export function enabledFamilies(modes: Record<FamilyId, FamilyMode>): FamilyId[] {
  return (Object.entries(modes) as Array<[FamilyId, FamilyMode]>)
    .filter(([, mode]) => mode !== 'off')
    .map(([id]) => id)
}

export const PRESET_MODES: Record<Preset, Record<FamilyId, FamilyMode>> = {
  // 保守：只对「几乎是骂人」的两类动手，其余只标记
  conservative: {
    traitor: 'standard',
    radfem: 'standard',
    softfem: 'watch',
    lgbt: 'watch',
    cultist: 'watch',
    bot: 'standard',
    politics: 'watch',
    shill: 'watch',
    abuse: 'off',
    vulgar: 'off',
    fraud: 'off',
  },
  standard: {
    traitor: 'standard',
    radfem: 'standard',
    softfem: 'standard',
    lgbt: 'standard',
    cultist: 'standard',
    bot: 'standard',
    politics: 'standard',
    shill: 'standard',
    abuse: 'off',
    vulgar: 'off',
    fraud: 'off',
  },
  // 激进：阈值更低，并顺着粉丝列表连坐
  aggressive: {
    traitor: 'aggressive',
    radfem: 'aggressive',
    softfem: 'aggressive',
    lgbt: 'aggressive',
    cultist: 'aggressive',
    bot: 'aggressive',
    politics: 'aggressive',
    shill: 'aggressive',
    abuse: 'off',
    vulgar: 'off',
    fraud: 'off',
  },
}

export function presetTargets(preset: Preset): Record<FamilyId, FamilyMode> {
  return { ...PRESET_MODES[preset] }
}

/* ------------------------------------------------------------------ */
/* 汇总                                                                */
/* ------------------------------------------------------------------ */

function combineText(scores: number[]): number {
  const sorted = [...scores].sort((a, b) => b - a).slice(0, 8)
  let s = 0
  for (let i = 0; i < sorted.length; i++) {
    s += sorted[i] * (1 - s) * Math.pow(0.62, i)
  }
  return Math.min(0.98, s)
}

const COMPUTED_FLAGS = new Set(['粉丝连坐', '大号', '机构认证', '仅评论证据', '命中白名单'])

export function rescoreCandidate(candidate: Candidate, modes: Record<FamilyId, FamilyMode>): void {
  const families = enabledFamilies(modes)
  const structural = candidate.signals ? structuralVerdicts(candidate.signals, families) : []
  const matches: FamilyMatch[] = []
  // 保留采集阶段加上的标记（模板评论 / 签名引流），只清掉上一轮计算出来的
  candidate.flags = candidate.flags.filter((f) => !COMPUTED_FLAGS.has(f))

  for (const family of families) {
    const pack = PACK_MAP.get(family)
    if (!pack) continue
    const level = resolveLevel(pack, modes[family])

    const items = candidate.evidences.flatMap((e) => eligible(e, pack, family))
    const textScore = combineText(items.map((v) => v.score))
    const structuralScore = structural.find((s) => s.family === family)?.score ?? 0
    if (textScore < 0.02 && structuralScore < 0.02) continue

    let score = textScore + structuralScore * (1 - textScore)

    const solo = items.some((v) => v.clean && v.soloWeight >= level.soloWeight)
    // 只有文本证据才谈「证据条数」；结构信号本身就是一条独立证据
    if (textScore > 0 && items.length < level.minEvidence && !solo) {
      score = Math.min(score, level.block - 0.02)
    }
    // 连坐进来的粉丝，自己没有硬证据时只进复核
    if (candidate.relation === 'fan' && !solo) {
      score = Math.min(score, level.block - 0.03)
    }

    const reasons = new Set<string>()
    for (const v of items.slice(0, 6)) {
      for (const h of v.hits.slice(0, 2)) reasons.add(h.reason)
    }
    for (const s of structural.filter((x) => x.family === family)) {
      for (const r of s.reasons.slice(0, 2)) reasons.add(r)
    }

    matches.push({
      family,
      score: clamp01(score),
      textScore,
      structuralScore,
      reasons: [...reasons].slice(0, 5),
      evidenceCount: items.length,
      solo,
      level,
    })
  }

  if (candidate.silence === -2 || candidate.banned) {
    candidate.flags.push('账号已封禁')
  }
  if ((candidate.fans ?? 0) >= 100000) candidate.flags.push('大号')
  if (candidate.officialType >= 0 || OFFICIAL_ROLES.has(candidate.officialRole)) {
    candidate.flags.push('机构认证')
  }

  matches.sort((a, b) => b.score - a.score)
  candidate.matches = matches

  const top = matches[0]
  let score = top?.score ?? 0
  const level = top?.level

  // 机构与官方认证账号一律降级，交给人工
  if (level && (candidate.officialType >= 0 || OFFICIAL_ROLES.has(candidate.officialRole))) {
    score = Math.min(score, level.block - 0.01)
  }

  const onlyComments =
    candidate.evidences.length > 0 &&
    candidate.evidences.every((e) => e.source === 'reply' || e.source === 'peer')
  if (onlyComments && score >= (level?.review ?? 1)) candidate.flags.push('仅评论证据')

  candidate.score = clamp01(score)
  candidate.verdict = verdictOf(candidate, top)
}

function eligible(e: Evidence, pack: Pack, family: FamilyId) {
  if (pack.scope === 'author' && (e.source === 'reply' || e.source === 'peer')) return []
  return e.verdicts.filter((v) => v.family === family)
}

function verdictOf(candidate: Candidate, top: FamilyMatch | undefined): Verdict {
  if (!top) return 'skip'
  if (candidate.silence === -2) return 'skip'
  if (candidate.score >= top.level.block) return 'block'
  if (candidate.score >= top.level.review) return 'review'
  return 'skip'
}

export function applyTargets(candidates: Candidate[], targets: Targets): Candidate[] {
  for (const c of candidates) {
    rescoreCandidate(c, targets.modes)
    if (c.sign || c.uname) {
      const hit = targets.allow.find((a) => a && (c.uname.includes(a) || c.sign.includes(a)))
      if (hit) {
        c.flags.push('命中白名单')
        c.score = 0
        c.verdict = 'skip'
      }
    }
  }
  return candidates
}

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

export function familyLabel(family: FamilyId): string {
  return PACK_MAP.get(family)?.label ?? FAMILIES.find((f) => f.id === family)?.label ?? family
}
