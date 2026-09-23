/**
 * 立场词库。
 *
 * 设计要点：
 * - 分族（family）：每个族描述一种被抵制的立场或内容类型，族之间可叠加。
 * - 分层权重：strong / mid / weak，避免单个弱信号直接定性。
 * - guards（反驳语境词）：与标记词相邻出现时大幅降权，这是防止误伤
 *   「批判者 / 科普者 / 时政评论者」的核心机制。例如国际时事 UP 会在
 *   视频里大量出现「台独」二字，但语境是揭露与批判。
 * - 归一化匹配：去掉空白与符号后再匹配，可抵御「台 独」「台*独」这类规避写法。
 */

export type Tier = 'strong' | 'mid' | 'weak'

export const TIER_WEIGHT: Record<Tier, number> = { strong: 1, mid: 0.58, weak: 0.28 }

export interface LexEntry {
  term: string
  tier: Tier
}

export interface LexFamily {
  id: string
  label: string
  /** 该族常见内容分区/领域，用于检索，不用于定性 */
  topics: string[]
  markers: LexEntry[]
  /** 反驳 / 批判 / 学术语境标记 */
  guards: string[]
  /** 语义锚点样例，用于把用户原话映射到本族 */
  exemplars: string[]
}

const e = (tier: Tier, ...terms: string[]): LexEntry[] => terms.map((term) => ({ term, tier }))

/** 通用反驳语境词，所有族共享。 */
export const GLOBAL_GUARDS: string[] = [
  '反对',
  '坚决反对',
  '强烈谴责',
  '谴责',
  '批判',
  '驳斥',
  '揭穿',
  '揭露',
  '曝光',
  '警惕',
  '防范',
  '抵制',
  '打击',
  '严惩',
  '依法',
  '违法',
  '错误',
  '荒谬',
  '无知',
  '可笑',
  '拙劣',
  '谎言',
  '谣言',
  '辟谣',
  '事实是',
  '真相',
  '并不是',
  '不是',
  '所谓',
  '打着',
  '妄图',
  '企图',
  '数典忘祖',
  '卖国',
  '汉奸',
  '分裂',
  '危害',
  '损害',
  '挑衅',
  '闹剧',
  '打脸',
  '翻车',
  '清醒',
  '别被',
  '不要被',
  '认贼作父',
  '吃里扒外',
  '端起碗吃饭',
  '端起碗吃肉',
]

export const FAMILIES: LexFamily[] = [
  {
    id: 'separatism',
    label: '分裂主张',
    topics: ['台湾', '台海', '两岸', '香港', '新疆', '西藏', '统一'],
    markers: [
      ...e(
        'strong',
        '台湾是一个国家',
        '台湾国',
        '台湾共和国',
        '一边一国',
        '两国论',
        '一中一台',
        '台湾独立',
        '台独',
        '台湾主权独立',
        '台湾人不是中国人',
        '中华民国台湾',
        '台湾地位未定论',
        '西藏独立',
        '藏独',
        '新疆独立',
        '东突厥斯坦',
        '香港独立',
        '港独',
        '光复香港',
        '时代革命',
        '为台湾而战',
        '抗中保台',
        '台湾共和国万岁',
      ),
      ...e(
        'mid',
        '台湾的民主',
        '天然独',
        '芒果干',
        '亡国感',
        '台湾建国',
        '美台建交',
        '台湾加入联合国',
        '承认台湾',
        '台美关系正常化',
        '台湾护照',
        '我国台湾地区领导人',
      ),
      // 「台独」是标签词而非主张词，大陆语境下绝大多数出现在批判里，
      // 因此降为 weak，并由 guards + 语义比对共同抑制误伤。
      ...e('weak', '台独', '两岸', '统独', '本土政权', '外来政权', '日治时期', '终战', '台湾主体性', '去中国化'),
    ],
    guards: [
      '台独分裂势力',
      '台独分子',
      '台独当局',
      '台独势力',
      '台独是死路',
      '民进党当局',
      '分裂国家',
      '反分裂国家法',
      '祖国统一',
      '九二共识',
      '一国两制',
      '统一大势',
      '数典忘祖',
    ],
    exemplars: [
      '台湾是一个主权独立的国家，台湾人不是中国人',
      '支持台湾独立，一边一国，抗中保台',
      '香港应该独立，光复香港时代革命',
    ],
  },
  {
    id: 'sycophancy',
    label: '崇洋媚外 / 自我否定',
    topics: ['国外', '留学', '移民', '美国', '欧洲', '日本', '中西对比', '社会现象'],
    markers: [
      // 标记词只收录「目标自己会说出口」的话术。
      // 「殖人 / 殖味 / 公知 / 慕洋犬」这类是批评者的用词，收录会造成反向误伤，故一律放入 guards。
      ...e(
        'strong',
        '外国空气香甜',
        '美国的空气都是甜的',
        '中国药丸',
        '你国',
        '贵国',
        '这国怎',
        '定体问',
        '我陷思',
        '太平洋没加盖',
        '跪久了站不起来',
        '洋大人',
        '文明世界',
        '自由世界的灯塔',
        '灯塔国',
        '支性',
        '支性难改',
        '支人',
        '洼地',
        '索多玛',
        '盐碱地',
        '劣等民族',
        '中国人是劣等',
        '华夏劣根性',
        '中国人没有一个是无辜的',
        '润出去才是人',
        '中国没有一个是好东西',
        '中国人不配拥有',
        '外国人的素质就是高',
        '这就是中国',
        '厉害国',
        '厉害了我的国',
        '体制问题',
        '你国人民',
        '支那',
      ),
      ...e(
        'mid',
        '劣根性',
        '国民性',
        '中国人就这样',
        '国人素质',
        '奴性',
        '被洗脑',
        '韭菜国',
        '小粉红',
        '战狼外交',
        '爱国贼',
        '义和团',
        'U型锁',
        '夹头',
        '粉红',
        '大国崛起小民尊严',
        '我不在乎大国崛起',
        '月薪三千',
        '赢麻了',
        '赢国',
        '墙国',
        '墙内',
        '简中',
        '简体中文互联网',
        '河殇',
        '跪族',
      ),
      ...e(
        'weak',
        '国外就是好',
        '国内比不了',
        '出国才知道',
        '外国的月亮',
        '普世价值',
        '民主自由',
        '润了',
        '移民',
        '反思',
      ),
    ],
    guards: [
      '崇洋媚外',
      '数典忘祖',
      '文化自信',
      '民族自信',
      '理性看待',
      '客观对比',
      '不能妄自菲薄',
      '不能盲目',
      '我们的差距',
      '差距在哪',
      '值得学习',
      '技术差距',
      '殖人',
      '殖味',
      '慕洋犬',
      '洋奴',
      '公知',
      '带路党',
      '跪舔',
      '洗地',
      '双标',
      '反贼',
      '恨国党',
      '精美',
      '精日',
      '反思怪',
    ],
    exemplars: [
      '外国的空气都是香甜的，中国就是洼地，中国人有劣根性',
      '这国怎，定体问，我陷思，中国药丸，润出去才是人',
      '中国人就是奴性重，被洗脑，小粉红战狼爱国贼',
      '外国人的素质就是高，中国人不配拥有这些',
    ],
  },
  {
    id: 'history-nihilism',
    label: '历史虚无',
    topics: ['历史', '抗战', '朝鲜战争', '近代史', '英雄'],
    markers: [
      ...e(
        'strong',
        '抗美援朝是侵略',
        '邱少云是假的',
        '黄继光是假的',
        '雷锋是假的',
        '董存瑞是假的',
        '狼牙山五壮士是假的',
        '南京大屠杀是编的',
        '南京大屠杀不存在',
        '慰安妇是自愿的',
        '日本侵华是帮助中国',
        '大东亚共荣圈是好的',
        '汪精卫是英雄',
        '蒋介石是民族救星',
        '中共不抗日',
      ),
      ...e('mid', '抗日神剧', '历史是胜利者写的', '洗脑教育', '教科书骗人', '美化侵略', '参拜靖国神社是传统'),
      ...e('weak', '重新审视历史', '另一种说法', '鲜为人知的一面'),
    ],
    guards: ['历史虚无主义', '歪曲历史', '篡改历史', '侮辱英烈', '英烈保护法', '尊重历史', '铁证如山', '不容置疑'],
    exemplars: ['抗美援朝就是侵略，邱少云黄继光都是假的，历史是胜利者写的'],
  },
  {
    id: 'vulgar',
    label: '低俗 / 软色情',
    topics: ['舞蹈', '生活', '穿搭', '二次元'],
    markers: [
      ...e('strong', '福利视频', '擦边', '软色情', '约炮', '有偿陪侍', '原味'),
      ...e('mid', '懂的都懂', '私信我', '加微信', '主页简介', '深夜福利', '未成年'),
      ...e('weak', '性感', '福利姬', '写真'),
    ],
    guards: ['举报', '违法', '不良信息', '净网'],
    exemplars: ['擦边软色情引流，主页简介加微信'],
  },
  {
    id: 'fraud',
    label: '诈骗 / 引流',
    topics: ['理财', '副业', '兼职', '投资'],
    markers: [
      ...e('strong', '稳赚不赔', '保本保收益', '内部渠道', '带你上车', '日入过万', '躺赚'),
      ...e('mid', '加群领取', '私信领取', '限时免费', '名额有限', '币圈', '带单'),
      ...e('weak', '副业', '被动收入', '财富自由'),
    ],
    guards: ['诈骗', '骗局', '割韭菜', '报警', '别信', '谨防'],
    exemplars: ['带你上车稳赚不赔，加群领取内部渠道名额有限'],
  },
  {
    id: 'abuse',
    label: '人身攻击 / 网暴',
    topics: [],
    markers: [
      ...e('strong', '去死', '死全家', '你妈死了', 'nmsl', '人肉你', '开盒', '杀你'),
      ...e('mid', '废物', '脑残', '弱智', '傻逼', '智障', '狗东西', '蛆'),
      ...e('weak', '滚出', '不配', '恶心'),
    ],
    guards: ['举报', '人身攻击', '网络暴力', '理性讨论', '文明发言'],
    exemplars: ['去死吧，nmsl，我开盒你'],
  },
]

/* ------------------------------------------------------------------ */
/* 归一化与匹配                                                        */
/* ------------------------------------------------------------------ */

const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/
const ALNUM = /[0-9a-z]/

/** 去掉一切非中英文数字字符，统一大小写，抵御空格/符号规避。 */
export function normalize(input: string): string {
  const lower = input.normalize('NFKC').toLowerCase()
  let out = ''
  for (const ch of lower) {
    if (CJK.test(ch) || ALNUM.test(ch)) out += ch
  }
  return out
}

export interface MarkerHit {
  term: string
  tier: Tier
  weight: number
  /** 命中位置附近存在反驳语境 */
  guarded: boolean
  index: number
}

export interface LexResult {
  hits: MarkerHit[]
  guards: string[]
  /** 有效权重和 */
  weight: number
  /** 0..1 归一化后的词表信号 */
  lexical: number
}

const GUARD_WINDOW = 16

/**
 * 在文本中查找标记词，并对每个命中判断是否处于反驳语境。
 * `extraMarkers` 允许注入 LLM 生成的额外标记。
 */
export function matchLexicon(
  text: string,
  families: LexFamily[],
  extraMarkers: string[] = [],
  extraGuards: string[] = [],
): LexResult {
  const raw = text.normalize('NFKC').toLowerCase()
  const norm = normalize(text)
  const guards = [...new Set([...GLOBAL_GUARDS, ...families.flatMap((f) => f.guards), ...extraGuards])]

  // 建立归一化文本到原始文本的索引映射，用于取语境窗口
  const indexMap: number[] = []
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]
    if (CJK.test(ch) || ALNUM.test(ch)) indexMap.push(i)
  }

  const hits: MarkerHit[] = []
  const seen = new Set<string>()

  const collect = (entries: LexEntry[]) => {
    for (const entry of entries) {
      const needle = normalize(entry.term)
      if (needle.length < 2) continue
      let from = 0
      for (;;) {
        const at = norm.indexOf(needle, from)
        if (at < 0) break
        const key = `${entry.term}@${at}`
        if (!seen.has(key)) {
          seen.add(key)
          const rawStart = indexMap[at] ?? 0
          const rawEnd = (indexMap[at + needle.length - 1] ?? rawStart) + 1
          const window = raw.slice(Math.max(0, rawStart - GUARD_WINDOW), rawEnd + GUARD_WINDOW)
          const guarded = guards.some((g) => window.includes(g.toLowerCase()))
          hits.push({ term: entry.term, tier: entry.tier, weight: TIER_WEIGHT[entry.tier], guarded, index: at })
        }
        from = at + needle.length
      }
    }
  }

  collect(families.flatMap((f) => f.markers))
  for (const term of extraMarkers) collect([{ term, tier: 'mid' }])

  const guardHits = guards.filter((g) => raw.includes(g.toLowerCase()))

  let weight = 0
  for (const hit of hits) weight += hit.guarded ? hit.weight * 0.12 : hit.weight

  return { hits, guards: guardHits, weight, lexical: 0 }
}

/** 把权重和映射到 0..1。3 个 strong 命中即接近饱和。 */
export function weightToScore(weight: number): number {
  return 1 - Math.exp(-weight / 1.6)
}
