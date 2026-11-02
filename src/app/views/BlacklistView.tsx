import { useRef, useState } from 'react'
import { Alert, Btn, Empty, Panel, Row, Rows, Stat, Tag } from '../ui'
import { useStore } from '../../lib/store'
import { ACT_UNBLOCK, batchBlock, blockCapacity, fetchBlacklist, modifyRelation } from '../../lib/bili/api'
import { FAMILY_MAP } from '../../lib/analyze/families'
import type { BlackEntry } from '../../lib/types'

function chunksOf<T>(list: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

/** 名单交换格式：mid 唯一，uname 只是拉黑时的快照，reason/date/source 可追溯。 */
interface ExchangeEntry {
  mid: number
  uname?: string
  reason?: string
  family?: string
  date?: string
  source?: string
}

function toExchange(entries: BlackEntry[]): ExchangeEntry[] {
  return entries.map((e) => ({
    mid: e.mid,
    uname: e.uname,
    family: e.family,
    reason: e.score !== undefined ? `判定分 ${(e.score * 100).toFixed(0)}` : e.origin === 'import' ? '导入名单' : '手动',
    date: new Date(e.mtime * 1000).toISOString().slice(0, 10),
    source: 'stereo-defense',
  }))
}

/** 兼容三种输入：JSON 数组、纯 UID 列表、空间链接列表。 */
function parseImport(text: string): ExchangeEntry[] {
  const trimmed = text.trim()
  if (!trimmed) return []
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const raw = JSON.parse(trimmed) as ExchangeEntry[] | ExchangeEntry | { list?: ExchangeEntry[] }
      const list = Array.isArray(raw) ? raw : 'list' in raw && raw.list ? raw.list : [raw as ExchangeEntry]
      return list.filter((e) => Number(e.mid) > 0).map((e) => ({ ...e, mid: Number(e.mid) }))
    } catch {
      /* 落到按行解析 */
    }
  }
  const out: ExchangeEntry[] = []
  for (const line of trimmed.split(/[\n,，\s]+/)) {
    const match = line.match(/(\d{3,})/)
    if (match) out.push({ mid: Number(match[1]) })
  }
  return out
}

export function BlacklistView() {
  const blacklist = useStore((s) => s.blacklist)
  const setBlacklist = useStore((s) => s.setBlacklist)
  const addBlacklist = useStore((s) => s.addBlacklist)
  const removeBlacklist = useStore((s) => s.removeBlacklist)
  const account = useStore((s) => s.account)
  const setAccount = useStore((s) => s.setAccount)
  const lastBatch = useStore((s) => s.lastBatch)
  const setCandidates = useStore((s) => s.setCandidates)
  const candidates = useStore((s) => s.candidates)
  const ignored = useStore((s) => s.ignored)
  const setIgnored = useStore((s) => s.setIgnored)

  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [importText, setImportText] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    setBusy(true)
    setNote('')
    try {
      const all: BlackEntry[] = []
      for (let pn = 1; pn <= 40; pn++) {
        const { list, total } = await fetchBlacklist(pn, 50)
        all.push(...list.map((e) => ({ ...e, origin: 'manual' as const })))
        if (all.length >= total || list.length < 50) break
      }
      setBlacklist(all)
      setAccount({ blockedTotal: all.length })
    } catch (err) {
      setNote(err instanceof Error ? err.message : '读取失败')
    } finally {
      setBusy(false)
    }
  }

  const unblock = async (mid: number) => {
    if (!account.csrf) {
      setNote('缺少 CSRF')
      return
    }
    setBusy(true)
    try {
      await modifyRelation(mid, ACT_UNBLOCK, account.csrf)
      removeBlacklist([mid])
      setAccount({ blockedTotal: Math.max(0, account.blockedTotal - 1) })
    } catch (err) {
      setNote(err instanceof Error ? err.message : '操作失败')
    } finally {
      setBusy(false)
    }
  }

  const rollback = async () => {
    if (!account.csrf || !lastBatch.length) return
    setBusy(true)
    setNote('')
    let done = 0
    const stuck: number[] = []
    // 批量解除没有官方接口，只能逐条，靠限速器拉开间隔
    for (const mid of lastBatch) {
      setNote(`撤销 ${++done}/${lastBatch.length}`)
      try {
        await modifyRelation(mid, ACT_UNBLOCK, account.csrf)
        removeBlacklist([mid])
      } catch {
        stuck.push(mid)
      }
    }
    setCandidates(candidates.map((c) => (lastBatch.includes(c.mid) ? { ...c, blocked: false } : c)))
    useStore.getState().setLastBatch(stuck)
    setNote(stuck.length ? `${stuck.length} 个未能撤销` : '已撤销上一批')
    setBusy(false)
  }

  const exportList = () => {
    const data = JSON.stringify(toExchange(blacklist), null, 2)
    void navigator.clipboard?.writeText(data)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `defense-blacklist-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setNote('已导出并复制到剪贴板')
  }

  const importList = () => {
    const entries = parseImport(importText)
    if (!entries.length) {
      setNote('没解析出 UID')
      return
    }
    const stamp = Math.floor(Date.now() / 1000)
    addBlacklist(
      entries.map((e) => ({
        mid: e.mid,
        uname: e.uname ?? '',
        mtime: stamp,
        family: e.family as BlackEntry['family'],
        origin: 'import' as const,
      })),
    )
    setImportText('')
    setNote(`已导入 ${entries.length} 个到本地名单`)
  }

  /** 名单最实用的用法是「粘贴一批 UID 直接拉黑」，和拉黑扩展的流程一致。 */
  const importAndBlock = async () => {
    if (!account.csrf) {
      setNote('缺少 CSRF，请先登录')
      return
    }
    const entries = parseImport(importText)
    if (!entries.length) {
      setNote('没解析出 UID')
      return
    }
    setBusy(true)
    const failed: number[] = []
    let done = 0
    const stamp = Math.floor(Date.now() / 1000)
    for (const group of chunksOf(entries.map((e) => e.mid), 20)) {
      setNote(`拉黑 ${done}/${entries.length}`)
      try {
        const bad = await batchBlock(group, account.csrf)
        failed.push(...bad)
      } catch {
        failed.push(...group)
      }
      done += group.length
    }
    const bad = new Set(failed)
    const ok = entries.filter((e) => !bad.has(e.mid))
    addBlacklist(
      ok.map((e) => ({
        mid: e.mid,
        uname: e.uname ?? '',
        mtime: stamp,
        family: e.family as BlackEntry['family'],
        origin: 'import' as const,
      })),
    )
    setAccount({ blockedTotal: account.blockedTotal + ok.length })
    setImportText('')
    setNote(failed.length ? `拉黑 ${ok.length} 个，失败 ${failed.length} 个` : `已拉黑 ${ok.length} 个`)
    setBusy(false)
  }

  const executed = blacklist.filter((b) => b.origin === 'scan').length
  const capacity = blockCapacity(account.level, 0)

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="本地记录" value={blacklist.length} />
        <Stat label="扫描拉黑" value={executed} tone={executed ? 'accent' : 'dim'} />
        <Stat label="线上总数" value={account.blockedTotal} />
        <Stat
          label="剩余容量"
          value={Math.max(0, capacity - account.blockedTotal)}
          hint={`上限约 ${capacity}`}
          tone={capacity - account.blockedTotal < 50 ? 'warn' : 'dim'}
        />
      </div>

      {note && <Alert tone="accent">{note}</Alert>}

      <Panel
        title="名单"
        count={blacklist.length || undefined}
        flush
        right={
          <>
            <Btn size="sm" onClick={load} disabled={busy || !account.ok}>
              {busy ? '读取中' : '同步线上'}
            </Btn>
            <Btn size="sm" variant="ghost" onClick={exportList} disabled={!blacklist.length}>
              导出
            </Btn>
            <Btn size="sm" variant="ghost" onClick={() => fileRef.current?.click()} disabled={busy}>
              读文件
            </Btn>
            <input
              ref={fileRef}
              type="file"
              accept=".json,.txt"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                setImportText(await file.text())
                e.target.value = ''
              }}
            />
          </>
        }
      >
        <div className="border-t border-line">
          {blacklist.length === 0 ? (
            <Empty>暂无记录</Empty>
          ) : (
            blacklist.slice(0, 500).map((b) => (
              <div
                key={b.mid}
                className="flex items-center gap-3 border-b border-line px-4 py-2.5 transition-colors last:border-b-0 hover:bg-raise/60"
              >
                <a
                  href={`https://space.bilibili.com/${b.mid}`}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 flex-1 truncate text-[13px] text-ink transition-colors hover:text-accent"
                >
                  {b.uname || `UID ${b.mid}`}
                </a>
                {b.family && <Tag>{FAMILY_MAP.get(b.family)?.label ?? b.family}</Tag>}
                {b.origin === 'import' && <Tag tone="dim">导入</Tag>}
                <span className="sd-mono shrink-0 text-[11px] text-faint">{b.mid}</span>
                {b.score !== undefined && (
                  <span className="sd-mono w-8 shrink-0 text-right text-[12px] text-accent">
                    {(b.score * 100).toFixed(0)}
                  </span>
                )}
                <Btn size="sm" variant="ghost" onClick={() => unblock(b.mid)} disabled={busy}>
                  解除
                </Btn>
              </div>
            ))
          )}
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="导入">
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={6}
            placeholder={'支持 JSON 数组、纯 UID 列表、空间链接，例如：\n12345678\nhttps://space.bilibili.com/87654321'}
            className="sd-inset sd-focusable w-full resize-y px-2.5 py-2 text-[13px] leading-[1.7] text-ink placeholder:text-faint"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Btn size="sm" onClick={importList} disabled={!importText.trim()}>
              加入本地名单
            </Btn>
            <Btn size="sm" variant="primary" onClick={importAndBlock} disabled={busy || !importText.trim()}>
              直接拉黑
            </Btn>
            <span className="text-[11px] text-faint">「直接拉黑」每 20 个一批调用批量接口，不需要先扫描。</span>
          </div>
        </Panel>

        <Panel title="回滚与清理">
          <Rows>
            <Row label="上一批拉黑">{lastBatch.length}</Row>
            <Row label="已忽略">{ignored.length}</Row>
          </Rows>
          <div className="mt-4 flex flex-wrap gap-2">
            <Btn size="sm" onClick={rollback} disabled={busy || !lastBatch.length || !account.csrf}>
              撤销上一批
            </Btn>
            <Btn
              size="sm"
              variant="ghost"
              onClick={() => {
                setIgnored([])
              }}
            >
              清空忽略
            </Btn>
            <Btn
              size="sm"
              variant="danger"
              onClick={() => {
                setBlacklist([])
                setCandidates([])
                setAccount({ blockedTotal: 0 })
              }}
            >
              清空本地记录
            </Btn>
          </div>
          <div className="mt-3 text-[11px] leading-relaxed text-faint">
            批量解除没有官方接口，只能逐条调用，撤销 100 条约需 2 分钟。线上黑名单本身不会因为清空本地记录而变化。
          </div>
        </Panel>
      </div>
    </div>
  )
}
