import {
  fetchFollowings,
  fetchIndexedReplies,
  fetchSpaceArticles,
  fetchSpaceDynamics,
  fetchSpaceVideos,
  fetchUserCard,
  fetchVideoReplies,
  searchUsers,
  searchVideos,
  BiliError,
} from './bili/api'
import { limiter } from './bili/transport'
import { aggregate, scoreBatch, type RawEvidence, type Scorer } from './analyze/score'
import type { Candidate, Evidence, Profile, SourceKind } from './types'

export interface ScanBudget {
  /** 每个领域词检索的页数 */
  searchPages: number
  /** 最多处理的候选账号数 */
  maxCandidates: number
  /** 每个账号最多取几页投稿 */
  videoPages: number
  /** 每个账号最多取几页动态 */
  dynamicPages: number
  /** 是否读取专栏 */
  articles: boolean
  /** 是否读取关注列表 */
  followings: boolean
  /** 最多挖掘多少个视频的评论区 */
  commentVideos: number
  /** 每个评论区最多翻几页 */
  commentPages: number
  /** 高赞评论作为「他人评价」的点赞门槛 */
  peerLikeThreshold: number
  /** 通过第三方索引补全历史评论（非官方，覆盖不全） */
  indexedReplies: boolean
  /** 补全历史评论的候选上限 */
  indexedCandidates: number
}

export const DEFAULT_BUDGET: ScanBudget = {
  searchPages: 1,
  maxCandidates: 120,
  videoPages: 1,
  dynamicPages: 1,
  articles: true,
  followings: true,
  commentVideos: 24,
  commentPages: 1,
  peerLikeThreshold: 60,
  indexedReplies: false,
  indexedCandidates: 12,
}

export interface ScanProgress {
  phase: string
  done: number
  total: number
  note?: string
}

export interface ScanOptions {
  profile: Profile
  scorer: Scorer
  budget: ScanBudget
  /** 已拉黑 / 已忽略的 mid */
  excluded: Set<number>
  selfMid: number
  onProgress: (p: ScanProgress) => void
  signal: AbortSignal
}

interface VideoRef {
  aid: number
  mid: number
  uname: string
}

class Aborted extends Error {}

function check(signal: AbortSignal): void {
  if (signal.aborted) throw new Aborted('已中止')
}

export async function runScan(opts: ScanOptions): Promise<Candidate[]> {
  const { profile, scorer, budget, excluded, selfMid, onProgress, signal } = opts

  const registry = new Map<number, Candidate>()
  /** mid -> 尚未打分的原始证据 */
  const pending = new Map<number, RawEvidence[]>()
  const videoRefs = new Map<number, VideoRef>()
  const discoveredUsers = new Map<number, string>()

  const ensure = (mid: number, uname = ''): Candidate => {
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
        blocked: false,
        evidences: [],
        score: 0,
        verdict: 'skip',
        breadth: 0,
        flags: [],
      }
      registry.set(mid, c)
    } else if (!c.uname && uname) c.uname = uname
    return c
  }

  const push = (mid: number, uname: string, ev: RawEvidence): void => {
    if (!mid || mid === selfMid || excluded.has(mid)) return
    ensure(mid, uname)
    const list = pending.get(mid) ?? []
    list.push(ev)
    pending.set(mid, list)
  }

  const topics = profile.topics.slice(0, 8)
  const totalSteps = topics.length * budget.searchPages + Math.min(budget.maxCandidates, 200) + budget.commentVideos
  let done = 0
  const tick = (phase: string, note?: string): void => {
    done++
    onProgress({ phase, done, total: totalSteps, note })
  }

  /* ---------------- 阶段一：按领域词检索 ---------------- */
  onProgress({ phase: '检索', done: 0, total: totalSteps })
  for (const topic of topics) {
    check(signal)
    for (let page = 1; page <= budget.searchPages; page++) {
      try {
        const videos = await searchVideos(topic, page)
        for (const v of videos) {
          if (!v.mid || excluded.has(v.mid) || v.mid === selfMid) continue
          videoRefs.set(v.aid, { aid: v.aid, mid: v.mid, uname: v.author })
          push(v.mid, v.author, {
            source: 'video',
            text: [v.title, v.description, v.tag].filter(Boolean).join(' '),
            url: `https://www.bilibili.com/video/${v.bvid}`,
            ts: v.pubdate,
          })
        }
      } catch (err) {
        if (err instanceof Aborted) throw err
      }
      tick('检索', topic)
    }
    if (discoveredUsers.size < budget.maxCandidates) {
      try {
        const users = await searchUsers(topic, 1)
        for (const u of users) {
          if (excluded.has(u.mid) || u.mid === selfMid) continue
          discoveredUsers.set(u.mid, u.uname)
          push(u.mid, u.uname, { source: 'sign', text: [u.uname, u.usign].filter(Boolean).join(' ') })
        }
      } catch (err) {
        if (err instanceof Aborted) throw err
      }
    }
  }

  /* ---------------- 阶段二：账号画像采集 ---------------- */
  const seedMids = [...registry.keys()].slice(0, budget.maxCandidates)
  onProgress({ phase: '画像', done, total: totalSteps })

  for (const mid of seedMids) {
    check(signal)
    const candidate = ensure(mid)
    try {
      const card = await fetchUserCard(mid)
      candidate.uname = card.name || candidate.uname
      candidate.sign = card.sign
      candidate.level = card.level
      candidate.fans = card.fans
      candidate.banned = card.spacesta === -2
      candidate.officialType = card.officialType
      candidate.officialRole = card.officialRole
      candidate.officialTitle = card.officialTitle
      if (card.sign) push(mid, candidate.uname, { source: 'sign', text: card.sign })
      if (card.officialTitle) push(mid, candidate.uname, { source: 'name', text: card.officialTitle })
    } catch (err) {
      if (err instanceof Aborted) throw err
      candidate.error = err instanceof BiliError ? err.message : '资料获取失败'
    }

    try {
      const { list } = await fetchSpaceVideos(mid, 1, 30)
      for (const v of list.slice(0, 30)) {
        push(mid, candidate.uname, {
          source: 'video',
          text: [v.title, v.description, v.partition].filter(Boolean).join(' '),
          url: `https://www.bilibili.com/video/${v.bvid}`,
          ts: v.created,
        })
        if (v.comment >= 20 && videoRefs.size < budget.commentVideos * 3) {
          videoRefs.set(v.aid, { aid: v.aid, mid, uname: candidate.uname })
        }
      }
      if (budget.videoPages > 1) {
        for (let p = 2; p <= budget.videoPages; p++) {
          check(signal)
          const more = await fetchSpaceVideos(mid, p, 30)
          for (const v of more.list) {
            push(mid, candidate.uname, {
              source: 'video',
              text: [v.title, v.description, v.partition].filter(Boolean).join(' '),
              url: `https://www.bilibili.com/video/${v.bvid}`,
              ts: v.created,
            })
          }
        }
      }
    } catch (err) {
      if (err instanceof Aborted) throw err
    }

    try {
      const dynamics = await fetchSpaceDynamics(mid, budget.dynamicPages)
      for (const d of dynamics) push(mid, candidate.uname, { source: 'dynamic', text: d.text, url: d.url, ts: d.ts })
    } catch (err) {
      if (err instanceof Aborted) throw err
    }

    if (budget.articles) {
      try {
        const articles = await fetchSpaceArticles(mid, 1, 30)
        for (const a of articles) {
          push(mid, candidate.uname, {
            source: 'article',
            text: [a.title, a.summary].filter(Boolean).join(' '),
            url: `https://www.bilibili.com/read/cv${a.id}`,
            ts: a.publishTime,
          })
        }
      } catch (err) {
        if (err instanceof Aborted) throw err
      }
    }

    if (budget.followings) {
      try {
        const follows = await fetchFollowings(mid, 50)
        // 关注列表只做交叉印证：命中的账号数达标才形成一条受限证据
        const matched: string[] = []
        for (const f of follows) {
          const text = [f.uname, f.sign].filter(Boolean).join(' ')
          if (!text) continue
          const [scored] = await scoreBatch(scorer, [{ source: 'name', text }])
          if (scored && scored.score >= 0.6) matched.push(f.uname)
        }
        if (matched.length >= 3) {
          push(mid, candidate.uname, {
            source: 'follow',
            text: `关注列表中多个账号命中：${matched.slice(0, 8).join('、')}`,
          })
        }
      } catch (err) {
        if (err instanceof Aborted) throw err
      }
    }
    tick('画像', candidate.uname)
  }

  /* ---------------- 阶段三：评论区挖掘 ---------------- */
  const commentTargets = [...videoRefs.values()].slice(0, budget.commentVideos)
  onProgress({ phase: '评论', done, total: totalSteps })

  for (const ref of commentTargets) {
    check(signal)
    try {
      const replies = await fetchVideoReplies(ref.aid, ref.mid, budget.commentPages)
      for (const r of replies) {
        const evidence: RawEvidence = {
          source: 'reply',
          text: r.message,
          url: `https://www.bilibili.com/video/av${ref.aid}`,
          ts: r.ctime,
        }
        if (r.mid === ref.mid) {
          // UP 本人在自己评论区的发言
          push(ref.mid, ref.uname, evidence)
        } else {
          push(r.mid, r.uname, evidence)
        }
        if (r.like >= budget.peerLikeThreshold) {
          push(ref.mid, ref.uname, { ...evidence, source: 'peer' as SourceKind })
        }
      }
    } catch (err) {
      if (err instanceof Aborted) throw err
    }
    tick('评论', `av${ref.aid}`)
  }

  /* ---------------- 阶段四：补全历史评论 ---------------- */
  if (budget.indexedReplies) {
    // 官方无「按 mid 查全站评论」接口，只能对高分候选补全，且来源受限
    const targets = [...registry.values()]
      .filter((c) => !c.banned)
      .slice(0, budget.maxCandidates)
      .sort((a, b) => (pending.get(b.mid)?.length ?? 0) - (pending.get(a.mid)?.length ?? 0))
      .slice(0, budget.indexedCandidates)
    onProgress({ phase: '历史评论', done: 0, total: targets.length })
    let n = 0
    for (const c of targets) {
      check(signal)
      try {
        const replies = await fetchIndexedReplies(c.mid, 2)
        for (const r of replies) {
          pending.get(c.mid)?.push({ source: 'reply', text: r.message })
        }
      } catch (err) {
        if (err instanceof Aborted) throw err
      }
      n++
      onProgress({ phase: '历史评论', done: n, total: targets.length })
    }
  }

  /* ---------------- 阶段五：统一打分 ---------------- */
  onProgress({ phase: '打分', done: 0, total: pending.size })
  const mids = [...pending.keys()]
  let scored = 0
  for (const mid of mids) {
    check(signal)
    const candidate = ensure(mid)
    const items = pending.get(mid) ?? []
    try {
      const evidences: Evidence[] = await scoreBatch(scorer, items.slice(0, 60))
      candidate.evidences = evidences
    } catch {
      candidate.evidences = []
    }
    aggregate(scorer, candidate)
    scored++
    if (scored % 8 === 0) onProgress({ phase: '打分', done: scored, total: mids.length })
  }
  onProgress({ phase: '打分', done: mids.length, total: mids.length })

  const results = [...registry.values()]
    .filter((c) => c.evidences.length > 0 || c.score > 0)
    .sort((a, b) => b.score - a.score)

  // 冷却期间给出提示，避免用户以为卡住
  if (limiter.cooling) await new Promise((r) => setTimeout(r, 0))

  return results
}

export function isAborted(err: unknown): boolean {
  return err instanceof Aborted
}
