import type { AccountSignals } from '../signals'
import type { FamilyId } from '../families'

export type { FamilyId }

export type PackScope = 'author' | 'comment' | 'both'

/**
 * 一条判定规则。
 *
 * `any` 是对外的触发词，真正决定强度的是 `all` / `also` / `none` 的组合约束：
 * 「彩礼」单独出现可能只是讨论社会现象，只有和「应该 / 必须 / 凭什么」同框
 * 才构成立场。这是把「话题」和「立场」分开的关键。
 */
export interface Rule {
  any: string[]
  /** 命中后还必须在窗口内出现其中任意一个 */
  all?: string[]
  /** 第二组必要条件，用于三方共现 */
  also?: string[]
  /** 出现任意一个即放弃本次命中 */
  none?: string[]
  /** 共现窗口半径（归一化字符），默认 26 */
  window?: number
  /** 该条规则单独命中的强度 0..1 */
  weight: number
  /** 给用户看的依据，一句话 */
  reason: string
}

/**
 * 结构信号规则：不看文本，看账号本身。
 * 结晶、机器人、时政号、商单号这四类靠文本几乎不可能判准，必须靠结构。
 */
export interface StructuralRule {
  id: string
  weight: number
  reason: string
  when: (s: AccountSignals) => boolean
}

export interface FamilyLevel {
  /** 达到该分数建议拉黑 */
  block: number
  /** 达到该分数进入人工复核 */
  review: number
  /** 至少需要几条独立证据 */
  minEvidence: number
  /** 单条证据要能独立定案，其规则强度至少要这么高 */
  soloWeight: number
  /** 连坐：0 不连坐 / 1 只连坐同族账号的活跃粉丝 / 2 扩大采样 */
  cascade: 0 | 1 | 2
}

export interface Pack {
  id: FamilyId
  label: string
  /** 一行说明，用于界面 */
  desc: string
  scope: PackScope
  /** 检索用领域词：只决定「去哪里找」，不决定拉黑谁 */
  topics: string[]
  rules: Rule[]
  guards: string[]
  structural: StructuralRule[]
  defaults: {
    standard: FamilyLevel
    aggressive: FamilyLevel
  }
}

/* ------------------------------------------------------------------ */
/* 通用反驳语境                                                        */
/* ------------------------------------------------------------------ */

/**
 * 强反驳词：命中窗口内出现即把权重压到 12%。
 * 只收「批判者一定会用、而目标人群几乎不会用」的短语。
 * 单个「不」「错」这类太常见的词一律不进，否则会把真目标也压掉。
 */
export const STRONG_GUARDS: string[] = [
  '坚决反对',
  '强烈谴责',
  '反对',
  '谴责',
  '批判',
  '驳斥',
  '揭穿',
  '揭露',
  '曝光',
  '警惕',
  '防范',
  '抵制',
  '严惩',
  '依法',
  '违法行为',
  '错误言论',
  '荒谬',
  '拙劣',
  '谎言',
  '谣言',
  '辟谣',
  '事实是',
  '真相是',
  '所谓',
  '打着',
  '妄图',
  '企图',
  '数典忘祖',
  '卖国',
  '分裂国家',
  '危害',
  '挑衅',
  '闹剧',
  '打脸',
  '翻车',
  '别被',
  '不要被',
  '认贼作父',
  '吃里扒外',
  '端起碗吃饭',
  '端起碗吃肉',
  '反串',
  '钓鱼',
  '引战',
  '别带节奏',
  '举报',
  '拉黑',
]

/** 弱反驳词：只把权重打到 45%，因为正经讨论里也常见。 */
export const SOFT_GUARDS: string[] = [
  '理性',
  '客观',
  '冷静',
  '讨论',
  '观点',
  '看法',
  '建议',
  '研究',
  '数据',
  '统计',
  '报道',
  '新闻',
  '据说',
  '有人认为',
  '部分',
  '有些',
  '某些',
  '不一定',
  '未必',
]

/** 前置否定：「不」「没」「别」紧贴命中词时视为否定表述。 */
export const NEGATIONS = ['不', '没', '别', '非', '未', '无', '勿', '拒', '反']

export const DEFAULT_LEVEL: FamilyLevel = {
  block: 0.72,
  review: 0.44,
  minEvidence: 2,
  soloWeight: 0.9,
  cascade: 0,
}

export const EMPTY_STRUCTURAL: StructuralRule[] = []
