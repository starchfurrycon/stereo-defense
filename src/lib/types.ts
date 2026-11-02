import type { FamilyVerdict } from './analyze/engine'
import type { FamilyId } from './analyze/families'
import type { FamilyLevel } from './analyze/packs/shared'
import type { AccountSignals } from './analyze/signals'

export type { FamilyId }

export type SourceKind =
  | 'sign'
  | 'name'
  | 'video'
  | 'dynamic'
  | 'article'
  | 'reply'
  | 'peer'
  | 'follow'
  | 'fans'
  | 'account'

export const SOURCE_LABEL: Record<SourceKind, string> = {
  sign: '签名',
  name: '昵称',
  video: '视频',
  dynamic: '动态',
  article: '专栏',
  reply: '评论',
  peer: '他人评价',
  follow: '关注列表',
  fans: '粉丝列表',
  account: '账号状态',
}

/** 账号是怎么被找到的。连坐进来的会标明来源。 */
export type Relation = 'author' | 'commenter' | 'fan' | 'follow' | 'search'

export const RELATION_LABEL: Record<Relation, string> = {
  author: '作者',
  commenter: '评论者',
  fan: '粉丝连坐',
  follow: '关注链路',
  search: '检索',
}

export interface Evidence {
  source: SourceKind
  text: string
  url?: string
  ts?: number
  /** 这条证据在各类目标上的判定 */
  verdicts: FamilyVerdict[]
  /** 最强一类的分数，仅用于排序与展示 */
  score: number
}

export interface FamilyMatch {
  family: FamilyId
  score: number
  /** 只看文本得到的分数 */
  textScore: number
  /** 只看账号结构得到的分数 */
  structuralScore: number
  reasons: string[]
  /** 参与计算的证据条数 */
  evidenceCount: number
  /** 是否满足「单条定案」的条件 */
  solo: boolean
  level: FamilyLevel
}

export type Verdict = 'block' | 'review' | 'skip'

export interface Candidate {
  mid: number
  uname: string
  sign: string
  face?: string
  level: number
  /** 0 正常, -2 封禁 */
  silence: number
  banned?: boolean
  vip?: boolean
  fans?: number
  following?: number
  regtime?: number
  videos?: number
  /** 认证：-1 无 / 0 个人 / 1 机构；role 3-6 为企业/组织/媒体/政府 */
  officialType: number
  officialRole: number
  officialTitle: string
  relation: Relation
  /** 连坐来源 */
  via?: { mid: number; uname: string; family: FamilyId }
  /** 该账号是否已被自己拉黑 */
  blocked: boolean
  evidences: Evidence[]
  matches: FamilyMatch[]
  score: number
  verdict: Verdict
  /** 命中的来源种类数 */
  breadth: number
  /** 需要人工确认的原因 */
  flags: string[]
  signals?: AccountSignals
  error?: string
}

export interface BlackEntry {
  mid: number
  uname: string
  /** 拉黑时间 */
  mtime: number
  /** 执行时该账号的分数 */
  score?: number
  /** 拉黑时归属的分类 */
  family?: FamilyId
  /** 来源：手动 / 自建 / 导入 */
  origin?: 'scan' | 'manual' | 'import'
}

/* ------------------------------------------------------------------ */
/* 目标配置                                                            */
/* ------------------------------------------------------------------ */

export type FamilyMode = 'off' | 'watch' | 'standard' | 'aggressive'

export const FAMILY_MODE_LABEL: Record<FamilyMode, string> = {
  off: '关闭',
  watch: '只标记',
  standard: '标准',
  aggressive: '连坐',
}

export type Preset = 'conservative' | 'standard' | 'aggressive'

export interface Targets {
  modes: Record<FamilyId, FamilyMode>
  preset: Preset
  /** 用户自己补的话术 */
  extraMarkers: string[]
  extraGuards: string[]
  /** 放行名单：命中即跳过 */
  allow: string[]
  /** 额外检索词 */
  topics: string[]
}

export interface Usage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  calls: number
  costUsd: number
  /** 计费是否来自接口返回的权威用量 */
  authoritative: boolean
}
