/**
 * 中文切词与关键词抽取。
 * 使用平台内置的 Intl.Segmenter，无需引入额外分词库。
 */

const STOPWORDS = new Set([
  '的','了','是','在','我','有','和','就','不','人','都','一','一个','上','也','很','到','说','要','去','你','会','着','没有','看','好','自己','这','那','他','她','它','我们','你们','他们','这个','那个','什么','怎么','为什么','因为','所以','但是','而且','或者','如果','虽然','然后','还是','就是','可以','应该','需要','觉得','认为','感觉','真的','其实','可能','已经','一直','现在','时候','问题','东西','事情','地方','方面','情况','视频','评论','up','up主','主播','内容','平台','账号','用户','大家','别人','有人','很多','一些','这些','那些','这样','那样','怎么','如何','以及','并且','不过','只是','还有','没有','不能','不会','不是','一样','非常','特别','比较','更加','最','太','挺','蛮','有点','一点','一下','一起','出来','起来','过去','下来','进来','上去','里面','外面','上面','下面','前面','后面','左边','右边','中间','之后','之前','以后','以前','当时','后来','最后','首先','其次','总之','反正','毕竟','居然','竟然','难道','简直','确实','的确','当然','也许','大概','几乎','差不多','完全','根本','绝对','必须','一定','肯定','好像','似乎','仿佛','例如','比如','等等','之类','什么的',
])

const NOISE = /^[\d\s\p{P}\p{S}]+$/u

export interface SegmentResult {
  /** 按词频与长度加权的候选关键词 */
  keywords: string[]
  tokens: string[]
}

let segmenter: Intl.Segmenter | null = null

function getSegmenter(): Intl.Segmenter | null {
  if (segmenter) return segmenter
  try {
    segmenter = new Intl.Segmenter('zh-Hans', { granularity: 'word' })
  } catch {
    segmenter = null
  }
  return segmenter
}

function tokenize(text: string): string[] {
  const seg = getSegmenter()
  if (!seg) {
    return text.split(/[^\p{Script=Han}\p{L}\p{N}]+/u).filter(Boolean)
  }
  const out: string[] = []
  for (const part of seg.segment(text)) {
    if (!part.isWordLike) continue
    const t = part.segment.trim().toLowerCase()
    if (!t) continue
    out.push(t)
  }
  return out
}

/**
 * 抽取候选关键词：保留 2 字以上、非停用词、非纯符号的词，
 * 并对 4 字以上的词额外切出其 2-3 字子串，提升召回。
 */
export function extractKeywords(text: string, limit = 24): SegmentResult {
  const tokens = tokenize(text)
  const freq = new Map<string, number>()
  for (const t of tokens) {
    if (t.length < 2) continue
    if (STOPWORDS.has(t)) continue
    if (NOISE.test(t)) continue
    if (/^[a-z]{1,2}$/.test(t)) continue
    freq.set(t, (freq.get(t) ?? 0) + 1)
  }

  const scored = [...freq.entries()]
    .map(([term, count]) => {
      let score = count * 1.6 + Math.min(term.length, 6) * 0.5
      // 含数字或拉丁字母的多为型号/年份，降权
      if (/[0-9a-z]/.test(term)) score -= 0.6
      return { term, score }
    })
    .sort((a, b) => b.score - a.score)

  const keywords: string[] = []
  for (const { term } of scored) {
    if (keywords.length >= limit) break
    if (keywords.some((k) => k.includes(term) || term.includes(k))) continue
    keywords.push(term)
  }
  return { keywords, tokens }
}
