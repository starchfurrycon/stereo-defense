import { judgeText } from './analyze/calibrate'
import { buildReflex } from './reflex'
import type { Candidate, FamilyId, Targets } from './types'

/**
 * 演示数据。
 *
 * 用真实样本走一遍完整的判定链路，让没登录的人也能看到界面长什么样，
 * 也让冒烟测试有东西可渲染。所有账号都是编的。
 */
interface DemoSeed {
  mid: number
  uname: string
  fans: number
  level: number
  sign: string
  text: string
  relation: Candidate['relation']
  via?: { mid: number; uname: string; family: FamilyId }
}

const SEEDS: DemoSeed[] = [
  {
    mid: 900001,
    uname: '文明世界观察员',
    fans: 128000,
    level: 6,
    sign: '记录真实的世界',
    text: '这国怎，定体问，我陷思，中国药丸',
    relation: 'author',
  },
  {
    mid: 900002,
    uname: '今天也在崩铁',
    fans: 4200,
    level: 5,
    sign: '米哈游十年老玩家',
    text: '你不玩就滚，白嫖还有理了',
    relation: 'commenter',
  },
  {
    mid: 900003,
    uname: '清醒的姐姐',
    fans: 8600,
    level: 6,
    sign: '女性主义者 / 不婚不育',
    text: '国男真的不配，普信男太多了',
    relation: 'author',
  },
  {
    mid: 900004,
    uname: '理性讨论bot',
    fans: 120,
    level: 2,
    sign: '',
    text: '加微信领取福利，日结兼职',
    relation: 'commenter',
  },
  {
    mid: 900005,
    uname: '二游观察',
    fans: 23000,
    level: 5,
    sign: '只聊游戏',
    text: '鸣潮不出男角色，这不就是缅北二游吗',
    relation: 'author',
  },
  {
    mid: 900006,
    uname: '路过看看',
    fans: 34,
    level: 3,
    sign: '',
    text: '这游戏明明是一般向，凭什么让男玩家叫老婆',
    relation: 'commenter',
  },
  {
    mid: 900007,
    uname: '顺直观察日记',
    fans: 6100,
    level: 4,
    sign: '骄傲月快乐',
    text: '顺直男能不能去死，恶心',
    relation: 'author',
  },
  {
    mid: 900008,
    uname: '老哥稳',
    fans: 88,
    level: 3,
    sign: '国男勿扰 / 姐妹互助',
    text: '国男勿扰，姐妹互助',
    relation: 'fan',
    via: { mid: 900003, uname: '清醒的姐姐', family: 'radfem' },
  },
]

export function demoCandidates(targets: Targets): Candidate[] {
  const reflex = buildReflex(targets)
  return SEEDS.map((seed) => {
    const candidate = judgeText(reflex, seed.text, targets.modes, seed.relation)
    candidate.mid = seed.mid
    candidate.uname = seed.uname
    candidate.fans = seed.fans
    candidate.level = seed.level
    candidate.sign = seed.sign
    candidate.via = seed.via
    candidate.blocked = false
    candidate.flags = [...candidate.flags.filter((f) => f !== '仅评论证据'), '演示数据']
    candidate.breadth = 1
    return candidate
  }).sort((a, b) => b.score - a.score)
}
