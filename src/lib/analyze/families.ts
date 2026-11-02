/**
 * 目标分类。
 *
 * 八类来自用户的真实诉求，另有三类通用攻击性内容作为补充。
 * 每一类都可以单独开关、单独调力度，因为它们误伤的代价并不相同：
 * 「时政号」只在作者层判定，评论里聊两句政治不会被拉黑；
 * 「极端女权」则允许连坐其活跃粉丝。
 */

export type FamilyId =
  | 'traitor'
  | 'radfem'
  | 'softfem'
  | 'lgbt'
  | 'cultist'
  | 'bot'
  | 'politics'
  | 'shill'
  | 'abuse'
  | 'vulgar'
  | 'fraud'

export interface FamilyMeta {
  id: FamilyId
  label: string
  /** 界面上的两字简称 */
  short: string
  desc: string
  /** 默认是否开启 */
  on: boolean
  tone: 'accent' | 'warn' | 'danger' | 'ok' | 'dim'
}

export const FAMILIES: FamilyMeta[] = [
  {
    id: 'traitor',
    label: '殖人 · 汉奸',
    short: '殖',
    desc: '自恨式贬低本国、吹捧外国，或主张分裂、为侵略与屠杀翻案',
    on: true,
    tone: 'danger',
  },
  {
    id: 'radfem',
    label: '极端女权',
    short: '拳',
    desc: '以性别给人定罪：国男、普信男、男性原罪一类的仇恨表达',
    on: true,
    tone: 'danger',
  },
  {
    id: 'softfem',
    label: '微女权',
    short: '微',
    desc: '轻症版本：男性天然不会共情 / 不懂恋爱，女性永远正确，把男性向二游说成缅北',
    on: true,
    tone: 'warn',
  },
  {
    id: 'lgbt',
    label: 'LGBT 互喷',
    short: 'L',
    desc: '性少数议题里的攻击性表达，双向判定：恐同辱骂与顺直猎巫都算',
    on: true,
    tone: 'warn',
  },
  {
    id: 'cultist',
    label: '厂商结晶',
    short: '晶',
    desc: '为游戏厂商无底线护航、攻击批评者，把消费当成信仰',
    on: true,
    tone: 'warn',
  },
  {
    id: 'bot',
    label: '黑流机器人',
    short: '机',
    desc: '引战、刷屏、模板评论、引流小号，以及靠对立吃黑流量的账号',
    on: true,
    tone: 'danger',
  },
  {
    id: 'politics',
    label: '时政号',
    short: '政',
    desc: '投稿几乎全是时政话题的账号。只判定作者，不判定评论区路人',
    on: true,
    tone: 'dim',
  },
  {
    id: 'shill',
    label: '全商单 UP',
    short: '商',
    desc: '投稿的绝大多数都是带货、口播广告、返利链接',
    on: true,
    tone: 'dim',
  },
  {
    id: 'abuse',
    label: '人身攻击',
    short: '骂',
    desc: '辱骂、开盒、威胁一类的纯攻击性发言',
    on: false,
    tone: 'danger',
  },
  {
    id: 'vulgar',
    label: '低俗擦边',
    short: '擦',
    desc: '软色情引流、擦边生意',
    on: false,
    tone: 'warn',
  },
  {
    id: 'fraud',
    label: '诈骗引流',
    short: '诈',
    desc: '稳赚不赔、带你上车、内部渠道',
    on: false,
    tone: 'warn',
  },
]

export const FAMILY_IDS = FAMILIES.map((f) => f.id)

export const FAMILY_MAP = new Map(FAMILIES.map((f) => [f.id, f]))
