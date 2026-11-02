import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Btn, Checkbox, Empty, Icon, Meter, Panel, Segmented, Stat, Tag, cn } from '../ui'
import { useStore } from '../../lib/store'
import { blockCapacity } from '../../lib/bili/api'
import { executeBlocks } from '../../lib/executor'
import { applyTargets, familyLabel } from '../../lib/verdict'
import { arbitrate } from '../../lib/llm/provider'
import { ARBITER_SYSTEM, arbiterUserPrompt } from '../../lib/llm/prompt'
import { targetsKey } from '../../lib/reflex'
import { FAMILIES, FAMILY_MAP } from '../../lib/analyze/families'
import { RELATION_LABEL, SOURCE_LABEL, type Candidate, type FamilyId, type Verdict } from '../../lib/types'

function formatFans(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`
  return String(n)
}

function scoreTone(verdict: Verdict): string {
  if (verdict === 'block') return 'text-accent'
  if (verdict === 'review') return 'text-warn'
  return 'text-dim'
}

function Row({ c, selected, onToggle }: { c: Candidate; selected: boolean; onToggle: () => void }) {
  const [open, setOpen] = useState(false)
  const sources = useMemo(() => [...new Set(c.evidences.map((e) => e.source))], [c.evidences])
  const top = c.matches[0]

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
            {c.relation !== 'commenter' && <Tag tone="dim">{RELATION_LABEL[c.relation]}</Tag>}
            {c.blocked && <Tag tone="ok">已拉黑</Tag>}
            {c.flags.map((f) => (
              <Tag key={f} tone={f === '机构认证' ? 'danger' : 'warn'}>
                {f}
              </Tag>
            ))}
          </div>

          {c.sign && <div className="mt-1 truncate text-[12px] text-dim">{c.sign}</div>}

          {c.via && (
            <div className="mt-1 text-[11.5px] text-faint">
              因关注{' '}
              <a
                href={`https://space.bilibili.com/${c.via.mid}`}
                target="_blank"
                rel="noreferrer"
                className="text-dim underline decoration-line2 underline-offset-2 hover:text-accent"
              >
                {c.via.uname || c.via.mid}
              </a>{' '}
              被连坐 · {familyLabel(c.via.family)}
            </div>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {c.matches.slice(0, 3).map((m) => {
              const meta = FAMILY_MAP.get(m.family)
              return (
                <Tag
                  key={m.family}
                  tone={meta?.tone === 'danger' ? 'danger' : meta?.tone === 'warn' ? 'warn' : 'accent'}
                >
                  {familyLabel(m.family)}
                  <span className="sd-mono opacity-70">{(m.score * 100).toFixed(0)}</span>
                </Tag>
              )
            })}
            {top?.reasons.slice(0, 2).map((r) => (
              <span key={r} className="text-[11px] text-faint">
                {r}
              </span>
            ))}
          </div>

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
          <span className={cn('sd-mono text-[17px] leading-none font-medium tracking-[-0.02em]', scoreTone(c.verdict))}>
            {(c.score * 100).toFixed(0)}
          </span>
          <Meter value={c.score} width={78} showValue={false} />
        </div>
      </div>

      {open && (
        <div className="space-y-2 px-4 pb-4 pl-[46px]">
          {c.evidences.slice(0, 6).map((e, i) => {
            const best = e.verdicts[0]
            return (
              <div key={i} className="border-l border-line2 pl-3">
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <Tag tone={best && best.score >= 0.6 ? 'accent' : 'dim'}>{SOURCE_LABEL[e.source]}</Tag>
                  {best && (
                    <span className="sd-mono text-faint">
                      {familyLabel(best.family)} {best.score.toFixed(2)}
                    </span>
                  )}
                  {best?.hits.slice(0, 3).map((h) => (
                    <span key={`${h.term}${h.start}`} className="text-accent">
                      {h.term}
                      {h.penalized && <span className="text-warn">?</span>}
                    </span>
                  ))}
                </div>
                <div className="mt-1 text-[12px] leading-relaxed break-all text-dim">{e.text}</div>
                {best?.hits[0] && <div className="mt-0.5 text-[11px] text-faint">{best.hits[0].reason}</div>}
              </div>
            )
          })}
          {c.matches[0] && (
            <div className="pt-1 text-[11px] text-faint">
              判定：{familyLabel(c.matches[0].family)} · 文本 {c.matches[0].textScore.toFixed(2)} · 结构{' '}
              {c.matches[0].structuralScore.toFixed(2)} · 门槛 {c.matches[0].level.block.toFixed(2)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function ReviewView() {
  const candidates = useStore((s) => s.candidates)
  const setCandidates = useStore((s) => s.setCandidates)
  const patchCandidate = useStore((s) => s.patchCandidate)
  const targets = useStore((s) => s.targets)
  const account = useStore((s) => s.account)
  const addBlacklist = useStore((s) => s.addBlacklist)
  const ignored = useStore((s) => s.ignored)
  const setIgnored = useStore((s) => s.setIgnored)
  const llm = useStore((s) => s.settings.llm)
  const addUsage = useStore((s) => s.addUsage)

  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [filter, setFilter] = useState<'all' | 'block' | 'review'>('all')
  const [family, setFamily] = useState<'all' | FamilyId>('all')
  const [failures, setFailures] = useState<number[]>([])
  const stopRef = useRef(false)

  // 力度改了以后，用已存的证据直接重判，不需要重新扫描
  const key = targetsKey(targets)
  useEffect(() => {
    if (!candidates.length) return
    const next = applyTargets(
      candidates.map((c) => ({ ...c })),
      targets,
    )
    setCandidates(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const familyCounts = useMemo(() => {
    const map = new Map<FamilyId, number>()
    for (const c of candidates) {
      if (c.verdict === 'skip') continue
      for (const m of c.matches) {
        if (m.score < m.level.review) continue
        map.set(m.family, (map.get(m.family) ?? 0) + 1)
      }
    }
    return map
  }, [candidates])

  const shown = useMemo(() => {
    const list = candidates.filter((c) => (filter === 'all' ? c.verdict !== 'skip' : c.verdict === filter))
    const byFamily =
      family === 'all' ? list : list.filter((c) => c.matches.some((m) => m.family === family && m.score >= m.level.review))
    return byFamily.sort((a, b) => b.score - a.score)
  }, [candidates, filter, family])

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

  const runArbitration = async () => {
    const targets_ = candidates.filter((c) => selected.has(c.mid) || c.verdict === 'review').slice(0, 40)
    if (!targets_.length) return
    setBusy(true)
    setNote('')
    let done = 0
    for (const c of targets_) {
      setNote(`复核 ${++done}/${targets_.length}`)
      const match = c.matches[0]
      if (!match) continue
      try {
        const res = await arbitrate(llm, ARBITER_SYSTEM, arbiterUserPrompt(match, c))
        addUsage(res.usage)
        if (res.decision === 'pass') {
          patchCandidate(c.mid, {
            verdict: 'skip',
            score: Math.min(c.score, match.level.review - 0.01),
            flags: [...c.flags, 'AI 排除'],
          })
        } else if (res.decision === 'block') {
          patchCandidate(c.mid, {
            verdict: 'block',
            score: Math.max(c.score, match.level.block + 0.02),
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
    if (!mids.length) return
    setBusy(true)
    setFailures([])
    stopRef.current = false
    const outcome = await executeBlocks(mids, account.csrf, setNote, () => stopRef.current)
    if (outcome.aborted) {
      setBusy(false)
      setNote(`已中止：${outcome.aborted}`)
      return
    }

    const stamp = Math.floor(Date.now() / 1000)
    addBlacklist(
      outcome.ok.map((m) => {
        const c = candidates.find((x) => x.mid === m)
        return {
          mid: m,
          uname: c?.uname ?? '',
          mtime: stamp,
          score: c?.score,
          family: c?.matches[0]?.family,
          origin: 'scan' as const,
        }
      }),
    )
    for (const m of outcome.ok) patchCandidate(m, { blocked: true })
    useStore.getState().setLastBatch(outcome.ok)
    setSelected(new Set())
    setFailures(outcome.failed)
    setNote(outcome.failed.length ? `${outcome.failed.length} 个失败，其余已拉黑` : `已拉黑 ${outcome.ok.length} 个`)
    setBusy(false)
  }

  const ignoreSelected = () => {
    setIgnored([...new Set([...ignored, ...selected])])
    for (const mid of selected) patchCandidate(mid, { verdict: 'skip', score: 0, flags: ['已忽略'] })
    setSelected(new Set())
  }

  const allowSelected = () => {
    const names = candidates
      .filter((c) => selected.has(c.mid))
      .map((c) => c.uname)
      .filter(Boolean)
    useStore.getState().setTargets({ allow: [...new Set([...targets.allow, ...names])] })
    for (const c of candidates) {
      if (selected.has(c.mid)) patchCandidate(c.mid, { score: 0, verdict: 'skip', flags: ['命中白名单'] })
    }
    setSelected(new Set())
  }

  if (!candidates.length) {
    return (
      <Panel title="复核">
        <Empty>暂无结果，先去扫描</Empty>
      </Panel>
    )
  }

  const blockCount = candidates.filter((c) => c.verdict === 'block' && !c.blocked).length
  const reviewCount = candidates.filter((c) => c.verdict === 'review').length
  const capacity = blockCapacity(account.level, 0)
  const remaining = Math.max(0, capacity - account.blockedTotal)

  return (
    <div className="grid gap-4 pb-24">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="候选" value={candidates.length} />
        <Stat label="建议拉黑" value={blockCount} tone="accent" />
        <Stat label="待复核" value={reviewCount} tone="warn" />
        <Stat label="已选" value={selected.size} tone={selected.size ? 'ink' : 'dim'} />
      </div>

      {remaining < blockCount + 20 && (
        <Alert tone="warn">
          线上黑名单已用 {account.blockedTotal} / 约 {capacity} 条，剩余 {remaining}。
          超出会返回「黑名单达到上限」，建议先清理旧名单或提高门槛。
        </Alert>
      )}

      <Panel title="筛选">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: '全部' },
              { value: 'block', label: '建议拉黑' },
              { value: 'review', label: '待复核' },
            ]}
          />
          <span className="mx-1 h-4 w-px bg-line2" />
          <button
            type="button"
            onClick={() => setFamily('all')}
            className={cn(
              'rounded-full border px-2.5 py-1 text-[11.5px] transition-colors',
              family === 'all' ? 'border-accent/35 bg-accent/12 text-accent' : 'border-line2 text-faint hover:text-dim',
            )}
          >
            全部类别
          </button>
          {FAMILIES.filter((f) => familyCounts.get(f.id)).map((f) => {
            const on = family === f.id
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFamily(f.id)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[11.5px] transition-colors',
                  on ? 'border-accent/35 bg-accent/12 text-accent' : 'border-line2 text-faint hover:text-dim',
                )}
              >
                {f.label}
                <span className="sd-mono ml-1 opacity-60">{familyCounts.get(f.id)}</span>
              </button>
            )
          })}
        </div>
      </Panel>

      <Panel
        title="候选"
        count={`${shown.length}/${candidates.length}`}
        flush
        right={
          <Btn size="sm" variant="ghost" onClick={selectAll}>
            {selected.size === shown.length && shown.length > 0 ? '取消全选' : '全选'}
          </Btn>
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

      {failures.length > 0 && (
        <Alert tone="danger">
          失败 {failures.length} 个：{failures.slice(0, 12).join('、')}
          {failures.length > 12 ? ' …' : ''}
          <Btn
            size="sm"
            variant="ghost"
            className="ml-2"
            onClick={() => {
              const text = failures.join('\n')
              void navigator.clipboard?.writeText(text)
              setNote('失败 UID 已复制')
            }}
          >
            复制 UID
          </Btn>
        </Alert>
      )}

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
        {busy && (
          <Btn variant="danger" onClick={() => (stopRef.current = true)}>
            停止
          </Btn>
        )}
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
          </>
        )}
        {note && (
          <span className="sd-mono ml-auto text-[11.5px] text-dim">{note}</span>
        )}
      </div>
    </div>
  )
}
