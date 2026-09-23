export type Engine = 'llm' | 'local'

export type SourceKind =
  | 'sign'
  | 'name'
  | 'video'
  | 'dynamic'
  | 'article'
  | 'reply'
  | 'peer'
  | 'follow'
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
  account: '账号状态',
}

/** 提炼后的画像：把用户口语化描述转成可执行的判定规则。 */
export interface Profile {
  /** 用户原话 */
  raw: string
  /** 目标人群的一句话概括，作为语义锚点 */
  target: string
  /** 命中的立场族 id，决定使用哪一组标记词与反驳词 */
  families: string[]
  /** 检索用的领域词：只决定「去哪里找」，不决定「拉黑谁」 */
  topics: string[]
  /** 该立场的典型话术标记，命中即强信号 */
  markers: string[]
  /** 典型发言样例，用于语义比对 */
  exemplars: string[]
  /** 反驳/批判/科普语境标记：出现则压低得分，防止误伤批判者 */
  guards: string[]
  /** 需要放行的账号特征，如官方媒体 */
  allow: string[]
  engine: Engine
  usage?: Usage
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

export interface Evidence {
  source: SourceKind
  text: string
  /** 命中到的标记词 */
  hits: string[]
  /** 命中的反驳语境标记 */
  guardHits: string[]
  /** 词表信号 0..1 */
  lexical: number
  /** 语义相似度 0..1 */
  semantic: number
  /** 该条证据的最终强度 0..1 */
  score: number
  url?: string
  ts?: number
}

export type Verdict = 'block' | 'review' | 'skip'

export interface Candidate {
  mid: number
  uname: string
  sign: string
  level: number
  face?: string
  /** 认证：type -1 无 / 0 个人 / 1 机构；role 3-6 为企业/组织/媒体/政府 */
  officialType: number
  officialRole: number
  officialTitle: string
  /** 0 正常, 1 封禁中；2 为社区传闻的永久封禁 */
  silence: number
  /** spacesta === -2 */
  banned?: boolean
  vip?: boolean
  fans?: number
  /** 该账号是否已被自己拉黑 */
  blocked: boolean
  evidences: Evidence[]
  score: number
  verdict: Verdict
  /** 命中的来源种类数 */
  breadth: number
  /** 需要人工确认的原因 */
  flags: string[]
  /** 采集阶段遇到的错误 */
  error?: string
}

export interface BlackEntry {
  mid: number
  uname: string
  /** 拉黑时间 */
  mtime: number
  /** 执行时该账号的得分 */
  score?: number
}

export interface RunStats {
  startedAt: number
  finishedAt?: number
  requests: number
  candidates: number
  blocked: number
  failed: number
  phase: string
}
