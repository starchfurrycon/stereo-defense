import type { FamilyId } from './families'

/**
 * 校准样本库。
 *
 * 每一类都放三种样本：
 * - target：应该被判中的发言；
 * - critic：批判这类人时说的话，必须放行；
 * - neutral：只是聊到相关话题，必须放行。
 *
 * 之所以把 critic 放这么多，是因为误伤的代价远高于漏判：
 * 漏掉一个人只是多看一条评论，误伤一个揭露台独的 UP 主会直接毁掉体验。
 */
export interface TextSample {
  text: string
  family: FamilyId | 'none'
  kind: 'target' | 'critic' | 'neutral'
  note?: string
}

export const TEXT_CORPUS: TextSample[] = [
  /* ---------------- 殖人 · 汉奸 ---------------- */
  { text: '这下支性难改了，洼地就是洼地', family: 'traitor', kind: 'target' },
  { text: '这国怎，定体问，我陷思，中国药丸', family: 'traitor', kind: 'target' },
  { text: '润出去了才知道什么叫文明世界，太平洋没加盖', family: 'traitor', kind: 'target' },
  { text: '中国人的劣根性几千年了，改不了的', family: 'traitor', kind: 'target' },
  { text: '台湾是一个主权独立的国家，台湾人不是中国人', family: 'traitor', kind: 'target' },
  { text: '南京大屠杀根本不存在，都是编出来煽动仇恨的', family: 'traitor', kind: 'target' },
  { text: '你国人民的素质就这样，别怪别人看不起', family: 'traitor', kind: 'target' },
  { text: '坚决反对台独分裂势力，祖国统一是历史大势', family: 'none', kind: 'critic' },
  { text: '这篇文章揭露了殖人的话术：所谓文明世界，双标得很', family: 'none', kind: 'critic' },
  { text: '美国基建这次确实拉胯，咱们的差距正在缩小', family: 'none', kind: 'neutral' },
  { text: '有些公知总说外国空气香甜，这种言论早就被辟谣了', family: 'none', kind: 'critic' },
  { text: '关于移民，每个人有自己的选择，不必上纲上线', family: 'none', kind: 'neutral' },
  { text: '他引用「中国人不配拥有」这句话，就是为了批判这种自恨情绪', family: 'none', kind: 'critic' },
  { text: '日本的垃圾分类确实做得细，这点值得学习', family: 'none', kind: 'neutral' },

  /* ---------------- 极端女权 ---------------- */
  { text: '国男真的不配，普信男太多了', family: 'radfem', kind: 'target' },
  { text: '男凝真是无处不在，看得我生理不适', family: 'radfem', kind: 'target' },
  { text: '男人没一个好东西，都是潜在的施暴者', family: 'radfem', kind: 'target' },
  { text: '婚驴才结婚，聪明女人都去父留子', family: 'radfem', kind: 'target' },
  { text: '国男就别谈共情了，天生劣等', family: 'radfem', kind: 'target' },
  { text: '男人都该死', family: 'radfem', kind: 'target' },
  { text: '女拳这个词现在被滥用了，很多人拿它攻击正常维权的女生', family: 'none', kind: 'critic' },
  { text: '打击性别对立，男女平等还有很长的路要走', family: 'none', kind: 'critic' },
  { text: '她被家暴了，报警和维权才是最重要的', family: 'none', kind: 'neutral' },
  { text: '我不喜欢普信男这个说法，用标签否定一整个性别都不对', family: 'none', kind: 'critic' },
  { text: '家暴受害者需要的不是嘲讽，而是法律保护', family: 'none', kind: 'neutral' },
  { text: '这个案子法院判了，男方承担全部责任', family: 'none', kind: 'neutral' },

  /* ---------------- 微女权 ---------------- */
  { text: '鸣潮不出男角色，这不就是缅北二游吗', family: 'softfem', kind: 'target' },
  { text: '这游戏明明是一般向，凭什么让男玩家叫老婆', family: 'softfem', kind: 'target' },
  { text: '男的普遍不够感性，根本不懂恋爱', family: 'softfem', kind: 'target' },
  { text: '男生就是不会共情，情绪价值为零', family: 'softfem', kind: 'target' },
  { text: '彩礼本来就是应该的，不给就是不爱', family: 'softfem', kind: 'target' },
  { text: '女的永远是对的，男的错了还不承认', family: 'softfem', kind: 'target' },
  { text: '女角色做成这样就是媚男，纯纯的物化女性', family: 'softfem', kind: 'target' },
  { text: '我不觉得男生都这样，我家那位挺会照顾人的', family: 'none', kind: 'critic' },
  { text: '彩礼这件事各家情况不同，不能一概而论', family: 'none', kind: 'neutral' },
  { text: '游戏角色设计确实可以讨论，但别搞男女对立', family: 'none', kind: 'critic' },
  { text: '他说男的都不懂浪漫，这话就有点绝对了', family: 'none', kind: 'critic' },
  { text: '作为一个女生，我觉得男女平等更重要', family: 'none', kind: 'neutral' },
  { text: '这次更新把女角色的立绘改了，玩家意见挺大', family: 'none', kind: 'neutral' },

  /* ---------------- LGBT 互喷 ---------------- */
  { text: '同性恋就是有病，恶心死了', family: 'lgbt', kind: 'target' },
  { text: '死基佬滚出这个圈子', family: 'lgbt', kind: 'target' },
  { text: '顺直男能不能去死，恶心', family: 'lgbt', kind: 'target' },
  { text: '跨性别都是精神病，不男不女', family: 'lgbt', kind: 'target' },
  { text: '不支持就是恐同，你自己看着办', family: 'lgbt', kind: 'target' },
  { text: '尊重性少数群体的权益，反对歧视', family: 'none', kind: 'critic' },
  { text: '同性恋去病化已经几十年了，还有人不信', family: 'none', kind: 'neutral' },
  { text: '恐同是一种偏见，但用「顺直」骂人同样不对', family: 'none', kind: 'critic' },
  { text: '跨性别者的心理健康需要被重视', family: 'none', kind: 'neutral' },
  { text: '我理解不了，但也不该辱骂他们', family: 'none', kind: 'neutral' },

  /* ---------------- 厂商结晶 ---------------- */
  { text: '你不玩就滚，白嫖还有理了', family: 'cultist', kind: 'target' },
  { text: '米孝子又开始护主了', family: 'cultist', kind: 'target' },
  { text: '黑子收钱了吧，带什么节奏', family: 'cultist', kind: 'target' },
  { text: '友商急了，这波原神确实吊打友商', family: 'cultist', kind: 'target' },
  { text: '氪金是自愿的，游戏公司也要吃饭', family: 'cultist', kind: 'target' },
  { text: '说句不好听的，云玩家也配评价这游戏', family: 'cultist', kind: 'target' },
  { text: '这版本数值确实有问题，建议策划看看反馈', family: 'none', kind: 'critic' },
  { text: '我退款了，这游戏运营太离谱', family: 'none', kind: 'neutral' },
  { text: '骂米哈游可以，但别攻击玩这游戏的人', family: 'none', kind: 'critic' },
  { text: '理性讨论，这游戏的抽卡概率是不是该公示', family: 'none', kind: 'neutral' },
  { text: '结晶这个词现在被乱用，正常喜欢游戏的人也被骂', family: 'none', kind: 'critic' },

  /* ---------------- 黑流机器人 ---------------- */
  { text: '加微信领取福利，日结兼职', family: 'bot', kind: 'target' },
  { text: '河南人就是骗子多，不服来辩', family: 'bot', kind: 'target' },
  { text: '懂的都懂，细思极恐', family: 'none', kind: 'neutral', note: '只有弱模板，不该单独定案' },
  { text: '刷单被骗了三千，大家谨防诈骗', family: 'none', kind: 'critic' },

  /* ---------------- 时政号 / 商单 ---------------- */
  { text: '俄乌冲突打了这么久，受苦的还是普通人', family: 'none', kind: 'neutral' },
  { text: '本期视频由某某品牌赞助，链接在简介', family: 'none', kind: 'neutral', note: '单条商单不足以定性' },
  { text: '这个牌子我用过，确实好用，不是广告', family: 'none', kind: 'neutral' },

  /* ---------------- 通用攻击 ---------------- */
  { text: '你妈死了，去死吧', family: 'abuse', kind: 'target' },
  { text: '我开盒你信不信', family: 'abuse', kind: 'target' },
  { text: '这操作太脑残了，策划出来挨打', family: 'none', kind: 'neutral' },
]
