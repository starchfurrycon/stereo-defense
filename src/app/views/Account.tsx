import { useCallback, useEffect, useState } from 'react'
import { Alert, Btn, Field, Panel, Row, Rows, TextInput, cn } from '../ui'
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
        // 未登录是正常状态，用状态点表达即可，不弹告警
        setAccount({ ok: false, checked: true, mid: 0, uname: '', csrf })
        setMsg('')
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
  const linkIssue =
    mode === 'fetch' && location.hostname !== 'bilibili.com' && !location.hostname.endsWith('.bilibili.com')

  const status = account.ok ? '已登录' : account.checked ? '未登录' : '检测中'

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <Panel
        title="账号"
        right={
          <Btn onClick={check} disabled={busy}>
            {busy ? '检测中' : '重新检测'}
          </Btn>
        }
      >
        <div className="flex items-center gap-3.5">
          <span
            aria-hidden="true"
            className={cn(
              'flex h-4 w-4 shrink-0 items-center justify-center rounded-full',
              account.ok ? 'bg-ok/15' : account.checked ? 'bg-danger/15' : 'bg-line',
            )}
          >
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                account.ok ? 'bg-ok' : account.checked ? 'bg-danger' : 'bg-faint',
              )}
            />
          </span>
          <div className="min-w-0">
            <div className="truncate text-[19px] leading-tight font-medium tracking-[-0.015em] text-ink">
              {account.uname || '—'}
            </div>
            <div className="sd-mono mt-1 text-[12px] text-faint">{account.mid ? `UID ${account.mid}` : status}</div>
          </div>
        </div>

        {(msg || linkIssue) && (
          <div className="mt-4 grid gap-2">
            {msg && <Alert tone={account.ok ? 'accent' : 'danger'}>{msg}</Alert>}
            {linkIssue && <Alert tone="warn">当前页面无法直连接口，请在设置中填写转发地址</Alert>}
          </div>
        )}

        {transportError() && !msg && <div className="mt-4 text-[11.5px] text-faint">{transportError()}</div>}

        {!account.csrf && (
          <div className="mt-5 max-w-sm border-t border-line pt-4">
            <Field label="CSRF" hint="bili_jct">
              <TextInput
                value={account.csrf}
                onChange={(e) => setAccount({ csrf: e.target.value })}
                placeholder="bili_jct"
                spellCheck={false}
              />
            </Field>
          </div>
        )}
      </Panel>

      <Panel title="通道">
        <Rows>
          <Row label="模式">{mode === 'userscript' ? '脚本直连' : mode === 'proxy' ? '转发' : '直连'}</Row>
          <Row label="请求">{requestCount()}</Row>
          <Row label="CSRF">
            <span className={account.csrf ? 'text-ok' : 'text-danger'}>{account.csrf ? '就绪' : '缺失'}</span>
          </Row>
        </Rows>
      </Panel>
    </div>
  )
}
