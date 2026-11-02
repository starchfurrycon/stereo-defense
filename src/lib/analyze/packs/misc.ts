import type { Pack, Rule } from './shared'

const THREAT: Rule = {
  any: ['去死', '死全家', '你妈死了', 'nmsl', '开盒', '人肉', '杀你', '弄死你', '杀了你'],
  weight: 0.9,
  reason: '威胁或开盒',
}

const INSULT: Rule = {
  any: ['傻逼', '脑残', '弱智', '智障', '废物', '狗东西', '蛆', '贱', '婊', '狗腿'],
  weight: 0.55,
  reason: '辱骂',
}

export const abusePack: Pack = {
  id: 'abuse',
  label: '人身攻击',
  desc: '辱骂、开盒、威胁一类的纯攻击性发言',
  scope: 'both',
  topics: [],
  rules: [THREAT, INSULT],
  guards: ['举报', '人身攻击', '网络暴力', '理性讨论', '文明发言', '别骂'],
  structural: [],
  defaults: {
    standard: { block: 0.64, review: 0.42, minEvidence: 1, soloWeight: 0.85, cascade: 0 },
    aggressive: { block: 0.56, review: 0.36, minEvidence: 1, soloWeight: 0.7, cascade: 0 },
  },
}

const EROTIC: Rule = {
  any: ['福利视频', '擦边', '软色情', '约炮', '有偿陪侍', '原味'],
  weight: 0.75,
  reason: '软色情或交易',
}

const LURE: Rule = {
  any: ['懂的都懂', '私信我', '加微信', '主页简介', '深夜福利', '未成年'],
  weight: 0.3,
  reason: '擦边引流话术',
}

export const vulgarPack: Pack = {
  id: 'vulgar',
  label: '低俗擦边',
  desc: '软色情引流、擦边生意',
  scope: 'both',
  topics: ['舞蹈', '穿搭', '写真', '私房'],
  rules: [EROTIC, LURE],
  guards: ['举报', '违法', '不良信息', '净网', '监管'],
  structural: [],
  defaults: {
    standard: { block: 0.72, review: 0.48, minEvidence: 1, soloWeight: 1, cascade: 0 },
    aggressive: { block: 0.62, review: 0.4, minEvidence: 1, soloWeight: 1, cascade: 0 },
  },
}

const SCAM: Rule = {
  any: ['稳赚不赔', '保本保收益', '内部渠道', '带你上车', '日入过万', '躺赚'],
  weight: 0.88,
  reason: '典型诈骗话术',
}

const FUNNEL: Rule = {
  any: ['加群领取', '私信领取', '限时免费', '名额有限', '币圈', '带单'],
  weight: 0.42,
  reason: '引流话术',
}

export const fraudPack: Pack = {
  id: 'fraud',
  label: '诈骗引流',
  desc: '稳赚不赔、带你上车、内部渠道',
  scope: 'both',
  topics: ['理财', '副业', '兼职', '投资'],
  rules: [SCAM, FUNNEL],
  guards: ['诈骗', '骗局', '割韭菜', '报警', '别信', '谨防'],
  structural: [],
  defaults: {
    standard: { block: 0.7, review: 0.45, minEvidence: 1, soloWeight: 1, cascade: 0 },
    aggressive: { block: 0.6, review: 0.38, minEvidence: 1, soloWeight: 1, cascade: 0 },
  },
}

export const miscPacks: Pack[] = [abusePack, vulgarPack, fraudPack]
