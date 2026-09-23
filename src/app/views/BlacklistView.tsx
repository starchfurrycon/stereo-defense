import { useState } from 'react'
import { Alert, Btn, Empty, Panel, Stat } from '../ui'
import { useStore } from '../../lib/store'
import { ACT_UNBLOCK, fetchBlacklist, modifyRelation } from '../../lib/bili/api'

export function BlacklistView() {
  const blacklist = useStore((s) => s.blacklist)
  const setBlacklist = useStore((s) => s.setBlacklist)
  const account = useStore((s) => s.account)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  const load = async () => {
    setBusy(true)
    setNote('')
    try {
      const all: typeof blacklist = []
      for (let pn = 1; pn <= 20; pn++) {
        const { list, total } = await fetchBlacklist(pn, 50)
        all.push(...list)
        if (all.length >= total || list.length < 50) break
      }
      setBlacklist(all)
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
      setBlacklist(blacklist.filter((b) => b.mid !== mid))
    } catch (err) {
      setNote(err instanceof Error ? err.message : '操作失败')
    } finally {
      setBusy(false)
    }
  }

  const executed = blacklist.filter((b) => b.score !== undefined).length

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="已记录" value={blacklist.length} />
        <Stat label="本次执行" value={executed} tone={executed ? 'accent' : 'dim'} />
      </div>

      {note && <Alert tone="danger">{note}</Alert>}

      <Panel
        title="列表"
        count={blacklist.length || undefined}
        flush
        right={
          <Btn size="sm" onClick={load} disabled={busy || !account.ok}>
            {busy ? '读取中' : '同步'}
          </Btn>
        }
      >
        <div className="border-t border-line">
          {blacklist.length === 0 ? (
            <Empty>暂无记录</Empty>
          ) : (
            blacklist.map((b) => (
              <div
                key={b.mid}
                className="flex items-center gap-4 border-b border-line px-4 py-2.5 transition-colors last:border-b-0 hover:bg-raise/60"
              >
                <a
                  href={`https://space.bilibili.com/${b.mid}`}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 flex-1 truncate text-[13px] text-ink transition-colors hover:text-accent"
                >
                  {b.uname || `UID ${b.mid}`}
                </a>
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
    </div>
  )
}
