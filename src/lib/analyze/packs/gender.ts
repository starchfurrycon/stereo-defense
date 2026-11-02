import type { Pack, Rule } from './shared'

/**
 * 性别议题的三族。
 *
 * 判定对象是「表达」，不是身份：骂女人的和骂男人的用同一套标准，
 * 只认「以性别给人定罪」的话术。所以 guards 里既有「女拳 / 田园女权」
 * 这类反女权用语，也有「平权 / 家暴 / 性骚扰」这类正经议题词——
 * 讨论受害者权益的人不该被这条规则拉黑。
 */

/* ------------------------------------------------------------------ */
/* 极端女权                                                            */
/* ------------------------------------------------------------------ */

const MISANDRY_LABEL: Rule = {
  any: [
    '国男',
    '普信男',
    '下头男',
    '蝻',
    '屌癌',
    '男凝',
    '男性凝视',
    '男性原罪',
    '男人没一个好东西',
    '男人都该死',
    '男的不行',
    '男的都这样',
    '国男不配',
    '男人配不上',
    '男性劣等',
    '男的是劣等',
    '灭绝男性',
    '男人都是垃圾',
    '男的没一个好东西',
    '婚驴',
    '娇妻',
    '雌竞',
    '男宝妈',
    '割以永治',
    '去父留子',
    '精子库',
    '6b4t',
    '女尊',
    '厌女',
  ],
  none: ['侮辱', '贬低', '歧视', '这个词', '这个说法', '这种说法', '反讽', '反串', '说法', '标签', '不喜欢'],
  weight: 0.88,
  reason: '用性别标签给人定罪',
}

const MALE_DEMEAN: Rule = {
  any: ['男的', '男人', '男性', '男生', '国男'],
  all: ['恶心', '垃圾', '废物', '没用', '不行', '自私', '幼稚', '暴力', '劣等', '不配', '该死', '滚', '蠢', '烦', '没救'],
  weight: 0.5,
  reason: '把男性群体整体贬低',
}

const FEMALE_SUPERIOR: Rule = {
  any: ['女性', '女生', '女人', '女的'],
  all: ['天生', '更优秀', '更高级', '更聪明', '更强', '优越', '进化', '高贵', '才是人'],
  weight: 0.45,
  reason: '主张女性天然优越',
}

const MARRIAGE_DEAL: Rule = {
  any: ['彩礼', '嫁妆', '房车', '工资卡', '上交'],
  all: ['应该', '必须', '理所当然', '凭什么', '不给', '天经地义', '就该'],
  none: ['陋习', '取消', '反对', '废除', '卖女儿', '天价', '过高', '返还', '退还'],
  weight: 0.5,
  reason: '把婚恋当单方面索取',
}

const MALE_ATTACK: Rule = {
  any: ['男的', '男人', '男性'],
  all: ['滚', '去死', '该死', '阉', '杀', '死光', '绝后'],
  weight: 0.68,
  reason: '对男性群体的攻击性表达',
}

export const radfemPack: Pack = {
  id: 'radfem',
  label: '极端女权',
  desc: '以性别给人定罪：国男、普信男、男性原罪一类的仇恨表达',
  scope: 'both',
  topics: ['男女对立', '彩礼', '婚恋', '性别', '女权', '恋爱', '相亲', '情感'],
  rules: [MISANDRY_LABEL, MALE_DEMEAN, FEMALE_SUPERIOR, MARRIAGE_DEAL, MALE_ATTACK],
  guards: [
    '女拳',
    '田园女权',
    '打拳',
    '极端女权',
    '反女权',
    '性别对立',
    '挑动对立',
    '男女对立',
    '平权',
    '性别平等',
    '尊重女性',
    '保护女性',
    '妇女权益',
    '家暴',
    '性骚扰',
    '强奸',
    '受害者',
    '维权',
    '法律',
    '报警',
    '歧视',
    '侮辱',
    '贬低',
  ],
  structural: [
    {
      id: 'radfem-cluster',
      weight: 0.32,
      reason: '关注列表里同类账号扎堆',
      when: (s) => (s.clusterFollows.radfem ?? 0) >= 3,
    },
    {
      id: 'radfem-cluster-strong',
      weight: 0.18,
      reason: '关注列表高度同温层',
      when: (s) => (s.clusterFollows.radfem ?? 0) >= 6,
    },
  ],
  // 极端女权的粉丝结构最同质，默认就开启轻度连坐
  defaults: {
    standard: { block: 0.62, review: 0.38, minEvidence: 1, soloWeight: 0.85, cascade: 1 },
    aggressive: { block: 0.54, review: 0.32, minEvidence: 1, soloWeight: 0.72, cascade: 2 },
  },
}

/* ------------------------------------------------------------------ */
/* 微女权                                                              */
/* ------------------------------------------------------------------ */

const GACHA_GENDER: Rule = {
  any: [
    '缅北二游',
    '缅北手游',
    '缅北游戏',
    '缅北抽卡',
    '一般向二游',
    '二游一般向',
    '不欢迎女玩家',
    '女玩家不配',
    '厂商媚男',
    '给男玩家做游戏',
    '男性向游戏不配',
    '男凝游戏',
    '辱女游戏',
    '女玩家不是人',
    '媚男游戏',
  ],
  weight: 0.8,
  reason: '拿性别立场给游戏定罪',
}

const GENERAL_AUDIENCE: Rule = {
  any: ['一般向'],
  all: ['二游', '游戏', '鸣潮', '原神', '绝区零', '崩铁', '崩坏', '男性向', '男玩家', '女玩家'],
  also: ['凭什么', '不配', '不能', '不该', '硬要', '非要', '还想', '又想', '居然', '收味'],
  window: 40,
  weight: 0.55,
  reason: '把二游强行称作「一般向」来限制男玩家',
}

const WAIFU: Rule = {
  any: ['叫老婆', '喊老婆', '老婆党'],
  all: ['物化', '不尊重', '恶心', '媚男', '收收味', '不允许', '不能', '凭什么'],
  weight: 0.6,
  reason: '不许男玩家代入或称呼角色',
}

const MALE_EMOTION: Rule = {
  any: ['男的', '男人', '男性', '男生'],
  all: ['不够', '不擅长', '天生', '缺乏', '没有', '缺少', '不懂', '不会'],
  also: ['感性', '共情', '细腻', '情绪', '体贴', '浪漫', '恋爱', '情商', '心思', '温柔'],
  window: 34,
  weight: 0.74,
  reason: '把「不懂感情」说成男性天性',
}

/** 「不会共情」是最常见的轻症话术，单独成条。 */
const MALE_EMPATHY: Rule = {
  any: ['不会共情', '没有共情', '缺共情', '不懂共情', '共情能力差', '共情能力为零', '共情不了'],
  all: ['男的', '男人', '男性', '男生', '国男', '直男', '女的', '女生', '女人'],
  window: 34,
  weight: 0.6,
  reason: '把共情能力按性别分配',
}

const MALE_INFERIOR: Rule = {
  any: ['男的', '男人', '男性', '男生'],
  all: ['幼稚', '自私', '粗心', '直男', '不懂', '没长大', '巨婴', '妈宝', '没责任心', '不上进', '冷血', '木讷', '理性动物'],
  weight: 0.45,
  reason: '概括男性的性格缺陷',
}

const FEMALE_VIRTUE: Rule = {
  any: ['女性', '女生', '女人', '女的'],
  all: ['天生', '更懂事', '更优秀', '更成熟', '更细腻', '更清醒', '更独立', '更强大', '付出', '牺牲', '委屈'],
  weight: 0.38,
  reason: '主张女性天然更懂事更付出',
}

const BRIDE_PRICE: Rule = {
  any: ['彩礼', '嫁妆'],
  all: ['应该', '必须', '要给', '得要', '想要', '就要', '凭什么', '不给', '就得'],
  none: ['陋习', '取消', '反对', '过高', '天价', '卖女儿', '返还', '退还', '法律', '判决'],
  window: 40,
  weight: 0.66,
  reason: '把彩礼说成理所当然',
}

/** 「媚男 / 辱女 / 男凝」是这一族最典型的口头禅，单独拎出来。 */
const LECH: Rule = {
  any: ['媚男', '辱女', '男凝'],
  none: ['批评', '反思', '改进', '抵制', '反对'],
  weight: 0.68,
  reason: '用「媚男 / 辱女」给作品定罪',
}

const ALWAYS_RIGHT: Rule = {
  any: [
    '女的永远是对的',
    '女人不会错',
    '女性都是对的',
    '女的永远正确',
    '男人永远是错的',
    '男的永远错',
    '女性不会错',
  ],
  weight: 0.7,
  reason: '把对错直接绑在性别上',
}

const EMOTION_VALUE: Rule = {
  any: ['情绪价值', '共情能力'],
  all: ['男的', '男人', '男性', '国男', '直男'],
  also: ['给不了', '提供不了', '没有', '为0', '为零', '太差', '不行'],
  window: 30,
  weight: 0.55,
  reason: '用「情绪价值」给男性打分',
}

const MALE_GAZE_GAME: Rule = {
  any: ['女角色', '男角色', '卡池', '角色'],
  all: ['媚男', '物化', '男凝', '露肉', '擦边', '不尊重女性', '辱女'],
  weight: 0.5,
  reason: '用性别视角审判游戏角色',
}

const PATRIARCHY_TONE: Rule = {
  any: ['爹味', '说教', '普信', '下头'],
  all: ['男的', '男人', '男性', '国男', '直男'],
  weight: 0.42,
  reason: '给男性贴贬义标签',
}

export const softfemPack: Pack = {
  id: 'softfem',
  label: '微女权',
  desc: '轻症版本：男性天然不会共情 / 不懂恋爱，女性永远正确，把男性向二游说成缅北',
  scope: 'both',
  topics: ['二游', '鸣潮', '原神', '绝区零', '一般向', '男女', '彩礼', '恋爱', '情感', '女玩家'],
  rules: [
    GACHA_GENDER,
    LECH,
    GENERAL_AUDIENCE,
    WAIFU,
    MALE_EMOTION,
    MALE_EMPATHY,
    MALE_INFERIOR,
    FEMALE_VIRTUE,
    BRIDE_PRICE,
    ALWAYS_RIGHT,
    EMOTION_VALUE,
    MALE_GAZE_GAME,
    PATRIARCHY_TONE,
  ],
  guards: [
    '女拳',
    '打拳',
    '田园女权',
    '极端女权',
    '性别对立',
    '挑动对立',
    '男女对立',
    '平权',
    '性别平等',
    '尊重',
    '互相理解',
    '我家',
    '我老公',
    '我男朋友',
    '我先生',
    '我老婆',
    '我对象',
    '个人经历',
    '主观',
    '他说',
    '她说',
    '有人说',
    '这话',
    '这种说法',
  ],
  structural: [
    {
      id: 'softfem-cluster',
      weight: 0.22,
      reason: '关注列表里同类账号扎堆',
      when: (s) => (s.clusterFollows.softfem ?? 0) >= 4,
    },
  ],
  defaults: {
    standard: { block: 0.72, review: 0.46, minEvidence: 1, soloWeight: 0.78, cascade: 0 },
    aggressive: { block: 0.66, review: 0.4, minEvidence: 1, soloWeight: 0.8, cascade: 1 },
  },
}

/* ------------------------------------------------------------------ */
/* LGBT 互喷                                                           */
/* ------------------------------------------------------------------ */

const HOMOPHOBIC_ATTACK: Rule = {
  any: ['同性恋', '男同', '女同', 'gay', 'les', '通讯录', '跨性别', '跨子', 'lgbt', '彩虹', '出柜', '药娘', '性少数', '同性'],
  all: ['恶心', '变态', '有病', '病态', '该死', '去死', '滚', '垃圾', '肮脏', '毒瘤', '精神病', '不正常', '传染', '绝症'],
  weight: 0.78,
  reason: '针对性少数的攻击',
}

const SLUR: Rule = {
  any: ['死基佬', '基佬', '人妖', '娘娘腔', '死变态', '同性恋都该死', '男同都', '治治'],
  none: ['不要', '别', '反对', '不该', '侮辱', '歧视'],
  weight: 0.85,
  reason: '性少数侮辱性称呼',
}

const STRAIGHT_HUNT: Rule = {
  any: ['顺直', '直男', '直女', '异性恋', '直人'],
  all: ['恶心', '垃圾', '该死', '癌', '蠢', '劣等', '滚', '灭绝', '有病', '原罪'],
  weight: 0.78,
  reason: '对异性恋的攻击',
}

const TRANS_ATTACK: Rule = {
  any: ['跨性别', '药娘', '伪娘', '人妖', 'mtf', 'ftm'],
  all: ['变态', '恶心', '该死', '精神病', '不男不女', '割', '欺骗'],
  weight: 0.8,
  reason: '针对性别的攻击',
}

const WITCH_HUNT: Rule = {
  any: ['恐同', '崆峒', '恐跨', '顺直'],
  all: ['该死', '垃圾', '去死', '滚', '不配', '罪', '恶心'],
  weight: 0.7,
  reason: '以立场为名的猎巫',
}

const FORCE_POSITION: Rule = {
  any: ['不转不是中国人', '不支持就是恐同', '不支持就是歧视', '支持就是'],
  weight: 0.45,
  reason: '逼人站队',
}

export const lgbtPack: Pack = {
  id: 'lgbt',
  label: 'LGBT 互喷',
  desc: '性少数议题里的攻击性表达，双向判定：恐同辱骂与顺直猎巫都算',
  scope: 'both',
  topics: ['LGBT', '同性恋', '跨性别', '彩虹', '平权', '性别认同'],
  rules: [HOMOPHOBIC_ATTACK, SLUR, STRAIGHT_HUNT, TRANS_ATTACK, WITCH_HUNT, FORCE_POSITION],
  guards: [
    '尊重',
    '平权',
    '科普',
    '医学',
    '心理',
    '去病化',
    '歧视',
    '反对歧视',
    '保护',
    '权益',
    '法律',
    '研究',
    '数据',
    '报道',
    '理解',
    '包容',
    '心理健康',
    '性取向',
  ],
  structural: [
    {
      id: 'lgbt-cluster',
      weight: 0.26,
      reason: '关注列表里同类账号扎堆',
      when: (s) => (s.clusterFollows.lgbt ?? 0) >= 3,
    },
  ],
  defaults: {
    standard: { block: 0.66, review: 0.42, minEvidence: 1, soloWeight: 0.76, cascade: 1 },
    aggressive: { block: 0.58, review: 0.36, minEvidence: 1, soloWeight: 0.7, cascade: 2 },
  },
}

export const genderPacks: Pack[] = [radfemPack, softfemPack, lgbtPack]
