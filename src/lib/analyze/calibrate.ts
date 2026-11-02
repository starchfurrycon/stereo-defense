import { Reflex } from './engine'
import { TEXT_CORPUS } from './corpus'
import { PACK_MAP } from './packs'
import { emptySignals, type AccountSignals } from './signals'
import { rescoreCandidate } from '../verdict'
import type { FamilyId } from './families'
import type { Candidate, FamilyMode } from '../types'

/**
 * 判定自检。
 *
 * 跑的是一条评论 / 一个账号在**当前力度**下的真实判定链路，
 * 而不是只算词表分数——只有这样才能看见「路人保护」「连坐降级」的真实代价。
 */

export interface MissedSample {
  text: string
  score: number
  note?: string
}

export interface FamilyStat {
  family: FamilyId
  label: string
  targets: number
  caught: number
  /** 进了复核线但没到拉黑线 */
  borderline: number
  missed: MissedSample[]
}

export interface FalseHit {
  text: string
  kind: 'critic' | 'neutral'
  family: FamilyId
  label: string
  score: number
  reason: string
}

export interface Calibration {
  families: FamilyStat[]
  falseHits: FalseHit[]
  targetTotal: number
  targetCaught: number
  negativeTotal: number
  negativeHit: number
}

function blankCandidate(overrides: Partial<Candidate>): Candidate {
  return {
    mid: 0,
    uname: '',
    sign: '',
    level: 0,
    silence: 0,
    officialType: -1,
    officialRole: 0,
    officialTitle: '',
    relation: 'commenter',
    blocked: false,
    evidences: [],
    matches: [],
    score: 0,
    verdict: 'skip',
    breadth: 0,
    flags: [],
    ...overrides,
  }
}

export function judgeText(
  reflex: Reflex,
  text: string,
  modes: Record<FamilyId, FamilyMode>,
  relation: Candidate['relation'] = 'commenter',
): Candidate {
  const verdicts = reflex.evaluate(text)
  const candidate = blankCandidate({ relation })
  candidate.evidences = [
    {
      source: relation === 'author' ? 'video' : 'reply',
      text,
      verdicts,
      score: verdicts[0]?.score ?? 0,
    },
  ]
  rescoreCandidate(candidate, modes)
  return candidate
}

export function calibrate(families: FamilyId[], modes: Record<FamilyId, FamilyMode>): Calibration {
  const reflex = new Reflex(families)
  const stats = new Map<FamilyId, FamilyStat>()
  for (const id of families) {
    stats.set(id, {
      family: id,
      label: PACK_MAP.get(id)?.label ?? id,
      targets: 0,
      caught: 0,
      borderline: 0,
      missed: [],
    })
  }

  const falseHits: FalseHit[] = []
  let targetTotal = 0
  let targetCaught = 0
  let negativeTotal = 0
  let negativeHit = 0

  for (const sample of TEXT_CORPUS) {
    const candidate = judgeText(reflex, sample.text, modes)
    const top = candidate.matches[0]
    if (sample.family === 'none') {
      negativeTotal++
      if (candidate.verdict === 'block' && top) {
        negativeHit++
        falseHits.push({
          text: sample.text,
          kind: sample.kind === 'critic' ? 'critic' : 'neutral',
          family: top.family,
          label: PACK_MAP.get(top.family)?.label ?? top.family,
          score: top.score,
          reason: top.reasons[0] ?? '',
        })
      }
      continue
    }
    const stat = stats.get(sample.family)
    if (!stat) continue
    targetTotal++
    stat.targets++
    const match = candidate.matches.find((m) => m.family === sample.family)
    if (candidate.verdict === 'block' && top?.family === sample.family) {
      stat.caught++
      targetCaught++
    } else {
      if (match && match.score >= match.level.review) stat.borderline++
      stat.missed.push({ text: sample.text, score: match?.score ?? 0, note: sample.note })
    }
  }

  return {
    families: [...stats.values()],
    falseHits,
    targetTotal,
    targetCaught,
    negativeTotal,
    negativeHit,
  }
}

/* ------------------------------------------------------------------ */
/* 结构信号                                                            */
/* ------------------------------------------------------------------ */

export interface SignalSample {
  family: FamilyId | 'none'
  note: string
  signals: Partial<AccountSignals>
}

export const SIGNAL_CORPUS: SignalSample[] = [
  {
    family: 'politics',
    note: '近 30 条投稿八成是国际时政',
    signals: { videos: 30, politicsRatio: 0.83, partitionTop: '新闻' },
  },
  {
    family: 'politics',
    note: '时政占一半',
    signals: { videos: 20, politicsRatio: 0.55, partitionTop: '资讯' },
  },
  {
    family: 'none',
    note: '游戏区 UP，偶尔聊时政',
    signals: { videos: 40, politicsRatio: 0.05, gameRatio: 0.8 },
  },
  {
    family: 'shill',
    note: '近 30 条里 22 条挂带货链接',
    signals: { videos: 30, adRatio: 0.73 },
  },
  {
    family: 'shill',
    note: '一半投稿带推广',
    signals: { videos: 12, adRatio: 0.5 },
  },
  {
    family: 'none',
    note: '偶尔一条商单',
    signals: { videos: 30, adRatio: 0.06 },
  },
  {
    family: 'cultist',
    note: '九成投稿只发一款游戏',
    signals: { videos: 30, gameRatio: 0.9, topGameShare: 0.87, level: 6 },
  },
  {
    family: 'none',
    note: '杂食游戏区，什么都玩',
    signals: { videos: 30, gameRatio: 0.8, topGameShare: 0.2, level: 6 },
  },
  {
    family: 'bot',
    note: '同一条评论被 5 个号复制',
    signals: { videos: 0, fans: 3, level: 1, templated: 5, defaultFace: true, randomName: true, ageDays: 20 },
  },
  {
    family: 'none',
    note: '正常小号，只是等级低',
    signals: { videos: 0, fans: 3, level: 1, templated: 0, ageDays: 400, defaultFace: false },
  },
]

export function judgeSignals(
  signals: Partial<AccountSignals>,
  modes: Record<FamilyId, FamilyMode>,
): Candidate {
  const candidate = blankCandidate({ relation: 'author', signals: { ...emptySignals(), ...signals } })
  rescoreCandidate(candidate, modes)
  return candidate
}

export function calibrateSignals(modes: Record<FamilyId, FamilyMode>): {
  hits: number
  total: number
  falseHits: number
  negatives: number
  detail: Array<{ note: string; expect: string; got: string; score: number; blocked: boolean }>
} {
  let hits = 0
  let total = 0
  let falseHits = 0
  let negatives = 0
  const detail: Array<{ note: string; expect: string; got: string; score: number; blocked: boolean }> = []

  for (const sample of SIGNAL_CORPUS) {
    const candidate = judgeSignals(sample.signals, modes)
    const top = candidate.matches[0]
    const blocked = candidate.verdict === 'block'
    const got = top ? (PACK_MAP.get(top.family)?.label ?? top.family) : '未命中'
    if (sample.family === 'none') {
      negatives++
      if (blocked) falseHits++
    } else {
      total++
      if (blocked && top?.family === sample.family) hits++
    }
    detail.push({
      note: sample.note,
      expect: sample.family === 'none' ? '放行' : (PACK_MAP.get(sample.family)?.label ?? sample.family),
      got,
      score: top?.score ?? 0,
      blocked,
    })
  }

  return { hits, total, falseHits, negatives, detail }
}
