import { useState } from 'react'
import { Btn, Empty, Panel, Stat } from '../ui'
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
      setNote(`共 ${all.length}`)
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

  return (
    <div className="grid gap-4">
      <Panel
        title="黑名单"
        right={
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-faint">{note}</span>
            <Btn onClick={load} disabled={busy || !account.ok}>
              {busy ? '读取中' : '同步'}
            </Btn>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="已记录" value={blacklist.length} />
          <Stat label="本次执行" value={blacklist.filter((b) => b.score !== undefined).length} tone="accent" />
        </div>
      </Panel>

      <Panel title="列表">
        <div className="-mx-4 -mb-4 border-t border-line">
          {blacklist.length === 0 ? (
            <Empty>暂无记录</Empty>
          ) : (
            blacklist.map((b) => (
              <div key={b.mid} className="flex items-center gap-3 border-b border-line px-4 py-2 last:border-b-0">
                <a
                  href={`https://space.bilibili.com/${b.mid}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 truncate text-[13px] hover:text-accent"
                >
                  {b.uname || `UID ${b.mid}`}
                </a>
                <span className="sd-mono text-[11px] text-faint">{b.mid}</span>
                {b.score !== undefined && <span className="sd-mono text-[11px] text-accent">{b.score.toFixed(2)}</span>}
                <Btn tone="ghost" onClick={() => unblock(b.mid)} disabled={busy}>
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
