import { httpRequest, type HttpResponse } from './transport'
import { cachedWbiKeys, clearWbiKeys, extractKeysFromNav, setWbiKeys, signQuery } from './wbi'

export const API = 'https://api.bilibili.com'
const SPACE_REFERER = 'https://space.bilibili.com/'
const SEARCH_REFERER = 'https://search.bilibili.com/'

export class BiliError extends Error {
  constructor(
    message: string,
    readonly code: number,
  ) {
    super(message)
  }
}

interface Envelope<T> {
  code: number
  message: string
  data: T
}

const RISK_CODES = new Set([-352, -412, -799])
const RISK_TEXT: Record<number, string> = {
  [-352]: '触发风控，已自动降速',
  [-412]: '请求被拦截，请稍后重试',
  [-799]: '请求过于频繁',
  [-101]: '账号未登录',
  [-403]: '访问权限不足',
  [-111]: 'CSRF 校验失败',
}

function parse<T>(res: HttpResponse, allowCodes: number[] = []): Envelope<T> {
  if (res.status === 412) throw new BiliError(RISK_TEXT[-412], -412)
  if (!res.text) throw new BiliError(`空响应 (HTTP ${res.status})`, res.status)
  let json: Envelope<T>
  try {
    json = JSON.parse(res.text) as Envelope<T>
  } catch {
    throw new BiliError('响应解析失败', res.status)
  }
  if (json.code !== 0 && !allowCodes.includes(json.code)) {
    throw new BiliError(RISK_TEXT[json.code] ?? json.message ?? `错误 ${json.code}`, json.code)
  }
  return json
}

/* ------------------------------------------------------------------ */
/* 请求原语                                                            */
/* ------------------------------------------------------------------ */

async function plainGet<T>(
  path: string,
  params: Record<string, string | number | undefined>,
  referer = SPACE_REFERER,
): Promise<T> {
  const search = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') search.set(k, String(v))
  }
  const res = await httpRequest({ url: `${API}${path}?${search}`, referer })
  return parse<T>(res).data
}

async function plainPost<T>(
  path: string,
  form: Record<string, string | number>,
  referer = SPACE_REFERER,
): Promise<Envelope<T>> {
  const res = await httpRequest({ url: `${API}${path}`, method: 'POST', form, referer })
  return parse<T>(res)
}

let wbiInflight: Promise<void> | null = null

export async function ensureWbi(): Promise<void> {
  if (cachedWbiKeys()) return
  if (wbiInflight) return wbiInflight
  wbiInflight = (async () => {
    const res = await httpRequest({ url: `${API}/x/web-interface/nav` })
    const json = parse<{ wbi_img?: { img_url: string; sub_url: string } }>(res, [-101])
    const keys = extractKeysFromNav(json)
    if (!keys) throw new BiliError('无法获取签名密钥', -1)
    setWbiKeys(keys)
  })().finally(() => {
    wbiInflight = null
  })
  return wbiInflight
}

async function signedGet<T>(
  path: string,
  params: Record<string, string | number | undefined>,
  referer = SPACE_REFERER,
): Promise<T> {
  await ensureWbi()
  let keys = cachedWbiKeys()
  if (!keys) throw new BiliError('签名密钥缺失', -1)
  let res = await httpRequest({ url: `${API}${path}?${signQuery(params, keys)}`, referer })
  if (res.status === 403 || /"code":-403/.test(res.text)) {
    clearWbiKeys()
    await ensureWbi()
    keys = cachedWbiKeys()!
    res = await httpRequest({ url: `${API}${path}?${signQuery(params, keys)}`, referer })
  }
  return parse<T>(res).data
}

/** 先走无需签名的旧路径，失败再走 WBI 路径。 */
async function resilientGet<T>(
  plainPath: string,
  wbiPath: string,
  params: Record<string, string | number | undefined>,
  referer = SPACE_REFERER,
): Promise<T> {
  try {
    return await plainGet<T>(plainPath, params, referer)
  } catch (err) {
    if (err instanceof BiliError && (RISK_CODES.has(err.code) || err.code === -412)) throw err
    return signedGet<T>(wbiPath, params, referer)
  }
}

/* ------------------------------------------------------------------ */
/* 账号                                                                */
/* ------------------------------------------------------------------ */

export interface NavData {
  isLogin: boolean
  mid: number
  uname: string
  money: number
  vipStatus: number
  wbi_img?: { img_url: string; sub_url: string }
}

export async function fetchNav(): Promise<NavData> {
  const res = await httpRequest({ url: `${API}/x/web-interface/nav`, referer: 'https://www.bilibili.com/' })
  const json = parse<NavData>(res, [-101])
  const keys = extractKeysFromNav(json)
  if (keys) setWbiKeys(keys)
  return json.data
}

export async function fetchFingerprint(): Promise<void> {
  try {
    const data = await plainGet<{ b_3: string; b_4: string }>('/x/frontend/finger/spi', {}, 'https://www.bilibili.com/')
    if (data?.b_3) {
      const secure = location.protocol === 'https:' ? '; Secure' : ''
      document.cookie = `buvid3=${data.b_3}; path=/; max-age=31536000${secure}`
      document.cookie = `buvid4=${data.b_4}; path=/; max-age=31536000${secure}`
      document.cookie = `b_nut=${Math.floor(Date.now() / 1000)}; path=/; max-age=31536000${secure}`
    }
  } catch {
    /* 指纹非必需 */
  }
}

export function readCookie(name: string): string {
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
  return m ? decodeURIComponent(m[1]) : ''
}

/* ------------------------------------------------------------------ */
/* 用户资料                                                            */
/* ------------------------------------------------------------------ */

export interface UserCard {
  mid: number
  name: string
  sign: string
  sex: string
  face: string
  level: number
  fans: number
  /** 0 正常, -2 被封禁 */
  spacesta: number
  birthday: string
  officialType: number
  officialTitle: string
  officialDesc: string
  officialRole: number
  vip: boolean
  archiveCount: number
  articleCount: number
  likeNum: number
  regtime: number
}

interface RawCard {
  mid: number | string
  name?: string
  sign?: string
  sex?: string
  face?: string
  level_info?: { current_level?: number }
  fans?: number
  spacesta?: number
  birthday?: string
  Official?: { type?: number; title?: string; desc?: string; role?: number }
  official_verify?: { type?: number; desc?: string }
  vip?: { status?: number; type?: number }
  regtime?: number
}

/** 无需 WBI / 登录，是 acc/info 的可靠替代。 */
export async function fetchUserCard(mid: number): Promise<UserCard> {
  const data = await plainGet<{
    card: RawCard
    following?: boolean
    archive_count?: number
    article_count?: number
    like_num?: number
  }>('/x/web-interface/card', { mid, photo: 'true' }, `${SPACE_REFERER}${mid}`)
  const c = data.card ?? ({} as RawCard)
  const ovType = c.official_verify?.type
  return {
    mid: Number(c.mid ?? mid),
    name: c.name ?? '',
    sign: c.sign ?? '',
    sex: c.sex ?? '',
    face: c.face ?? '',
    level: c.level_info?.current_level ?? 0,
    fans: c.fans ?? 0,
    spacesta: c.spacesta ?? 0,
    birthday: c.birthday ?? '',
    officialType: c.Official?.type ?? (ovType === 127 ? -1 : (ovType ?? -1)),
    officialTitle: c.Official?.title ?? '',
    officialDesc: c.Official?.desc ?? c.official_verify?.desc ?? '',
    officialRole: c.Official?.role ?? 0,
    vip: (c.vip?.status ?? 0) === 1,
    archiveCount: data.archive_count ?? 0,
    articleCount: data.article_count ?? 0,
    likeNum: data.like_num ?? 0,
    regtime: c.regtime ?? 0,
  }
}

export interface RelationState {
  /** 0 未关注 2 已关注 6 互关 128 拉黑 */
  attribute: number
  blocked: boolean
}

export async function fetchRelation(fid: number): Promise<RelationState> {
  const data = await plainGet<{ attribute?: number }>('/x/relation', { fid })
  const attribute = data.attribute ?? 0
  return { attribute, blocked: attribute === 128 }
}

export interface FollowingUser {
  mid: number
  uname: string
  sign: string
  officialVerify: number
}

/** 关注列表是判断「成分」的强信号。他人仅可见前 100。 */
export async function fetchFollowings(vmid: number, ps = 50): Promise<FollowingUser[]> {
  try {
    const data = await plainGet<{ list: Array<Record<string, unknown>> }>(
      '/x/relation/followings',
      { vmid, ps, pn: 1, order: 'desc', order_type: 'attention' },
      `${SPACE_REFERER}${vmid}/relation/follow`,
    )
    return (data.list ?? []).map((u) => {
      const ov = (u.official_verify ?? {}) as { type?: number }
      return {
        mid: Number(u.mid),
        uname: String(u.uname ?? ''),
        sign: String(u.sign ?? ''),
        officialVerify: Number(ov.type ?? -1),
      }
    })
  } catch {
    return []
  }
}

/* ------------------------------------------------------------------ */
/* 投稿视频                                                            */
/* ------------------------------------------------------------------ */

export interface SpaceVideo {
  aid: number
  bvid: string
  title: string
  description: string
  created: number
  partition: string
  play: number
  comment: number
}

export async function fetchSpaceVideos(
  mid: number,
  pn = 1,
  ps = 30,
): Promise<{ list: SpaceVideo[]; count: number }> {
  const data = await signedGet<{
    list: { vlist: Array<Record<string, unknown>>; tlist?: Record<string, { name?: string }> }
    page: { count: number }
  }>(
    '/x/space/wbi/arc/search',
    { mid, ps, pn, order: 'pubdate', tid: 0, keyword: '', platform: 'web', web_location: '1550101' },
    `${SPACE_REFERER}${mid}/video`,
  )
  const tlist = data.list?.tlist ?? {}
  return {
    list: (data.list?.vlist ?? []).map((v) => ({
      aid: Number(v.aid),
      bvid: String(v.bvid ?? ''),
      title: String(v.title ?? ''),
      description: String(v.description ?? ''),
      created: Number(v.created ?? 0),
      partition: tlist[String(v.typeid)]?.name ?? '',
      play: Number(v.play ?? 0),
      comment: Number(v.comment ?? 0),
    })),
    count: data.page?.count ?? 0,
  }
}

/* ------------------------------------------------------------------ */
/* 动态                                                                */
/* ------------------------------------------------------------------ */

export interface SpaceDynamic {
  id: string
  text: string
  ts: number
  url: string
}

interface DynamicModule {
  module_type?: string
  module_author?: { pub_ts?: number; user?: { mid?: number; name?: string } }
  module_dynamic?: {
    desc?: { text?: string }
    major?: {
      archive?: { title?: string; desc?: string }
      article?: { title?: string; desc?: string }
      opus?: { title?: string | null; summary?: { text?: string } }
      draw?: { items?: Array<{ description?: string }> }
    }
  }
}

/**
 * desktop 变体无需 WBI 与登录；注意 modules 是数组、作者在 module_author.user 内。
 */
export async function fetchSpaceDynamics(mid: number, pages = 2): Promise<SpaceDynamic[]> {
  const out: SpaceDynamic[] = []
  let offset = ''
  for (let i = 0; i < pages; i++) {
    const data = await plainGet<{ has_more: boolean; offset: string; items: Array<{ id_str: string; modules?: DynamicModule[] }> }>(
      '/x/polymer/web-dynamic/desktop/v1/feed/space',
      {
        host_mid: mid,
        offset,
        timezone_offset: -480,
        platform: 'web',
        features: 'itemOpusStyle,listOnlyfans,opusBigCover,onlyfansVote',
        page: i + 1,
      },
      `${SPACE_REFERER}${mid}/dynamic`,
    )
    for (const item of data.items ?? []) {
      const parts: string[] = []
      for (const mod of item.modules ?? []) {
        const dyn = mod.module_dynamic
        if (!dyn) continue
        if (dyn.desc?.text) parts.push(dyn.desc.text)
        const major = dyn.major
        if (major?.archive?.title) parts.push(major.archive.title, major.archive.desc ?? '')
        if (major?.article?.title) parts.push(major.article.title, major.article.desc ?? '')
        if (major?.opus) parts.push(major.opus.title ?? '', major.opus.summary?.text ?? '')
        for (const d of major?.draw?.items ?? []) if (d.description) parts.push(d.description)
      }
      const text = parts.filter(Boolean).join(' ').trim()
      if (text) {
        const author = item.modules?.find((m) => m.module_author)?.module_author
        out.push({
          id: item.id_str,
          text,
          ts: author?.pub_ts ?? 0,
          url: `https://www.bilibili.com/opus/${item.id_str}`,
        })
      }
    }
    if (!data.has_more || !data.offset) break
    offset = data.offset
  }
  return out
}

/* ------------------------------------------------------------------ */
/* 专栏                                                                */
/* ------------------------------------------------------------------ */

export interface SpaceArticle {
  id: number
  title: string
  summary: string
  publishTime: number
  words: number
  view: number
}

export async function fetchSpaceArticles(mid: number, pn = 1, ps = 30): Promise<SpaceArticle[]> {
  try {
    const data = await plainGet<{ articles: Array<Record<string, unknown>> }>(
      '/x/space/article',
      { mid, pn, ps, sort: 'publish_time' },
      `${SPACE_REFERER}${mid}/article`,
    )
    return (data.articles ?? []).map((a) => {
      const stats = (a.stats ?? {}) as { view?: number }
      return {
        id: Number(a.id),
        title: String(a.title ?? ''),
        summary: String(a.summary ?? ''),
        publishTime: Number(a.publish_time ?? 0),
        words: Number(a.words ?? 0),
        view: stats.view ?? 0,
      }
    })
  } catch {
    return []
  }
}

/* ------------------------------------------------------------------ */
/* 评论                                                                */
/* ------------------------------------------------------------------ */

export interface ReplyItem {
  rpid: number
  mid: number
  uname: string
  message: string
  like: number
  ctime: number
  isUp: boolean
}

interface RawReply {
  rpid: number
  mid?: number | string
  member?: { mid?: string; uname?: string }
  content?: { message?: string }
  like?: number
  ctime?: number
  replies?: RawReply[]
}

function toReply(raw: RawReply, upMid: number): ReplyItem | null {
  const mid = Number(raw.member?.mid ?? raw.mid ?? 0)
  const message = raw.content?.message ?? ''
  if (!mid || !message) return null
  return {
    rpid: raw.rpid,
    mid,
    uname: raw.member?.uname ?? '',
    message,
    like: raw.like ?? 0,
    ctime: raw.ctime ?? 0,
    isUp: mid === upMid,
  }
}

/**
 * 视频评论（含楼中楼）。
 * 签名版更稳定；未签名版目前可用但会被风控随机降级为 -352，故作为兜底。
 * 全站「按 mid 查评论」官方接口不存在，评论证据只能来自已扫描的评论区。
 */
export async function fetchVideoReplies(oid: number, upMid = 0, maxPages = 2, type = 1): Promise<ReplyItem[]> {
  const out: ReplyItem[] = []
  let next = 0
  for (let i = 0; i < maxPages; i++) {
    const params = { oid, type, mode: 3, next, ps: 20, web_location: '1315875' }
    let data: { replies: RawReply[] | null; cursor?: { is_end: boolean; next: number } }
    try {
      data = await signedGet(
        '/x/v2/reply/wbi/main',
        params,
        `https://www.bilibili.com/video/av${oid}`,
      )
    } catch {
      data = await plainGet(
        '/x/v2/reply/main',
        params,
        `https://www.bilibili.com/video/av${oid}`,
      )
    }
    for (const raw of data.replies ?? []) {
      const item = toReply(raw, upMid)
      if (item) out.push(item)
      for (const sub of raw.replies ?? []) {
        const s = toReply(sub, upMid)
        if (s) out.push(s)
      }
    }
    if (!data.cursor || data.cursor.is_end) break
    next = data.cursor.next
  }
  return out
}

/**
 * 第三方评论索引（aicu.cc）。
 * B 站官方不提供「按 mid 查全站评论」，这是唯一能覆盖历史评论的途径，
 * 但属非官方快照库，覆盖不全且可用性不稳定，因此默认关闭。
 */
export async function fetchIndexedReplies(mid: number, maxPages = 2): Promise<ReplyItem[]> {
  const out: ReplyItem[] = []
  let pn = 1
  for (let i = 0; i < maxPages; i++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 12000)
    try {
      const res = await fetch(
        `https://api.aicu.cc/api/v3/search/getreply?uid=${mid}&pn=${pn}&ps=100&mode=0&keyword=`,
        { signal: controller.signal },
      )
      if (!res.ok) break
      const json = (await res.json()) as {
        data?: { cursor?: { is_end?: boolean }; replies?: Array<{ rpid: string; message?: string; dyn?: { oid?: string } }> }
      }
      const list = json.data?.replies ?? []
      if (!list.length) break
      for (const r of list) {
        if (!r.message) continue
        out.push({
          rpid: Number(r.rpid) || 0,
          mid,
          uname: '',
          message: r.message,
          like: 0,
          ctime: 0,
          isUp: true,
        })
      }
      if (json.data?.cursor?.is_end) break
      pn++
    } catch {
      break
    } finally {
      clearTimeout(timer)
    }
    await new Promise((r) => setTimeout(r, 3000))
  }
  return out
}

/* ------------------------------------------------------------------ */
/* 搜索                                                                */
/* ------------------------------------------------------------------ */

export interface SearchVideo {
  aid: number
  bvid: string
  title: string
  description: string
  tag: string
  author: string
  mid: number
  pubdate: number
  partition: string
  play: number
}

export interface SearchUser {
  mid: number
  uname: string
  usign: string
  fans: number
  videos: number
  level: number
  officialVerify: number
}

function stripEm(html: string): string {
  return html
    .replace(/<\/?em[^>]*>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

/** 每页固定 20 条，page_size 会被忽略。 */
export async function searchType(
  searchTypeName: 'video' | 'bili_user' | 'article',
  keyword: string,
  page = 1,
  order?: string,
): Promise<Array<Record<string, unknown>>> {
  const params = { search_type: searchTypeName, keyword, page, order, web_location: '1430654' }
  const data = await resilientGet<{ result: Array<Record<string, unknown>> }>(
    '/x/web-interface/search/type',
    '/x/web-interface/wbi/search/type',
    params,
    SEARCH_REFERER,
  )
  return data.result ?? []
}

export async function searchVideos(keyword: string, page = 1, order = 'totalrank'): Promise<SearchVideo[]> {
  const result = await searchType('video', keyword, page, order)
  return result
    .filter((r) => r.mid)
    .map((r) => ({
      aid: Number(r.aid),
      bvid: String(r.bvid ?? ''),
      title: stripEm(String(r.title ?? '')),
      description: stripEm(String(r.description ?? '')),
      tag: stripEm(String(r.tag ?? '')),
      author: stripEm(String(r.author ?? '')),
      mid: Number(r.mid),
      pubdate: Number(r.pubdate ?? 0),
      partition: String(r.typename ?? ''),
      play: Number(r.play ?? 0),
    }))
}

export async function searchUsers(keyword: string, page = 1, order = 'fans'): Promise<SearchUser[]> {
  const result = await searchType('bili_user', keyword, page, order)
  return result
    .filter((r) => r.mid)
    .map((r) => {
      const ov = (r.official_verify ?? {}) as { type?: number }
      const t = Number(ov.type ?? 127)
      return {
        mid: Number(r.mid),
        uname: stripEm(String(r.uname ?? '')),
        usign: stripEm(String(r.usign ?? '')),
        fans: Number(r.fans ?? 0),
        videos: Number(r.videos ?? 0),
        level: Number(r.level ?? 0),
        officialVerify: t === 127 ? -1 : t,
      }
    })
}

/* ------------------------------------------------------------------ */
/* 关系与拉黑                                                          */
/* ------------------------------------------------------------------ */

export const ACT_BLOCK = 5
export const ACT_UNBLOCK = 6

export async function modifyRelation(fid: number, act: number, csrf: string): Promise<void> {
  await plainPost('/x/relation/modify', { fid, act, re_src: 11, csrf })
}

/** 批量接口只支持 act=1（关注）与 act=5（拉黑），返回失败的 mid。 */
export async function batchBlock(fids: number[], csrf: string): Promise<number[]> {
  const joined = fids.join(',')
  try {
    const env = await plainPost<{ failed_fids?: number[] }>(
      '/x/relation/batch/modify',
      { fids: joined, act: ACT_BLOCK, re_src: 11, csrf },
      SPACE_REFERER,
    )
    return env.data?.failed_fids ?? []
  } catch {
    const env = await plainPost<{ failed_fids?: number[] }>(
      '/x/relation/batch/modify',
      { fid: joined, act: ACT_BLOCK, re_src: 11, csrf },
      SPACE_REFERER,
    )
    return env.data?.failed_fids ?? []
  }
}

export interface BlackEntry {
  mid: number
  uname: string
  mtime: number
}

export async function fetchBlacklist(pn = 1, ps = 50): Promise<{ list: BlackEntry[]; total: number }> {
  const data = await plainGet<{ list: Array<Record<string, unknown>>; total?: number }>(
    '/x/relation/blacks',
    { pn, ps },
    `${SPACE_REFERER}${readCookie('DedeUserID')}/relation/blacklist`,
  )
  return {
    list: (data.list ?? []).map((e) => ({
      mid: Number(e.mid),
      uname: String(e.uname ?? ''),
      mtime: Number(e.mtime ?? 0),
    })),
    total: data.total ?? (data.list ?? []).length,
  }
}
