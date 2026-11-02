import {
  fetchFans,
  fetchFollowings,
  fetchHistory,
  fetchPopular,
  fetchRanking,
  fetchSpaceArticles,
  fetchSpaceDynamics,
  fetchSpaceVideos,
  fetchUserCard,
  fetchVideoReplies,
  searchUsers,
  searchVideos,
  BiliError,
  type ReplyItem,
  type VideoRef,
} from './bili/api'
import { limiter } from './bili/transport'
import type { Reflex } from './analyze/engine'
import { buildSignals, type AccountRaw } from './analyze/account'
import { signHasContact } from './analyze/signals'
import { PACK_MAP } from './analyze/packs'
import { hamming, simhash } from './analyze/text'
import { enabledFamilies, rescoreCandidate } from './verdict'
import type { Candidate, Evidence, FamilyId, Targets } from './types'

export interface ScanSources {
  /** 我的观看历史：最贴近「我实际会看到什么」 */
  history: boolean
  /** 热门 / 排行榜：补足没看过的领域 */
  popular: boolean
  /** 站内检索：按目标分类的领域词找 */
  search: boolean
  /** 读评论区：污染源大多在评论里 */
  comments: boolean
  /** 连坐：顺着高分账号的粉丝列表继续挖 */
  cascade: boolean
}

export const DEFAULT_SOURCES: ScanSources = {
  history: true,
  popular: true,
  search: true,
  comments: true,
  cascade: true,
}

export interface ScanBudget {
  /** 从观看历史取多少个视频 */
  historyLimit: number
  /** 从热门 / 排行榜取多少个视频 */
  popularLimit: number
  /** 每个领域词检索几页 */
  searchPages: number
  /** 最多扫多少个视频的评论区 */
  videoLimit: number
  /** 每个评论区翻几页（热评序 + 最新序各翻一遍） */
  commentPages: number
  /** 最多补多少份账号资料 */
  maxCandidates: number
  /** 每个账号读多少条投稿 */
  profileDepth: number
  /** 对多少个高分账号做粉丝连坐 */
  cascadeTargets: number
  /** 每个账号采多少粉丝 */
  cascadeFans: number
}

export const DEFAULT_BUDGET: ScanBudget = {
  historyLimit: 20,
  popularLimit: 30,
  searchPages: 1,
  videoLimit: 10,
  commentPages: 2,
  maxCandidates: 40,
  profileDepth: 20,
  cascadeTargets: 3,
  cascadeFans: 20,
}

export interface ScanProgress {
  phase: string
  done: number
  total: number
  note?: string
  found?: number
}

export interface ScanOptions {
  targets: Targets
  reflex: Reflex
  budget: ScanBudget
  sources: ScanSources
  /** 已拉黑 / 已忽略的 mid */
  excluded: Set<number>
  selfMid: number
  onProgress: (p: ScanProgress) => void
  signal: AbortSignal
}

class Aborted extends Error {}

function check(signal: AbortSignal): void {
  if (signal.aborted) throw new Aborted('已中止')
}

/**
 * -412 是 IP 级风控，继续扫只会一直撞墙并加重风控。
 * 遇到就直接停，把原因交给界面显示。
 */
function bailOnRisk(err: unknown): void {
  if (err instanceof BiliError && err.code === -412) {
    throw new Error('触发 IP 风控（-412），扫描已停止。等 10 分钟再试，或把扫描规模调小。')
  }
}

export function isAborted(err: unknown): boolean {
  return err instanceof Aborted
}

interface TemplateGroup {
  hash: { hi: number; lo: number }
  text: string
  authors: Set<number>
}

export async function runScan(opts: ScanOptions): Promise<Candidate[]> {
  const { targets, reflex, budget, sources, excluded, selfMid, onProgress, signal } = opts
  const families = enabledFamilies(targets.modes)

  const registry = new Map<number, Candidate>()
  const videoPool = new Map<number, VideoRef>()
  const templates: TemplateGroup[] = []
  const stats = new Map<number, { comments: number; videos: Set<number> }>()
  const bump = (mid: number, aid: number): void => {
    const entry = stats.get(mid) ?? { comments: 0, videos: new Set<number>() }
    entry.comments++
    entry.videos.add(aid)
    stats.set(mid, entry)
  }

  const total =
    (sources.history ? 1 : 0) +
    (sources.popular ? 2 : 0) +
    (sources.search ? Math.max(1, targets.topics.length) : 0) +
    budget.videoLimit * Math.max(1, budget.commentPages) +
    budget.maxCandidates +
    (sources.cascade ? budget.cascadeTargets : 0) +
    2
  let done = 0
  const tick = (phase: string, note?: string): void => {
    done++
    onProgress({ phase, done, total: Math.max(done, total), note, found: registry.size })
  }

  const ensure = (mid: number, uname = '', relation: Candidate['relation'] = 'commenter'): Candidate => {
    let c = registry.get(mid)
    if (!c) {
      c = {
        mid,
        uname,
        sign: '',
        level: 0,
        silence: 0,
        officialType: -1,
        officialRole: 0,
        officialTitle: '',
        relation,
        blocked: false,
        evidences: [],
        matches: [],
        score: 0,
        verdict: 'skip',
        breadth: 0,
        flags: [],
      }
      registry.set(mid, c)
    } else if (!c.uname && uname) {
      c.uname = uname
    }
    if (relation === 'author' && c.relation === 'commenter') c.relation = 'author'
    return c
  }

  const addEvidence = (mid: number, uname: string, ev: Omit<Evidence, 'verdicts' | 'score'>, relation?: Candidate['relation']): void => {
    if (!mid || mid === selfMid || excluded.has(mid)) return
    const candidate = ensure(mid, uname, relation)
    const verdicts = reflex.evaluate(ev.text)
    if (!verdicts.length) return
    candidate.evidences.push({
      ...ev,
      verdicts,
      score: verdicts[0]?.score ?? 0,
    })
  }

  /* ---------------- 阶段一：收集视频池 ---------------- */
  onProgress({ phase: '收集', done: 0, total, note: '观看历史 / 热门 / 检索' })

  if (sources.history) {
    try {
      for (const v of await fetchHistory(budget.historyLimit)) {
        if (v.aid && !videoPool.has(v.aid)) videoPool.set(v.aid, v)
      }
    } catch (err) {
      if (err instanceof Aborted) throw err
    }
    tick('收集', '观看历史')
  }

  if (sources.popular) {
    try {
      for (const v of await fetchPopular(budget.popularLimit)) {
        if (v.aid && !videoPool.has(v.aid)) videoPool.set(v.aid, v)
      }
    } catch {
      /* 热门失败不影响整体 */
    }
    tick('收集', '热门')

    try {
      for (const v of await fetchRanking(0, budget.popularLimit)) {
        if (v.aid && !videoPool.has(v.aid)) videoPool.set(v.aid, v)
      }
    } catch {
      /* 排行榜失败不影响整体 */
    }
    tick('收集', '排行榜')
  }

  if (sources.search) {
    const topics = (targets.topics.length ? targets.topics : families.flatMap((f) => PACK_MAP.get(f)?.topics ?? [])).slice(0, 8)
    const seen = new Set<string>()
    for (const topic of topics) {
      if (seen.has(topic)) continue
      seen.add(topic)
      for (let page = 1; page <= budget.searchPages; page++) {
        check(signal)
        try {
          for (const v of await searchVideos(topic, page)) {
            if (!v.aid) continue
            const ref: VideoRef = {
              aid: v.aid,
              bvid: v.bvid,
              title: v.title,
              author: v.author,
              mid: v.mid,
              desc: v.description,
              source: 'search',
            }
            if (!videoPool.has(v.aid)) videoPool.set(v.aid, ref)
            addEvidence(
              v.mid,
              v.author,
              {
                source: 'video',
                text: [v.title, v.description, v.tag].filter(Boolean).join(' '),
                url: `https://www.bilibili.com/video/${v.bvid}`,
                ts: v.pubdate,
              },
              'author',
            )
          }
        } catch (err) {
          if (err instanceof Aborted) throw err
        }
        tick('检索', topic)
      }
      if (targets.topics.length === 0 && registry.size < 20) {
        try {
          for (const u of await searchUsers(topic, 1)) {
            if (excluded.has(u.mid) || u.mid === selfMid) continue
            addEvidence(u.mid, u.uname, { source: 'sign', text: [u.uname, u.usign].filter(Boolean).join(' ') }, 'author')
          }
        } catch {
          /* 用户检索失败可忽略 */
        }
      }
    }
  }

  /* ---------------- 阶段二：评论区 ---------------- */
  if (sources.comments) {
    const targets_ = [...videoPool.values()]
      .sort((a, b) => (b.comment ?? 0) - (a.comment ?? 0))
      .slice(0, budget.videoLimit)

    for (const ref of targets_) {
      check(signal)
      // 视频作者本身也是一条证据
      addEvidence(
        ref.mid,
        ref.author,
        {
          source: 'video',
          text: [ref.title, ref.desc ?? ''].filter(Boolean).join(' '),
          url: ref.bvid ? `https://www.bilibili.com/video/${ref.bvid}` : `https://www.bilibili.com/video/av${ref.aid}`,
        },
        'author',
      )

      let replies: ReplyItem[] = []
      try {
        replies = await fetchVideoReplies(ref.aid, ref.mid, budget.commentPages, 1)
      } catch (err) {
        if (err instanceof Aborted) throw err
        bailOnRisk(err)
      }
      // 最新序再翻一遍，热评里看不到的「日常发言者」常常在这里
      if (budget.commentPages > 1) {
        try {
          replies = replies.concat(await fetchVideoReplies(ref.aid, ref.mid, 1, 1, 2))
        } catch {
          /* 第二种排序失败就用热评 */
        }
      }

      for (const r of replies) {
        check(signal)
        if (!r.mid || r.mid === ref.mid) continue
        bump(r.mid, ref.aid)
        addEvidence(r.mid, r.uname, {
          source: 'reply',
          text: r.message,
          url: `https://www.bilibili.com/video/av${ref.aid}`,
          ts: r.ctime,
        })
        // 模板评论检测：近似重复的文本被多个账号发出
        registerTemplate(templates, r.message, r.mid)
      }
      tick('评论', `av${ref.aid}`)
    }
  }

  /* ---------------- 阶段三：账号资料 ---------------- */
  // 先做一次无结构的粗排，只给真正有信号的账号补资料，省请求
  for (const c of registry.values()) rescoreCandidate(c, targets.modes)
  const seed = [...registry.values()]
    .filter((c) => c.score >= 0.22 || c.relation === 'author')
    .sort((a, b) => b.score - a.score)
    .slice(0, budget.maxCandidates)

  const templateCount = new Map<number, number>()
  for (const group of templates) {
    if (group.authors.size < 2) continue
    for (const mid of group.authors) {
      templateCount.set(mid, Math.max(templateCount.get(mid) ?? 0, group.authors.size - 1))
    }
  }

  for (const candidate of seed) {
    check(signal)
    // 只有已经出现明显信号的账号才值得多花几次请求，
    // 否则每号 5 次请求会把一次扫描拖到十分钟以上
    const deep = candidate.score >= 0.4
    try {
      const card = await fetchUserCard(candidate.mid)
      candidate.uname = card.name || candidate.uname
      candidate.sign = card.sign
      candidate.face = card.face
      candidate.level = card.level
      candidate.fans = card.fans
      candidate.banned = card.spacesta === -2
      candidate.silence = card.spacesta
      candidate.officialType = card.officialType
      candidate.officialRole = card.officialRole
      candidate.officialTitle = card.officialTitle
      candidate.videos = card.archiveCount
      candidate.regtime = card.regtime
      if (card.sign) {
        const verdicts = reflex.evaluate(card.sign)
        if (verdicts.length) {
          candidate.evidences.push({ source: 'sign', text: card.sign, verdicts, score: verdicts[0].score })
        }
      }
    } catch (err) {
      if (err instanceof Aborted) throw err
      bailOnRisk(err)
      candidate.error = err instanceof BiliError ? err.message : '资料获取失败'
    }

    const videoTexts: string[] = []
    const partitions: Record<string, number> = {}
    try {
      const { list } = await fetchSpaceVideos(candidate.mid, 1, Math.min(30, budget.profileDepth))
      for (const v of list.slice(0, budget.profileDepth)) {
        const text = [v.title, v.description].filter(Boolean).join(' ')
        videoTexts.push(text)
        if (v.partition) partitions[v.partition] = (partitions[v.partition] ?? 0) + 1
        const verdicts = reflex.evaluate(text)
        if (verdicts.length) {
          candidate.evidences.push({
            source: 'video',
            text,
            url: `https://www.bilibili.com/video/${v.bvid}`,
            ts: v.created,
            verdicts,
            score: verdicts[0].score,
          })
        }
      }
    } catch {
      /* 空间可能被限制，不影响其他证据 */
    }

    if (deep) {
      try {
        for (const d of await fetchSpaceDynamics(candidate.mid, 1)) {
          const verdicts = reflex.evaluate(d.text)
          if (verdicts.length) {
            candidate.evidences.push({ source: 'dynamic', text: d.text, url: d.url, ts: d.ts, verdicts, score: verdicts[0].score })
          }
        }
      } catch {
        /* 动态经常需要登录，失败可忽略 */
      }

      try {
        for (const a of await fetchSpaceArticles(candidate.mid, 1, 10)) {
          const text = [a.title, a.summary].filter(Boolean).join(' ')
          const verdicts = reflex.evaluate(text)
          if (verdicts.length) {
            candidate.evidences.push({
              source: 'article',
              text,
              url: `https://www.bilibili.com/read/cv${a.id}`,
              ts: a.publishTime,
              verdicts,
              score: verdicts[0].score,
            })
          }
        }
      } catch {
        /* 专栏失败可忽略 */
      }
    }

    /* 关注列表只做交叉印证，不单独定案 */
    const clusterFollows: Partial<Record<FamilyId, number>> = {}
    if (deep) {
      try {
        const follows = await fetchFollowings(candidate.mid, 50)
        for (const f of follows) {
          const verdicts = reflex.evaluate([f.uname, f.sign].filter(Boolean).join(' '))
          for (const v of verdicts) {
            if (v.score < 0.62) continue
            clusterFollows[v.family] = (clusterFollows[v.family] ?? 0) + 1
          }
        }
      } catch {
        /* 关注列表可忽略 */
      }
    }

    if (candidate.evidences.length > 14) candidate.evidences = candidate.evidences.slice(0, 14)

    const raw: AccountRaw = {
      name: candidate.uname,
      sign: candidate.sign,
      face: candidate.face ?? '',
      level: candidate.level,
      fans: candidate.fans ?? 0,
      following: 0,
      regtime: candidate.regtime ?? 0,
      videos: candidate.videos ?? 0,
      verified: candidate.officialType >= 0,
      videoTexts,
      partitions,
      dynamics: candidate.evidences.filter((e) => e.source === 'dynamic').length,
      comments: stats.get(candidate.mid)?.comments ?? 0,
      distinctVideos: stats.get(candidate.mid)?.videos.size ?? 0,
      templated: templateCount.get(candidate.mid) ?? 0,
      clusterFollows,
    }
    candidate.signals = buildSignals(raw)
    if (templateCount.get(candidate.mid)) candidate.flags.push('模板评论')
    if (signHasContact(candidate.sign)) candidate.flags.push('签名引流')
    candidate.breadth = new Set(candidate.evidences.map((e) => e.source)).size
    tick('画像', candidate.uname)
  }

  /* ---------------- 阶段四：连坐 ---------------- */
  for (const c of registry.values()) rescoreCandidate(c, targets.modes)

  if (sources.cascade) {
    const cascadeTargets = [...registry.values()]
      .filter((c) => c.verdict === 'block' && !c.banned && c.matches[0])
      .filter((c) => {
        const pack = c.matches[0].family ? PACK_MAP.get(c.matches[0].family) : null
        if (!pack) return false
        const level = c.matches[0].level
        return level.cascade > 0 && (c.signals?.fans ?? 0) >= 20
      })
      .slice(0, budget.cascadeTargets)

    for (const target of cascadeTargets) {
      check(signal)
      const family = target.matches[0].family
      const level = target.matches[0].level
      const reached = new Set<number>()
      const pages = level.cascade > 1 ? 2 : 1
      for (let page = 1; page <= pages; page++) {
        try {
          const { list } = await fetchFans(target.mid, page, Math.min(50, budget.cascadeFans))
          if (!list.length) break
          for (const fan of list) {
            check(signal)
            if (fan.mid === selfMid || excluded.has(fan.mid) || registry.has(fan.mid)) continue
            if (reached.has(fan.mid)) continue
            const text = [fan.uname, fan.sign].filter(Boolean).join(' ')
            const verdicts = reflex.evaluate(text)
            const top = verdicts.find((v) => v.family === family)
            if (!top || top.score < level.review) continue
            reached.add(fan.mid)
            const candidate = ensure(fan.mid, fan.uname, 'fan')
            candidate.via = { mid: target.mid, uname: target.uname, family }
            candidate.face = fan.face
            candidate.sign = fan.sign
            candidate.evidences.push({ source: 'fans', text, verdicts, score: top.score })
            // 只有签名就够可疑的，再补一次资料确认
            if (top.score >= 0.6 && registry.size <= budget.maxCandidates * 2) {
              try {
                const card = await fetchUserCard(fan.mid)
                candidate.level = card.level
                candidate.fans = card.fans
                candidate.videos = card.archiveCount
                candidate.officialType = card.officialType
                candidate.officialRole = card.officialRole
                candidate.banned = card.spacesta === -2
                candidate.signals = buildSignals({
                  name: candidate.uname,
                  sign: fan.sign,
                  face: fan.face,
                  level: card.level,
                  fans: card.fans,
                  following: 0,
                  regtime: card.regtime,
                  videos: card.archiveCount,
                  verified: card.officialType >= 0,
                  videoTexts: [],
                  partitions: {},
                  dynamics: 0,
                  comments: 0,
                  distinctVideos: 0,
                  templated: templateCount.get(fan.mid) ?? 0,
                  clusterFollows: {},
                })
              } catch {
                /* 连坐资料失败就只按签名判 */
              }
            }
          }
        } catch (err) {
          if (err instanceof Aborted) throw err
          bailOnRisk(err)
          break
        }
      }
      tick('连坐', target.uname)
    }
  }

  /* ---------------- 阶段五：汇总 ---------------- */
  onProgress({ phase: '汇总', done: 0, total: registry.size })
  const results = [...registry.values()].filter((c) => c.evidences.length > 0 || (c.signals && c.matches.length))
  for (const c of results) {
    c.evidences = [...c.evidences].sort((a, b) => b.score - a.score).slice(0, 8)
    rescoreCandidate(c, targets.modes)
  }
  // 结果要写进脚本存储，留太多会把配额撑爆；先保住有结论的，再按分数补足
  const sorted = results.sort((a, b) => b.score - a.score)
  const keep = sorted.filter((c) => c.verdict !== 'skip').concat(sorted.filter((c) => c.verdict === 'skip'))
  const capped = keep.slice(0, 400)
  onProgress({ phase: '完成', done: capped.length, total: capped.length })

  if (limiter.cooling) await new Promise((r) => setTimeout(r, 0))
  return capped.sort((a, b) => b.score - a.score)
}

function registerTemplate(groups: TemplateGroup[], text: string, mid: number): void {
  const norm = text.trim()
  if (norm.length < 4) return
  const hash = simhash(norm)
  for (const group of groups) {
    if (hamming(group.hash, hash) <= 3) {
      group.authors.add(mid)
      return
    }
  }
  if (groups.length > 1500) return
  groups.push({ hash, text: norm, authors: new Set([mid]) })
}
