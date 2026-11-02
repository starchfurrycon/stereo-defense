import type { Pack, Rule } from './shared'

/**
 * 殖人 / 汉奸。
 *
 * 这一族最容易误伤：做国际时事的 UP 会满口「台独」「美国」，
 * 但语境是揭露与批判。所以真正的标记词只收「自恨式表达」和「主张句」，
 * 批评者用来骂人的词（殖人、慕洋犬、公知）全部放进 guards。
 */

const SELF_HATE: Rule = {
  any: [
    '支性',
    '支性难改',
    '支人',
    '支那',
    '洼地',
    '索多玛',
    '盐碱地',
    '劣等民族',
    '华夏劣根性',
    '中国人的劣根性',
    '中国人不配',
    '中国人没救',
    '你国',
    '贵国',
    '定体问',
    '我陷思',
    '这国怎',
    '中国药丸',
    '太平洋没加盖',
    '外国空气香甜',
    '美国的空气',
    '润出去才是人',
    '文明世界',
    '灯塔国',
    '自由世界的灯塔',
    '洋大人',
    '支味',
    '东亚病夫',
  ],
  none: ['价格', '房价', '价值洼地', '经济洼地'],
  weight: 0.95,
  reason: '自恨式贬低本国',
}

const SPLIT: Rule = {
  any: [
    '台湾国',
    '一边一国',
    '两国论',
    '一中一台',
    '台湾独立',
    '台独',
    '港独',
    '光复香港',
    '时代革命',
    '东突厥斯坦',
    '西藏独立',
    '抗中保台',
    '台湾人不是中国人',
    '台湾主权独立',
    '中华民国台湾',
    '台湾加入联合国',
    '台湾建国',
  ],
  none: ['台独分子', '台独势力', '台独当局', '反对台独', '反台独', '台独是死路', '民进党', '分裂国家', '祖国统一'],
  weight: 0.92,
  reason: '主张分裂',
}

const HISTORY: Rule = {
  any: ['南京大屠杀', '抗美援朝', '邱少云', '黄继光', '雷锋', '狼牙山五壮士', '慰安妇', '汪精卫', '日本侵华', '大东亚共荣圈'],
  all: ['是假的', '不存在', '编的', '伪造', '自导自演', '自愿的', '是英雄', '是帮助', '共荣', '没发生过'],
  weight: 0.9,
  reason: '为侵略或屠杀翻案',
}

const ROOTS: Rule = {
  any: ['劣根性', '国民性', '奴性', '民智未开', '劣根'],
  all: ['中国人', '国人', '民族', '东亚'],
  none: ['批判', '反思', '克服', '警惕', '改造'],
  weight: 0.7,
  reason: '把国民性说成种族缺陷',
}

const REGIME: Rule = {
  any: ['体制问题', '专制', '独裁', '一党专政', '没有言论自由', '没有新闻自由', '没有自由'],
  all: ['中国', '国内', '你国', '这国'],
  weight: 0.55,
  reason: '借个案否定整体制度',
}

const RUN: Rule = {
  any: ['润了', '润出去', '润走', 'run了'],
  all: ['移民', '国外', '发达国家', '欧洲', '美国', '日本', '加拿大', '澳洲'],
  weight: 0.5,
  reason: '把出国当成唯一出路',
}

const WORSHIP: Rule = {
  any: ['外国', '国外', '欧美', '日本人', '美国人', '白人'],
  all: ['素质', '文明', '先进', '人性化', '有礼貌', '有秩序', '干净'],
  none: ['差距', '学习', '借鉴', '客观', '也有', '某些'],
  weight: 0.42,
  reason: '把外国笼统说成更文明',
}

const CURSE_NATION: Rule = {
  any: ['中国人', '国人', '国内'],
  all: ['没救', '不配', '垃圾', '劣等', '恶心', '无药可救', '烂透', '没素质'],
  none: ['部分', '有些', '个别'],
  weight: 0.75,
  reason: '整体性地辱骂同胞',
}

export const traitorPack: Pack = {
  id: 'traitor',
  label: '殖人 · 汉奸',
  desc: '自恨式贬低本国、吹捧外国，或主张分裂、为侵略与屠杀翻案',
  scope: 'both',
  topics: ['美国', '日本', '移民', '留学', '中西对比', '台湾', '香港', '近代史', '国际时事', '社会现象'],
  rules: [SELF_HATE, SPLIT, HISTORY, ROOTS, REGIME, RUN, WORSHIP, CURSE_NATION],
  guards: [
    '殖人',
    '殖味',
    '慕洋犬',
    '洋奴',
    '公知',
    '带路党',
    '跪舔',
    '恨国党',
    '精美',
    '精日',
    '崇洋媚外',
    '数典忘祖',
    '文化自信',
    '民族自信',
    '理性看待',
    '客观对比',
    '不能妄自菲薄',
    '差距',
    '值得学习',
    '技术差距',
    '反贼',
    '反思怪',
    '美分',
    '日杂',
    '台独分子',
    '台独势力',
    '台独当局',
    '反对台独',
    '反分裂国家法',
    '台湾是中国',
    '祖国统一',
    '九二共识',
    '一国两制',
    '分裂国家',
    '英烈保护法',
    '歪曲历史',
    '篡改历史',
    '侮辱英烈',
    '历史虚无主义',
    '尊重历史',
    '铁证如山',
  ],
  structural: [],
  defaults: {
    standard: { block: 0.68, review: 0.42, minEvidence: 2, soloWeight: 0.9, cascade: 1 },
    aggressive: { block: 0.6, review: 0.36, minEvidence: 1, soloWeight: 0.85, cascade: 2 },
  },
}

/**
 * 时政号。
 *
 * 用户要的是「别给我推时政内容」，而不是「在时政视频下说句话就拉黑」。
 * 所以这一族只在作者层判定，依据是投稿里时政题材的密度，
 * 评论区路人永远不会被这一族拉黑。
 */
export const politicsPack: Pack = {
  id: 'politics',
  label: '时政号',
  desc: '投稿几乎全是时政话题的账号。只判定作者，不判定评论区路人',
  scope: 'author',
  topics: ['时政', '国际', '军事', '俄乌', '中东', '台海', '美国大选', '经济形势'],
  rules: [
    {
      any: [
        '拜登',
        '特朗普',
        '普京',
        '泽连斯基',
        '内塔尼亚胡',
        '白宫',
        '五角大楼',
        '克里姆林宫',
        '台海',
        '南海',
        '俄乌',
        '巴以',
        '中东局势',
      ],
      all: ['局势', '冲突', '战争', '制裁', '谈判', '峰会', '政府', '军队', '战略', '外交'],
      weight: 0.32,
      reason: '标题是国际时政',
    },
  ],
  guards: [],
  structural: [
    {
      id: 'politics-density-high',
      weight: 0.9,
      reason: '投稿八成为时政题材',
      when: (s) => s.videos >= 5 && s.politicsRatio >= 0.8,
    },
    {
      id: 'politics-density-mid',
      weight: 0.74,
      reason: '投稿六成为时政题材',
      when: (s) => s.videos >= 5 && s.politicsRatio >= 0.6,
    },
    {
      id: 'politics-density-low',
      weight: 0.62,
      reason: '过半投稿涉时政',
      when: (s) => s.videos >= 6 && s.politicsRatio >= 0.5,
    },
    {
      id: 'politics-density-trace',
      weight: 0.42,
      reason: '四成投稿涉时政',
      when: (s) => s.videos >= 6 && s.politicsRatio >= 0.4,
    },
    {
      id: 'politics-density-hint',
      weight: 0.26,
      reason: '三成投稿涉时政',
      when: (s) => s.videos >= 8 && s.politicsRatio >= 0.25,
    },
    {
      id: 'politics-partition',
      weight: 0.18,
      reason: '常驻新闻资讯分区',
      when: (s) =>
        s.videos >= 5 &&
        /新闻|时事|热点|资讯|社科|军事|国际/.test(s.partitionTop) &&
        s.politicsRatio >= 0.5,
    },
  ],
  defaults: {
    standard: { block: 0.72, review: 0.5, minEvidence: 1, soloWeight: 1, cascade: 0 },
    aggressive: { block: 0.62, review: 0.4, minEvidence: 1, soloWeight: 1, cascade: 0 },
  },
}

export const ideologyPacks: Pack[] = [traitorPack, politicsPack]
