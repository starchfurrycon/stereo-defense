import { PACK_MAP } from './packs'
import {
  ageInDays,
  computeTextRatios,
  emptySignals,
  isDefaultFace,
  looksRandomName,
  signHasContact,
  type AccountSignals,
} from './signals'
import type { FamilyId } from './families'

export interface StructuralVerdict {
  family: FamilyId
  score: number
  reasons: string[]
}

/** 结构信号 → 分类强度。多条规则同样用噪声或叠加。 */
export function structuralVerdicts(signals: AccountSignals, families: FamilyId[]): StructuralVerdict[] {
  const out: StructuralVerdict[] = []
  for (const family of families) {
    const pack = PACK_MAP.get(family)
    if (!pack || !pack.structural.length) continue
    const weights: Array<{ w: number; reason: string }> = []
    for (const rule of pack.structural) {
      let hit = false
      try {
        hit = rule.when(signals)
      } catch {
        hit = false
      }
      if (hit) weights.push({ w: rule.weight, reason: rule.reason })
    }
    if (!weights.length) continue
    weights.sort((a, b) => b.w - a.w)
    let score = 0
    for (let i = 0; i < weights.length; i++) {
      score += weights[i].w * (1 - score) * Math.pow(0.6, i)
    }
    out.push({
      family,
      score: Math.min(0.97, score),
      reasons: weights.map((x) => x.reason),
    })
  }
  return out.sort((a, b) => b.score - a.score)
}

export interface AccountRaw {
  name: string
  sign: string
  face: string
  level: number
  fans: number
  following: number
  regtime: number
  videos: number
  verified: boolean
  /** 投稿的标题 + 简介 + 标签 */
  videoTexts: string[]
  /** 分区名 → 稿件数 */
  partitions: Record<string, number>
  dynamics: number
  comments: number
  distinctVideos: number
  templated: number
  clusterFollows: Partial<Record<FamilyId, number>>
}

/** 把采集到的原始字段折算成结构信号。 */
export function buildSignals(raw: AccountRaw): AccountSignals {
  const signals = emptySignals()
  const ratios = computeTextRatios(raw.videoTexts)
  let topPartition = ''
  let topCount = 0
  for (const [name, count] of Object.entries(raw.partitions)) {
    if (count > topCount) {
      topCount = count
      topPartition = name
    }
  }
  return {
    ...signals,
    level: raw.level,
    fans: raw.fans,
    following: raw.following,
    regtime: raw.regtime,
    ageDays: ageInDays(raw.regtime),
    videos: raw.videos,
    dynamics: raw.dynamics,
    comments: raw.comments,
    distinctVideos: raw.distinctVideos,
    templated: raw.templated,
    defaultFace: isDefaultFace(raw.face),
    randomName: looksRandomName(raw.name),
    contactInSign: signHasContact(raw.sign),
    adRatio: ratios.adRatio,
    politicsRatio: ratios.politicsRatio,
    gameRatio: ratios.gameRatio,
    topGameShare: ratios.topGameShare,
    partitionTop: topPartition,
    verified: raw.verified,
    clusterFollows: raw.clusterFollows,
  }
}

/** 结构层面的「是否值得连坐粉丝」判断：粉丝画像和本体越像，越值得看。 */
export function cascadeWorthwhile(signals: AccountSignals): boolean {
  return (
    signals.fans >= 30 &&
    signals.fans <= 200000 &&
    (signals.clusterFollows.radfem ?? 0) + (signals.clusterFollows.lgbt ?? 0) >= 1
  )
}
