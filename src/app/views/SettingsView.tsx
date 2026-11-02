import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Btn, Field, Panel, Row, Rows, Select, Switch, Tag, TextInput, cn } from '../ui'
import { useStore } from '../../lib/store'
import { fetchFingerprint, fetchNav, readCookie } from '../../lib/bili/api'
import { requestCount, transportError, transportMode } from '../../lib/bili/transport'
import { setProxyPrefix } from '../../lib/bili/transport'
import { lookupPrice } from '../../lib/llm/pricing'
import { calibrate, calibrateSignals } from '../../lib/analyze/calibrate'
import { enabledFamilies } from '../../lib/verdict'
import { demoCandidates } from '../../lib/demo'

const PRESETS = [
  { label: 'OpenAI', url: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { label: 'DeepSeek', url: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { label: '阿里云百炼', url: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  { label: '智谱', url: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
  { label: '月之暗面', url: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
  { label: 'OpenRouter', url: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini' },
  { label: '自定义', url: '', model: '' },
] as const

type PresetLabel = (typeof PRESETS)[number]['label']

function pct(n: number): string {
  return `${(n * 100).toFixed(0)}%`
}

export function SettingsView() {
  const settings = useStore((s) => s.settings)
  const setLlm = useStore((s) => s.setLlm)
  const setSettings = useStore((s) => s.setSettings)
  const usage = useStore((s) => s.usage)
  const account = useStore((s) => s.account)
  const setAccount = useStore((s) => s.setAccount)
  const targets = useStore((s) => s.targets)

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

  const families = useMemo(() => enabledFamilies(targets.modes), [targets.modes])
  const calibration = useMemo(() => calibrate(families, targets.modes), [families, targets.modes])
  const signals = useMemo(() => calibrateSignals(targets.modes), [targets.modes])

  const price = lookupPrice(settings.llm.model)
  const preset: PresetLabel = PRESETS.find((p) => p.url === settings.llm.baseUrl)?.label ?? '自定义'
  const mode = transportMode()
  const linkIssue =
    mode === 'fetch' && location.hostname !== 'bilibili.com' && !location.hostname.endsWith('.bilibili.com')

  const recall = calibration.targetTotal ? calibration.targetCaught / calibration.targetTotal : 0
  const falseRate = calibration.negativeTotal ? calibration.negativeHit / calibration.negativeTotal : 0

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel
        title="账号"
        right={
          <Btn size="sm" onClick={check} disabled={busy}>
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
            <span className={cn('h-1.5 w-1.5 rounded-full', account.ok ? 'bg-ok' : account.checked ? 'bg-danger' : 'bg-faint')} />
          </span>
          <div className="min-w-0">
            <div className="truncate text-[17px] leading-tight font-medium tracking-[-0.015em] text-ink">
              {account.uname || '—'}
            </div>
            <div className="sd-mono mt-1 text-[12px] text-faint">
              {account.mid ? `UID ${account.mid}` : account.ok ? '已登录' : '未登录'}
            </div>
          </div>
        </div>

        {(msg || linkIssue) && (
          <div className="mt-4 grid gap-2">
            {msg && <Alert tone={account.ok ? 'accent' : 'danger'}>{msg}</Alert>}
            {linkIssue && <Alert tone="warn">当前页面无法直连接口，请在「通道」里填写转发地址</Alert>}
          </div>
        )}

        <div className="mt-4">
          <Rows>
            <Row label="通道">{mode === 'userscript' ? '脚本直连' : mode === 'proxy' ? '转发' : '直连'}</Row>
            <Row label="请求">{requestCount()}</Row>
            <Row label="CSRF">
              <span className={account.csrf ? 'text-ok' : 'text-danger'}>{account.csrf ? '就绪' : '缺失'}</span>
            </Row>
            <Row label="线上黑名单">{account.blockedTotal}</Row>
          </Rows>
        </div>

        {!account.csrf && (
          <div className="mt-4 border-t border-line pt-4">
            <Field label="CSRF" hint="bili_jct">
              <TextInput value={account.csrf} onChange={(e) => setAccount({ csrf: e.target.value })} spellCheck={false} />
            </Field>
          </div>
        )}
        {transportError() && !msg && <div className="mt-3 text-[11.5px] text-faint">{transportError()}</div>}
      </Panel>

      <Panel
        title="判定自检"
        right={
          <Tag tone={falseRate <= 0.05 ? 'ok' : 'warn'}>
            召回 {pct(recall)} · 误伤 {pct(falseRate)}
          </Tag>
        }
      >
        <div className="divide-y divide-line">
          {calibration.families.map((row) => {
            const mode = targets.modes[row.family]
            const watched = mode === 'watch'
            return (
              <div key={row.family} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                <span className="w-[86px] shrink-0 truncate text-[12px] text-dim">{row.label}</span>
                <span className={cn('sd-mono w-[52px] shrink-0 text-right text-[12px]', watched ? 'text-faint' : 'text-ink')}>
                  {row.targets ? pct(row.caught / row.targets) : '—'}
                </span>
                <span className="sd-mono w-[42px] shrink-0 text-right text-[11px] text-faint">
                  {row.targets ? `${row.caught}/${row.targets}` : '—'}
                </span>
                <span className="min-w-0 flex-1 text-[11px] text-faint">
                  {watched
                    ? '只标记，不会建议拉黑'
                    : row.targets === 0
                      ? '结构判定，见下方'
                      : row.missed.length
                        ? `漏 ${row.missed.length} 条（多为边缘）`
                        : '全部命中'}
                </span>
              </div>
            )
          })}
        </div>

        <div className="mt-4 border-t border-line pt-3">
          <div className="mb-2 text-[11.5px] text-faint">
            结构信号 {signals.hits}/{signals.total}，误伤 {signals.falseHits}/{signals.negatives}。样本共{' '}
            {calibration.targetTotal} 条正例 / {calibration.negativeTotal} 条反例。
          </div>

          {calibration.falseHits.length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] font-medium text-warn">被误伤的反例</div>
              {calibration.falseHits.slice(0, 6).map((f, i) => (
                <div key={i} className="border-l border-warn/40 pl-2.5">
                  <div className="text-[11.5px] text-dim">{f.text}</div>
                  <div className="mt-0.5 text-[10.5px] text-faint">
                    {f.label} · {f.score.toFixed(2)} · {f.reason}
                  </div>
                </div>
              ))}
            </div>
          )}

          {calibration.targetTotal > 0 && calibration.families.every((r) => r.caught === r.targets) && (
            <div className="text-[11px] text-faint">样本库全部命中。样本是内置的，真实数据仍建议先小范围跑。</div>
          )}
        </div>
      </Panel>

      <Panel title="模型（可选）">
        <div className="grid gap-4">
          <div className="text-[11.5px] leading-relaxed text-faint">
            判定本身完全离线，不需要模型。配置 API 只是为了在「复核」里让模型裁决边界候选。
          </div>
          <Field label="服务">
            <Select
              value={preset}
              options={PRESETS.map((p) => ({ value: p.label, label: p.label }))}
              onChange={(label) => {
                const p = PRESETS.find((x) => x.label === label)
                if (p && p.url) setLlm({ baseUrl: p.url, model: p.model })
              }}
            />
          </Field>
          <Field label="地址">
            <TextInput value={settings.llm.baseUrl} onChange={(e) => setLlm({ baseUrl: e.target.value })} spellCheck={false} />
          </Field>
          <Field label="密钥">
            <TextInput
              type="password"
              value={settings.llm.apiKey}
              onChange={(e) => setLlm({ apiKey: e.target.value })}
              spellCheck={false}
              autoComplete="off"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="模型">
              <TextInput value={settings.llm.model} onChange={(e) => setLlm({ model: e.target.value })} spellCheck={false} />
            </Field>
            <Field label="输入单价" hint="$/百万">
              <TextInput
                type="number"
                step="0.01"
                value={settings.llm.priceInput ?? ''}
                placeholder={price ? String(price.input) : '0'}
                onChange={(e) => setLlm({ priceInput: e.target.value === '' ? undefined : Number(e.target.value) })}
              />
            </Field>
          </div>
          {usage && (
            <div className="border-t border-line pt-3">
              <Rows>
                <Row label="累计 token">{usage.totalTokens.toLocaleString()}</Row>
                <Row label="调用">{usage.calls}</Row>
              </Rows>
            </div>
          )}
        </div>
      </Panel>

      <div className="grid content-start gap-4">
        <Panel title="通道">
          <div className="grid gap-4">
            <Field label="转发地址" hint="静态页面版才需要">
              <TextInput
                value={settings.proxy}
                onChange={(e) => {
                  setSettings({ proxy: e.target.value })
                  setProxyPrefix(e.target.value)
                }}
                placeholder="https://"
                spellCheck={false}
              />
            </Field>
            <Field label="并发" hint="1-4">
              <TextInput
                type="number"
                min={1}
                max={4}
                value={settings.concurrency}
                onChange={(e) => setSettings({ concurrency: Math.max(1, Math.min(4, Number(e.target.value) || 1)) })}
              />
            </Field>
            <div className="border-t border-line pt-3">
              <Switch checked={settings.aiReview} onChange={(v) => setSettings({ aiReview: v })} label="边界候选自动复核" />
            </div>
            <div className="text-[11px] leading-relaxed text-faint">
              同一出口 IP 连续约 25 次请求就会触发 -412，冷却 60-90 秒。并发越高越容易撞风控。
            </div>
          </div>
        </Panel>

        <Panel title="数据">
          <div className="flex flex-wrap gap-2">
            <Btn
              onClick={() => {
                useStore.getState().setCandidates(demoCandidates(targets))
                useStore.getState().setTab('review')
              }}
            >
              载入演示结果
            </Btn>
            <Btn
              variant="danger"
              onClick={() => {
                useStore.getState().setCandidates([])
                useStore.getState().setIgnored([])
              }}
            >
              清空扫描结果
            </Btn>
            <Btn
              variant="danger"
              onClick={() => {
                useStore.getState().setBlacklist([])
                useStore.getState().setLastBatch([])
                useStore.getState().addUsage(null)
              }}
            >
              清空本地名单
            </Btn>
          </div>
          <div className="mt-3 text-[11px] leading-relaxed text-faint">
            所有判定与名单都只存在本地（脚本存储 / localStorage），不上传任何服务器。
          </div>
        </Panel>
      </div>
    </div>
  )
}
