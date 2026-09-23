import { useCallback, useEffect, useState } from 'react'
import { Btn, Field, Panel, TextInput } from '../ui'
import { useStore } from '../../lib/store'
import { fetchFingerprint, fetchNav, readCookie } from '../../lib/bili/api'
import { requestCount, transportError, transportMode } from '../../lib/bili/transport'

export function AccountView() {
  const account = useStore((s) => s.account)
  const setAccount = useStore((s) => s.setAccount)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const check = useCallback(async () => {
    setBusy(true)
    setMsg('')
    try {
      await fetchFingerprint()
      const nav = await fetchNav()
      const csrf = readCookie('bili_jct') || account.csrf
      if (!nav.isLogin) {
        setAccount({ ok: false, checked: true, mid: 0, uname: '', csrf })
        setMsg('未登录')
      } else {
        setAccount({ ok: true, checked: true, mid: nav.mid, uname: nav.uname, csrf })
      }
    } catch (err) {
      setAccount({ ok: false, checked: true })
      setMsg(err instanceof Error ? err.message : '检测失败')
    } finally {
      setBusy(false)
    }
  }, [account.csrf, setAccount])

  useEffect(() => {
    if (!account.checked) void check()
  }, [account.checked, check])

  const mode = transportMode()
  const linkIssue = mode === 'fetch' && location.hostname !== 'bilibili.com' && !location.hostname.endsWith('.bilibili.com')

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Panel
        title="账号"
        right={
          <Btn onClick={check} disabled={busy}>
            {busy ? '检测中' : '重新检测'}
          </Btn>
        }
      >
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <div>
            <div className="text-[11px] text-faint">状态</div>
            <div className={`sd-mono mt-0.5 text-[14px] ${account.ok ? 'text-accent' : 'text-danger'}`}>
              {account.ok ? '已登录' : account.checked ? '未登录' : '检测中'}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-faint">昵称</div>
            <div className="mt-0.5 text-[14px]">{account.uname || '—'}</div>
          </div>
          <div>
            <div className="text-[11px] text-faint">UID</div>
            <div className="sd-mono mt-0.5 text-[14px]">{account.mid || '—'}</div>
          </div>
        </div>

        {msg && <div className="mt-3 border border-danger/30 px-3 py-2 text-[12px] text-danger">{msg}</div>}
        {linkIssue && (
          <div className="mt-3 border border-warn/30 px-3 py-2 text-[12px] text-warn">
            当前页面无法直连接口，请在设置中填写转发地址
          </div>
        )}
        {transportError() && <div className="mt-2 text-[11px] text-faint">{transportError()}</div>}

        {!account.csrf && (
          <div className="mt-4 max-w-md">
            <Field label="CSRF" hint="bili_jct">
              <TextInput
                value={account.csrf}
                onChange={(e) => setAccount({ csrf: e.target.value })}
                placeholder="bili_jct"
              />
            </Field>
          </div>
        )}
      </Panel>

      <div className="grid content-start gap-3">
        <Panel title="通道">
          <div className="space-y-2 text-[12px]">
            <div className="flex justify-between">
              <span className="text-faint">模式</span>
              <span className="sd-mono">
                {mode === 'userscript' ? '脚本直连' : mode === 'proxy' ? '转发' : '直连'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-faint">请求</span>
              <span className="sd-mono">{requestCount()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-faint">CSRF</span>
              <span className={account.csrf ? 'text-accent' : 'text-danger'}>{account.csrf ? '就绪' : '缺失'}</span>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  )
}
