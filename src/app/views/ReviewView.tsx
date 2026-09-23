import { useMemo, useState, type CSSProperties } from 'react'
import { Alert, Btn, Checkbox, Empty, Icon, Meter, Panel, Segmented, Stat, Tag, cn } from '../ui'
import { useStore } from '../../lib/store'
import { ACT_BLOCK, batchBlock, modifyRelation } from '../../lib/bili/api'
import { applyThresholds } from '../../lib/analyze/score'
import { arbitrate } from '../../lib/llm/provider'
import { ARBITER_SYSTEM, arbiterUserPrompt } from '../../lib/llm/prompt'
import { SOURCE_LABEL, type Candidate } from '../../lib/types'

function chunks<T>(list: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

function formatFans(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`
  return String(n)
}

function scoreTone(score: number): string {
  if (score >= 0.72) return 'text-accent'
  if (score >= 0.42) return 'text-warn'
  return 'text-dim'
}

function Row({ c, selected, onToggle }: { c: Candidate; selected: boolean; onToggle: () => void }) {
  const [open, setOpen] = useState(false)
  const sources = useMemo(() => [...new Set(c.evidences.map((e) => e.source))], [c.evidences])

  return (
    <div className={cn('border-b border-line transition-colors last:border-b-0', selected && 'bg-accent/[0.045]')}>
      <div className="flex items-start gap-3 px-4 py-3">
        <Checkbox checked={selected} onChange={onToggle} className="mt-[3px]" />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <a
              href={`https://space.bilibili.com/${c.mid}`}
              target="_blank"
              rel="noreferrer"
              className="text-[13.5px] font-medium text-ink transition-colors hover:text-accent"
            >
              {c.uname || `UID ${c.mid}`}
            </a>
            <span className="sd-mono text-[11px] text-faint">{c.mid}</span>
            {c.fans ? <span className="sd-mono text-[11px] text-faint">{formatFans(c.fans)} 粉</span> : null}
            {c.blocked && <Tag tone="ok">已拉黑</Tag>}
            {c.flags.map((f) => (
              <Tag key={f} tone={f === '命中白名单' || f === '机构认证' ? 'danger' : 'warn'}>
                {f}
              </Tag>
            ))}
          </div>

          {c.sign && <div className="mt-1 truncate text-[12px] text-dim">{c.sign}</div>}

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {sources.map((s) => (
              <Tag key={s}>{SOURCE_LABEL[s]}</Tag>
            ))}
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="ml-0.5 inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] text-faint transition-colors hover:bg-raise hover:text-dim"
            >
              <Icon name={open ? 'chevronDown' : 'chevronRight'} size={11} />
              依据 {c.evidences.length}
            </button>
          </div>
        </div>

        <div className="flex w-[86px] shrink-0 flex-col items-end gap-2 pt-px">
          <span className={cn('sd-mono text-[17px] leading-none font-medium tracking-[-0.02em]', scoreTone(c.score))}>
            {(c.score * 100).toFixed(0)}
          </span>
          <Meter value={c.score} width={78} showValue={false} />
        </div>
      </div>

      {open && (
        <div className="space-y-2 px-4 pb-4 pl-[46px]">
          {c.evidences.slice(0, 6).map((e, i) => (
            <div key={i} className="border-l border-line2 pl-3">
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <Tag tone={e.score >= 0.72 ? 'accent' : 'dim'}>{SOURCE_LABEL[e.source]}</Tag>
                <span className="sd-mono text-faint">
                  {e.score.toFixed(2)} · 词 {(e.lexical * 100).toFixed(0)} · 义 {(e.semantic * 100).toFixed(0)}
                </span>
                {e.hits.length > 0 && <span className="text-accent">{e.hits.join(' ')}</span>}
                {e.guardHits.length > 0 && <span className="text-warn">反驳 {e.guardHits.slice(0, 3).join(' ')}</span>}
              </div>
              <div className="mt-1 text-[12px] leading-relaxed break-all text-dim">{e.text}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function ReviewView() {
  const candidates = useStore((s) => s.candidates)
  const setCandidates = useStore((s) => s.setCandidates)
  const patchCandidate = useStore((s) => s.patchCandidate)
  const thresholds = useStore((s) => s.settings.thresholds)
  const setThresholds = useStore((s) => s.setThresholds)
  const account = useStore((s) => s.account)
  const addBlacklist = useStore((s) => s.addBlacklist)
  const ignored = useStore((s) => s.ignored)
  const setIgnored = useStore((s) => s.setIgnored)
  const llm = useStore((s) => s.settings.llm)
  const aiReview = useStore((s) => s.settings.aiReview)
  const setSettings = useStore((s) => s.setSettings)
  const profile = useStore((s) => s.profile)
  const addUsage = useStore((s) => s.addUsage)

  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [filter, setFilter] = useState<'all' | 'block' | 'review'>('all')

  const shown = useMemo(() => {
    const list = candidates.filter((c) => (filter === 'all' ? c.verdict !== 'skip' : c.verdict === filter))
    return list.sort((a, b) => b.score - a.score)
  }, [candidates, filter])

  const toggle = (mid: number) => {
    const next = new Set(selected)
    if (next.has(mid)) next.delete(mid)
    else next.add(mid)
    setSelected(next)
  }

  const selectAll = () => {
    if (selected.size === shown.length) setSelected(new Set())
    else setSelected(new Set(shown.map((c) => c.mid)))
  }

  const changeThresholds = (patch: Partial<typeof thresholds>) => {
    const next = { ...thresholds, ...patch }
    if (next.review > next.block - 0.05) {
      if (patch.block !== undefined) next.review = Math.max(0, next.block - 0.05)
      else next.block = Math.min(1, next.review + 0.05)
    }
    setThresholds(next)
    // 复制一份再重新判定，避免直接改动 store 里的对象
    const updated = candidates.map((c) => ({ ...c }))
    applyThresholds(updated, next)
    setCandidates(updated)
  }

  const runArbitration = async () => {
    if (!profile) return
    const targets = candidates.filter((c) => selected.has(c.mid) || c.verdict === 'review').slice(0, 40)
    if (!targets.length) return
    setBusy(true)
    setNote('')
    let done = 0
    for (const c of targets) {
      setNote(`复核 ${++done}/${targets.length}`)
      try {
        const snippets = c.evidences.slice(0, 8).map((e) => e.text)
        const res = await arbitrate(llm, ARBITER_SYSTEM, arbiterUserPrompt(profile, c.uname, c.sign, snippets))
        addUsage(res.usage)
        if (res.decision === 'pass') {
          patchCandidate(c.mid, {
            verdict: 'skip',
            score: Math.min(c.score, thresholds.review - 0.01),
            flags: [...c.flags, 'AI 排除'],
          })
        } else if (res.decision === 'block') {
          patchCandidate(c.mid, {
            verdict: 'block',
            score: Math.max(c.score, thresholds.block + 0.02),
            flags: [...c.flags, 'AI 确认'],
          })
        } else {
          patchCandidate(c.mid, { flags: [...c.flags, 'AI 存疑'] })
        }
      } catch (err) {
        setNote(err instanceof Error ? err.message : '复核失败')
        break
      }
    }
    setBusy(false)
    setNote('')
  }

  const execute = async (mids: number[]) => {
    if (!account.csrf) {
      setNote('缺少 CSRF')
      return
    }
    setBusy(true)
    const failed = new Set<number>()
    let done = 0
    for (const group of chunks(mids, 20)) {
      setNote(`拉黑 ${done}/${mids.length}`)
      try {
        const f = await batchBlock(group, account.csrf)
        for (const m of f) failed.add(m)
      } catch {
        for (const m of group) {
          try {
            await modifyRelation(m, ACT_BLOCK, account.csrf)
          } catch {
            failed.add(m)
          }
        }
      }
      done += group.length
    }
    const ok = mids.filter((m) => !failed.has(m))
    addBlacklist(
      ok.map((m) => ({
        mid: m,
        uname: candidates.find((c) => c.mid === m)?.uname ?? '',
        mtime: Math.floor(Date.now() / 1000),
        score: candidates.find((c) => c.mid === m)?.score,
      })),
    )
    for (const m of ok) patchCandidate(m, { blocked: true })
    setSelected(new Set())
    setNote(failed.size ? `${failed.size} 个失败` : '')
    setBusy(false)
  }

  const ignoreSelected = () => {
    setIgnored([...new Set([...ignored, ...selected])])
    setSelected(new Set())
  }

  const allowSelected = () => {
    if (!profile) return
    const names = candidates.filter((c) => selected.has(c.mid)).map((c) => c.uname).filter(Boolean)
    useStore.getState().setProfile({ ...profile, allow: [...new Set([...profile.allow, ...names])] })
    for (const c of candidates)
      if (selected.has(c.mid)) patchCandidate(c.mid, { score: 0, verdict: 'skip', flags: [...c.flags, '命中白名单'] })
    setSelected(new Set())
  }

  if (!candidates.length) {
    return (
      <Panel title="复核">
        <Empty>暂无结果</Empty>
      </Panel>
    )
  }

  const blockCount = candidates.filter((c) => c.verdict === 'block').length
  const reviewCount = candidates.filter((c) => c.verdict === 'review').length
  const fill = (v: number) => ({ '--sd-fill': `${v * 100}%` }) as CSSProperties

  return (
    <div className="grid gap-4 pb-2">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="候选" value={candidates.length} />
        <Stat label="建议拉黑" value={blockCount} tone="accent" />
        <Stat label="待复核" value={reviewCount} tone="warn" />
        <Stat label="已选" value={selected.size} tone={selected.size ? 'ink' : 'dim'} />
      </div>

      <Panel title="阈值">
        <div className="mb-5 flex h-7 overflow-hidden rounded-md border border-line text-[10.5px]">
          <div className="flex items-center justify-center text-faint" style={{ width: `${thresholds.review * 100}%` }}>
            忽略
          </div>
          <div
            className="flex items-center justify-center border-x border-line bg-warn/[0.09] text-warn"
            style={{ width: `${(thresholds.block - thresholds.review) * 100}%` }}
          >
            复核
          </div>
          <div
            className="flex items-center justify-center bg-accent/[0.12] text-accent"
            style={{ width: `${(1 - thresholds.block) * 100}%` }}
          >
            拉黑
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-[12px] font-medium text-dim">拉黑线</span>
              <span className="sd-mono text-[15px] text-ink">{thresholds.block.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={0.95}
              step={0.01}
              value={thresholds.block}
              onChange={(e) => changeThresholds({ block: Number(e.target.value) })}
              className="sd-range"
              style={fill((thresholds.block - 0.5) / 0.45)}
            />
          </div>
          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-[12px] font-medium text-dim">复核线</span>
              <span className="sd-mono text-[15px] text-ink">{thresholds.review.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0.2}
              max={0.7}
              step={0.01}
              value={thresholds.review}
              onChange={(e) => changeThresholds({ review: Number(e.target.value) })}
              className="sd-range"
              style={fill((thresholds.review - 0.2) / 0.5)}
            />
          </div>
        </div>
      </Panel>

      <Panel
        title="候选"
        count={`${shown.length}/${candidates.length}`}
        flush
        right={
          <>
            <Segmented
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: '全部' },
                { value: 'block', label: '建议拉黑' },
                { value: 'review', label: '待复核' },
              ]}
            />
            <Btn size="sm" variant="ghost" onClick={selectAll}>
              {selected.size === shown.length && shown.length > 0 ? '取消全选' : '全选'}
            </Btn>
          </>
        }
      >
        <div className="border-t border-line">
          {shown.length === 0 ? (
            <Empty>无匹配</Empty>
          ) : (
            shown.map((c) => <Row key={c.mid} c={c} selected={selected.has(c.mid)} onToggle={() => toggle(c.mid)} />)
          )}
        </div>
      </Panel>

      <div className="sticky bottom-4 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-line2 bg-panel/90 px-3 py-2.5 shadow-[0_12px_32px_rgb(0_0_0/0.55)] backdrop-blur-xl">
        <Btn variant="primary" disabled={busy || selected.size === 0} onClick={() => execute([...selected])}>
          拉黑选中 {selected.size ? `(${selected.size})` : ''}
        </Btn>
        <Btn
          disabled={busy || blockCount === 0}
          onClick={() => execute(candidates.filter((c) => c.verdict === 'block' && !c.blocked).map((c) => c.mid))}
        >
          拉黑全部建议 {blockCount ? `(${blockCount})` : ''}
        </Btn>
        <span className="mx-1 h-5 w-px bg-line2" />
        <Btn variant="ghost" disabled={busy || selected.size === 0} onClick={ignoreSelected}>
          忽略
        </Btn>
        <Btn variant="ghost" disabled={busy || selected.size === 0} onClick={allowSelected}>
          放行
        </Btn>
        {llm.apiKey && (
          <>
            <span className="mx-1 h-5 w-px bg-line2" />
            <Btn variant="ghost" disabled={busy} onClick={runArbitration}>
              AI 复核
            </Btn>
            <button
              type="button"
              onClick={() => setSettings({ aiReview: !aiReview })}
              className={cn(
                'rounded-sm px-2 py-1 text-[11px] transition-colors',
                aiReview ? 'text-accent' : 'text-faint hover:text-dim',
              )}
            >
              自动复核 {aiReview ? '开' : '关'}
            </button>
          </>
        )}
        {busy && note && (
          <Alert tone="accent" className="ml-auto py-1">
            {note}
          </Alert>
        )}
      </div>
    </div>
  )
}
