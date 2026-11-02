import { AD_DOMAINS, AD_TERMS, CONTACT_TERMS, GAME_TITLES } from '../signals'
import type { Pack, Rule } from './shared'

/**
 * 游戏区三族。
 *
 * 「结晶」的判定必须兼顾文本与结构：同一句话，普通玩家的吐槽和护主的
 * 反击价值完全不同。所以这里既看「你不玩就滚」这类话术，也看
 * 「投稿八成是同一款游戏、关注列表全是同类」这种结构。
 */

/* ------------------------------------------------------------------ */
/* 厂商结晶                                                            */
/* ------------------------------------------------------------------ */

const DEFEND: Rule = {
  any: [
    '你不玩就滚',
    '爱玩不玩',
    '不玩就滚',
    '卸载吧',
    '白嫖还有理',
    '白嫖怪',
    '氪金是自愿的',
    '游戏公司也要吃饭',
    '免费游戏你还想怎样',
    '不氪金就别叫',
    '友商急了',
    '收钱黑',
    '云玩家',
    '你行你上',
    '不服你去告',
    '米哈游yyds',
    '吊打友商',
    '你懂个屁',
  ],
  weight: 0.68,
  reason: '为厂商无底线护航',
}

const FANBOY_LABEL: Rule = {
  any: [
    '米孝子',
    '米卫兵',
    '原批',
    '舟批',
    '库狗',
    '农批',
    '腾孝子',
    '腾讯水军',
    '鹰角孝子',
    '米哈游的狗',
    '孝子贤孙',
    '结晶粉',
    '结晶孝子',
  ],
  weight: 0.7,
  reason: '用「孝子 / 结晶」标签互相攻击',
}

const CRYSTAL: Rule = {
  any: ['结晶'],
  all: GAME_TITLES.concat(['厂商', '玩家', '抽卡', '数值']),
  window: 30,
  weight: 0.5,
  reason: '把护主说成「结晶」',
}

const GAME_ATTACK: Rule = {
  any: GAME_TITLES.concat(['游戏', '厂商', '策划', '官方']),
  all: ['孝子', '结晶', '卫兵', '水军', '黑子', '带节奏', '收钱', '急了', '护主', '洗地', '白嫖', '杠精', '云玩家'],
  weight: 0.58,
  reason: '在游戏话题里攻击批评者',
}

const ACCUSE: Rule = {
  any: ['黑子收钱', '收钱了吧', '带什么节奏', '友商急了', '急了急了', '黑子又'],
  weight: 0.62,
  reason: '把批评者说成黑子水军',
}

const ACCUSE_SOFT: Rule = {
  any: ['黑子', '水军', '云玩家', '杠精'],
  all: ['游戏', '厂商', '原神', '米哈游', '鸣潮', '崩铁', '绝区零', '官方', '策划', '差评'],
  window: 34,
  weight: 0.35,
  reason: '在游戏话题里给批评者贴标签',
}

const DEFEND_CRITIC: Rule = {
  any: ['批评', '差评', '退款', '投诉', '维权', '举报', '评测'],
  all: ['黑子', '水军', '带节奏', '收钱', '云玩家', '不配', '滚', '杠精'],
  weight: 0.6,
  reason: '把批评者一律说成黑子',
}

const CONSUMERISM: Rule = {
  any: ['氪金是自愿的', '不氪也能玩', '免费游戏', '公司要赚钱', '不花钱还想白嫖', '白嫖还有理'],
  weight: 0.45,
  reason: '把消费关系说成道德义务',
}

export const cultistPack: Pack = {
  id: 'cultist',
  label: '厂商结晶',
  desc: '为游戏厂商无底线护航、攻击批评者，把消费当成信仰',
  scope: 'both',
  topics: ['原神', '鸣潮', '崩铁', '绝区零', '明日方舟', '游戏', '抽卡', '二游', '策划', '版本更新'],
  rules: [DEFEND, FANBOY_LABEL, CRYSTAL, GAME_ATTACK, ACCUSE, ACCUSE_SOFT, DEFEND_CRITIC, CONSUMERISM],
  guards: [
    '理性讨论',
    '建议',
    '反馈',
    '批评',
    '差评',
    '退款',
    '维权',
    '315',
    '消费者',
    '改进',
    '优化',
    '平衡性',
    '数值',
    'bug',
    '外挂',
    '封号',
    '跑路',
    '抄袭',
  ],
  structural: [
    {
      id: 'cultist-single-game',
      weight: 0.55,
      reason: '投稿高度集中于同一款游戏',
      when: (s) => s.videos >= 5 && s.gameRatio >= 0.7 && s.topGameShare >= 0.5,
    },
    {
      id: 'cultist-monoculture',
      weight: 0.28,
      reason: '八成投稿围绕同一款游戏',
      when: (s) => s.videos >= 8 && s.gameRatio >= 0.85 && s.topGameShare >= 0.8,
    },
    {
      id: 'cultist-game-heavy',
      weight: 0.4,
      reason: '几乎只发游戏内容',
      when: (s) => s.videos >= 8 && s.gameRatio >= 0.5 && s.topGameShare >= 0.35,
    },
    {
      id: 'cultist-cluster',
      weight: 0.35,
      reason: '关注列表里同类账号扎堆',
      when: (s) => (s.clusterFollows.cultist ?? 0) >= 3,
    },
    {
      id: 'cultist-level',
      weight: 0.15,
      reason: '高等级 + 只发一款游戏',
      when: (s) => s.level >= 5 && s.videos >= 10 && s.gameRatio >= 0.8,
    },
  ],
  defaults: {
    standard: { block: 0.7, review: 0.45, minEvidence: 1, soloWeight: 0.95, cascade: 1 },
    aggressive: { block: 0.62, review: 0.4, minEvidence: 1, soloWeight: 0.8, cascade: 2 },
  },
}

/* ------------------------------------------------------------------ */
/* 全商单 UP                                                           */
/* ------------------------------------------------------------------ */

const AD_LINK: Rule = {
  any: AD_DOMAINS,
  weight: 0.7,
  reason: '简介里挂带货链接',
}

const AD_WORD: Rule = {
  any: AD_TERMS,
  weight: 0.3,
  reason: '出现商业推广用语',
}

export const shillPack: Pack = {
  id: 'shill',
  label: '全商单 UP',
  desc: '投稿的绝大多数都是带货、口播广告、返利链接',
  scope: 'author',
  topics: ['好物推荐', '开箱', '测评', '平价', '国货', '优惠券', '数码', '美妆'],
  rules: [AD_LINK, AD_WORD],
  guards: ['维权', '假货', '翻车', '避雷', '智商税', '割韭菜', '退货'],
  structural: [
    {
      id: 'shill-ratio-high',
      weight: 0.82,
      reason: '六成投稿带商业推广',
      when: (s) => s.videos >= 5 && s.adRatio >= 0.6,
    },
    {
      id: 'shill-ratio-mid',
      weight: 0.66,
      reason: '四成投稿带商业推广',
      when: (s) => s.videos >= 5 && s.adRatio >= 0.4,
    },
    {
      id: 'shill-ratio-low',
      weight: 0.42,
      reason: '两成半投稿带商业推广',
      when: (s) => s.videos >= 8 && s.adRatio >= 0.25,
    },
  ],
  defaults: {
    standard: { block: 0.72, review: 0.5, minEvidence: 1, soloWeight: 1, cascade: 0 },
    aggressive: { block: 0.64, review: 0.42, minEvidence: 1, soloWeight: 1, cascade: 0 },
  },
}

/* ------------------------------------------------------------------ */
/* 黑流机器人                                                          */
/* ------------------------------------------------------------------ */

const CONTACT_HARD: Rule = {
  any: ['加微信', '加vx', '加q', '群号', '进群', '粉丝群', '日结', '刷单', '代练', '代充', '货源', '免费领'],
  weight: 0.78,
  reason: '发言里带引流联系方式',
}

const CONTACT_SOFT: Rule = {
  any: CONTACT_TERMS,
  weight: 0.34,
  reason: '带引流话术',
}

const BAIT: Rule = {
  any: [
    '你们不觉得',
    '只有我觉得',
    '说句公道话',
    '客观来说',
    '不是我说',
    '别喷我',
    '我先说',
    '懂的都懂',
    '细思极恐',
    '就这',
    '震惊',
    '结局亮了',
  ],
  weight: 0.18,
  reason: '引战模板话术',
}

const REGION_HATE: Rule = {
  any: ['河南人', '东北人', '上海人', '北京人', '广东人', '广西人', '新疆人', '安徽人', '苏北人', '四川人', '山东人'],
  all: ['骗子', '偷', '穷', '垃圾', '恶心', '没素质', '小气', '野蛮'],
  weight: 0.8,
  reason: '地域歧视',
}

export const botPack: Pack = {
  id: 'bot',
  label: '黑流机器人',
  desc: '引战、刷屏、模板评论、引流小号，以及靠对立吃黑流量的账号',
  scope: 'both',
  topics: ['引战', '热点', '争议', '男女', '地域', '抽奖'],
  rules: [CONTACT_HARD, CONTACT_SOFT, BAIT, REGION_HATE],
  guards: ['举报', '诈骗', '别信', '谨防', '提醒', '辟谣'],
  structural: [
    {
      id: 'bot-templated-strong',
      weight: 0.7,
      reason: '同一段话被多个账号复制',
      when: (s) => s.templated >= 3,
    },
    {
      id: 'bot-templated',
      weight: 0.45,
      reason: '与其他账号发出完全相同的评论',
      when: (s) => s.templated >= 2,
    },
    {
      id: 'bot-empty-account',
      weight: 0.3,
      reason: '零投稿 + 极低粉丝',
      when: (s) => s.videos === 0 && s.fans < 10 && s.level <= 2,
    },
    {
      id: 'bot-default-avatar',
      weight: 0.28,
      reason: '默认头像 + 随机昵称',
      when: (s) => s.defaultFace && s.randomName,
    },
    {
      id: 'bot-contact-sign',
      weight: 0.35,
      reason: '签名里带引流信息',
      when: (s) => s.contactInSign,
    },
    {
      id: 'bot-spray',
      weight: 0.3,
      reason: '到处评论但没有投稿',
      when: (s) => s.comments >= 3 && s.distinctVideos >= 3 && s.videos === 0 && s.fans < 5,
    },
    {
      id: 'bot-follow-farm',
      weight: 0.2,
      reason: '关注数远超粉丝数',
      when: (s) => s.following > 200 && s.fans < 10,
    },
  ],
  defaults: {
    standard: { block: 0.72, review: 0.5, minEvidence: 1, soloWeight: 0.78, cascade: 0 },
    aggressive: { block: 0.62, review: 0.42, minEvidence: 1, soloWeight: 1, cascade: 0 },
  },
}

export const gamePacks: Pack[] = [cultistPack, shillPack, botPack]
