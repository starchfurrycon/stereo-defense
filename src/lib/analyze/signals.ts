import type { FamilyId } from './families'

/**
 * 账号结构信号。
 *
 * 文本判定有个天花板：结晶、机器人、时政号、商单号，光看一条发言是判不出来的。
 * 「你说不玩就滚」和「这游戏确实该改」在字面上都只是评价，
 * 真正区分它们的是这个账号发了什么、关注了谁、粉丝是谁。
 */
export interface AccountSignals {
  level: number
  fans: number
  following: number
  /** 注册时间（秒），0 表示未知 */
  regtime: number
  /** 账号年龄（天） */
  ageDays: number
  /** 投稿数 */
  videos: number
  /** 本次采集到的动态数 */
  dynamics: number
  /** 本次采集到的评论数 */
  comments: number
  /** 出现在多少个不同视频的评论区 */
  distinctVideos: number
  /** 同一条评论被多少个不同账号复制（模板水军） */
  templated: number
  /** 默认头像 */
  defaultFace: boolean
  /** 昵称像随机串 */
  randomName: boolean
  /** 签名里带联系方式或引流 */
  contactInSign: boolean
  /** 投稿中带商业推广的比例 */
  adRatio: number
  /** 投稿涉及时政的比例 */
  politicsRatio: number
  /** 投稿涉及游戏的比例 */
  gameRatio: number
  /** 单一游戏占全部投稿的最大占比 */
  topGameShare: number
  /** 出现最多的分区 */
  partitionTop: string
  /** 是否机构 / 官方认证 */
  verified: boolean
  /** 关注列表里各类目标账号的数量 */
  clusterFollows: Partial<Record<FamilyId, number>>
}

export function emptySignals(): AccountSignals {
  return {
    level: 0,
    fans: 0,
    following: 0,
    regtime: 0,
    ageDays: -1,
    videos: 0,
    dynamics: 0,
    comments: 0,
    distinctVideos: 0,
    templated: 0,
    defaultFace: false,
    randomName: false,
    contactInSign: false,
    adRatio: 0,
    politicsRatio: 0,
    gameRatio: 0,
    topGameShare: 0,
    partitionTop: '',
    verified: false,
    clusterFollows: {},
  }
}

/* ------------------------------------------------------------------ */
/* 词表                                                                */
/* ------------------------------------------------------------------ */

export const GAME_TITLES: string[] = [
  '原神',
  '崩坏',
  '星穹铁道',
  '崩铁',
  '绝区零',
  '鸣潮',
  '库洛',
  '战双',
  '明日方舟',
  '鹰角',
  '碧蓝航线',
  '少女前线',
  '蔚蓝档案',
  '公主连结',
  '尘白禁区',
  '幻塔',
  '无限暖暖',
  '恋与深空',
  '光与夜之恋',
  '未定事件簿',
  '如鸢',
  '王者荣耀',
  '和平精英',
  '三角洲行动',
  '英雄联盟',
  '瓦罗兰特',
  '无畏契约',
  '永劫无间',
  '第五人格',
  '光遇',
  '黑神话',
  '燕云十六声',
  '逆水寒',
  '剑网3',
  '魔兽世界',
  '炉石传说',
  '最终幻想',
  '宝可梦',
  '塞尔达',
  '艾尔登法环',
  '我的世界',
  '泰拉瑞亚',
  '蛋仔派对',
  '元梦之星',
  '塔科夫',
  '命运方舟',
  '燕云',
  '无限机兵',
  '绝地潜兵',
  '地平线',
]

export const POLITICS_TERMS: string[] = [
  '美国',
  '中国',
  '俄罗斯',
  '俄乌',
  '乌克兰',
  '以色列',
  '巴勒斯坦',
  '哈马斯',
  '伊朗',
  '朝鲜',
  '韩国',
  '日本',
  '台湾',
  '台海',
  '南海',
  '欧洲',
  '欧盟',
  '北约',
  '联合国',
  '中东',
  '叙利亚',
  '阿富汗',
  '印度',
  '巴基斯坦',
  '菲律宾',
  '越南',
  '缅甸',
  '泰国',
  '选举',
  '总统',
  '首相',
  '议会',
  '政府',
  '外交',
  '制裁',
  '关税',
  '战争',
  '冲突',
  '军事',
  '导弹',
  '航母',
  '局势',
  '政变',
  '抗议',
  '游行',
  '法案',
  '政策',
  '改革',
  '反腐',
  '纪委',
  '市委',
  '省委',
  '国务院',
  '白宫',
  '国会',
  '五角大楼',
  '克里姆林宫',
  '泽连斯基',
  '普京',
  '特朗普',
  '拜登',
  '内塔尼亚胡',
  '时政',
  '国际',
  '地缘',
  '霸权',
  '冷战',
]

export const AD_TERMS: string[] = [
  '优惠券',
  '领券',
  '下单',
  '购物车',
  '带货',
  '商务合作',
  '商务联系',
  '品牌方',
  '本期视频由',
  '本视频由',
  '赞助',
  '广告',
  '恰饭',
  '佣金',
  '返利',
  '福利价',
  '全网最低',
  '点击购买',
  '小黄车',
  '淘宝',
  '天猫',
  '京东',
  '拼多多',
  '抖音',
  '团购',
  '秒杀',
  '折扣',
  '链接在',
  '简介有',
  '置顶评论',
  '同款',
  '旗舰店',
  '专营店',
  '预售',
  '定金',
  '满减',
  '报备',
  '商单',
]

export const AD_DOMAINS: string[] = [
  's.click.taobao.com',
  'item.taobao.com',
  'u.jd.com',
  '3.cn',
  'mobile.yangkeduo.com',
  'm.tb.cn',
  'pinduoduo.com',
  'tmall.com',
  'taobao.com',
  'jd.com',
  'youzan.com',
  'weidian.com',
  'xiaohongshu.com',
  'douyin.com',
]

export const CONTACT_TERMS: string[] = [
  '加微信',
  '加v',
  '加vx',
  'vx',
  '加q',
  '企鹅',
  '私信',
  '看主页',
  '主页有',
  '粉丝群',
  '进群',
  '群号',
  '免费领',
  '日结',
  '兼职',
  '刷单',
  '代练',
  '代充',
  '回收',
  '货源',
  '代理',
  '引流',
]

/* ------------------------------------------------------------------ */
/* 计算                                                                */
/* ------------------------------------------------------------------ */

function ratioOf(texts: string[], terms: string[]): number {
  if (!texts.length) return 0
  let hit = 0
  for (const text of texts) {
    if (terms.some((t) => text.includes(t))) hit++
  }
  return hit / texts.length
}

/** 单游戏集中度：最大的一类游戏占全部投稿的比例。 */
export function topGameShare(texts: string[]): number {
  if (!texts.length) return 0
  const counts = new Map<string, number>()
  let covered = 0
  for (const text of texts) {
    let best = ''
    for (const g of GAME_TITLES) {
      if (text.includes(g) && g.length > best.length) best = g
    }
    if (!best) continue
    covered++
    counts.set(best, (counts.get(best) ?? 0) + 1)
  }
  if (!covered) return 0
  let max = 0
  for (const n of counts.values()) max = Math.max(max, n)
  return max / texts.length
}

export function computeTextRatios(texts: string[]): {
  adRatio: number
  politicsRatio: number
  gameRatio: number
  topGameShare: number
} {
  return {
    adRatio: Math.max(ratioOf(texts, AD_TERMS), ratioOf(texts, AD_DOMAINS)),
    politicsRatio: ratioOf(texts, POLITICS_TERMS),
    gameRatio: ratioOf(texts, GAME_TITLES),
    topGameShare: topGameShare(texts),
  }
}

/** 默认头像：B 站未设置头像时返回 noface 图。 */
export function isDefaultFace(face: string): boolean {
  if (!face) return true
  return /noface|face\/member\/noface|static\.hdslb\.com\/bfs\/face\/user_avatar/i.test(face)
}

/**
 * 随机昵称：结尾一长串数字、纯字母数字混排、或「用户 + 数字」。
 * 正常昵称很少连续出现 5 位以上数字。
 */
export function looksRandomName(name: string): boolean {
  if (!name) return true
  const trimmed = name.trim()
  if (/^用户\d{5,}$/.test(trimmed)) return true
  if (/\d{5,}$/.test(trimmed)) return true
  if (/^[a-z0-9_]{10,}$/i.test(trimmed)) return true
  if (/^(?=.*[a-z])(?=.*\d)[a-z0-9]{8,}$/i.test(trimmed)) return true
  return false
}

export function signHasContact(sign: string): boolean {
  if (!sign) return false
  const lower = sign.toLowerCase()
  return CONTACT_TERMS.some((t) => lower.includes(t))
}

export function ageInDays(regtime: number): number {
  if (!regtime) return -1
  return Math.max(0, Math.floor((Date.now() / 1000 - regtime) / 86400))
}
