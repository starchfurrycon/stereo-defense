import { useMemo, useRef, useState } from 'react'
import { Alert, Btn, Empty, Field, NumberInput, Panel, Progress, Stat, Switch, Tag, cn } from '../ui'
import { useStore } from '../../lib/store'
import { DEFAULT_BUDGET, isAborted, runScan, type ScanProgress } from '../../lib/scan'
import { buildReflex } from '../../lib/reflex'
import { enabledFamilies } from '../../lib/verdict'
import { executeBlocks } from '../../lib/executor'
import { limiter } from '../../lib/bili/transport'

function Num({
  label,
  value,
  onChange,
  min = 0,
  max = 999,
  hint,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  hint?: string
}) {
  return (
    <Field label={label} hint={hint}>
      <NumberInput value={value} onChange={onChange} min={min} max={max} />
    </Field>
  )
}

export function ScanView() {
  const targets = useStore((s) => s.targets)
  const settings = useStore((s) => s.settings)
  const setBudget = useStore((s) => s.setBudget)
  const setSources = useStore((s) => s.setSources)
  const setSettings = useStore((s) => s.setSettings)
  const setTab = useStore((s) => s.setTab)
  const setCandidates = useStore((s) => s.setCandidates)
  const addBlacklist = useStore((s) => s.addBlacklist)
  const candidates = useStore((s) => s.candidates)
  const blacklist = useStore((s) => s.blacklist)
  const ignored = useStore((s) => s.ignored)
  const account = useStore((s) => s.account)

  const [progress, setProgress] = useState<ScanProgress | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [advanced, setAdvanced] = useState(false)
  const [autoNote, setAutoNote] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const budget = settings.budget
  const sources = settings.sources
  const families = enabledFamilies(targets.modes)

  const estimate = useMemo(() => {
    let n = 0
    if (sources.history) n += 1
    if (sources.popular) n += 2
    if (sources.search) n += Math.max(1, targets.topics.length || 10) * budget.searchPages
    if (sources.comments) n += budget.videoLimit * (budget.commentPages + 1)
    n += budget.maxCandidates * 3
    if (sources.cascade) n += budget.cascadeTargets * (1 + budget.cascadeFans)
    return n
  }, [sources, budget, targets.topics.length])

  const minutes = Math.ceil((estimate * 1.2) / 60)

  const start = async () => {
    setRunning(true)
    setError('')
    setAutoNote('')
    setProgress({ phase: '准备', done: 0, total: 1 })
    const controller = new AbortController()
    abortRef.current = controller
    limiter.setConcurrency(settings.concurrency)
    try {
      const reflex = buildReflex(targets)
      const excluded = new Set<number>([...blacklist.map((b) => b.mid), ...ignored])
      const results = await runScan({
        targets,
        reflex,
        budget,
        sources,
        excluded,
        selfMid: account.mid,
        onProgress: setProgress,
        signal: controller.signal,
      })
      setCandidates(results)

      if (settings.autoBlock && account.csrf) {
        const pending = results.filter((c) => c.verdict === 'block' && !c.blocked).slice(0, 100)
        if (pending.length) {
          setProgress({ phase: '拉黑', done: 0, total: pending.length })
          const outcome = await executeBlocks(
            pending.map((c) => c.mid),
            account.csrf,
            (t) => {
              setAutoNote(t)
              setProgress({ phase: '拉黑', done: 0, total: pending.length, note: t })
            },
            () => controller.signal.aborted,
          )
          if (outcome.aborted) {
            setError(`自动拉黑已中止：${outcome.aborted}`)
          } else {
            const ok = new Set(outcome.ok)
            const stamp = Math.floor(Date.now() / 1000)
            setCandidates(results.map((c) => (ok.has(c.mid) ? { ...c, blocked: true } : c)))
            addBlacklist(
              outcome.ok.map((m) => {
                const c = results.find((x) => x.mid === m)
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
            useStore.getState().setLastBatch(outcome.ok)
            setAutoNote(
              outcome.failed.length
                ? `已拉黑 ${outcome.ok.length} 个，失败 ${outcome.failed.length} 个`
                : `已拉黑 ${outcome.ok.length} 个`,
            )
          }
        } else {
          setAutoNote('没有需要拉黑的建议项')
        }
      }
      setTab('review')
    } catch (err) {
      if (!isAborted(err)) setError(err instanceof Error ? err.message : '扫描失败')
    } finally {
      setRunning(false)
      abortRef.current = null
    }
  }

  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0
  const blocked = candidates.filter((c) => c.verdict === 'block').length
  const review = candidates.filter((c) => c.verdict === 'review').length
  const cascaded = candidates.filter((c) => c.relation === 'fan').length
  const ready = families.length > 0

  return (
    <div className="grid gap-4">
      <Panel
        title="扫描"
        right={
          running ? (
            <Btn variant="danger" onClick={() => abortRef.current?.abort()}>
              停止
            </Btn>
          ) : (
            <Btn variant="primary" onClick={start} disabled={!ready}>
              {candidates.length ? '重新扫描' : '开始扫描'}
            </Btn>
          )
        }
      >
        {!ready && <Empty>先在「目标」里打开至少一个分类</Empty>}

        {ready && !running && !progress && (
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] text-dim">数据来源</span>
              <Tag>观看历史</Tag>
              <Tag>热门</Tag>
              <Tag>检索</Tag>
              <Tag>评论区</Tag>
              <Tag>粉丝连坐</Tag>
            </div>
            <div className="text-[12px] leading-relaxed text-faint">
              从你真正会看的内容里找污染源：先取观看历史与热门视频，再读它们的评论区，
              最后只对高分账号顺着粉丝列表补一层。预计 {estimate} 次请求，约 {minutes} 分钟。
            </div>
            {!account.ok && (
              <Alert tone="warn">未登录：观看历史和粉丝列表读不到，只能扫热门与检索结果。</Alert>
            )}
          </div>
        )}

        {progress && (
          <div className="mb-1">
            <div className="flex items-end justify-between gap-6">
              <div className="min-w-0">
                <div className="truncate text-[15px] font-medium text-ink">{progress.phase}</div>
                <div className="sd-mono mt-1.5 text-[11.5px] text-faint">
                  {progress.done}/{progress.total}
                  {progress.note ? ` · ${progress.note}` : ''}
                  {progress.found ? ` · 已发现 ${progress.found}` : ''}
                </div>
              </div>
              <div className="sd-mono shrink-0 text-[30px] leading-none font-medium tracking-[-0.02em] text-ink">
                {pct}
                <span className="text-[16px] text-faint">%</span>
              </div>
            </div>
            <div className="mt-3.5">
              <Progress value={pct / 100} live={running} />
            </div>
          </div>
        )}

        {error && (
          <Alert tone="danger" className="mt-4">
            {error}
          </Alert>
        )}

        {autoNote && !running && (
          <Alert tone="accent" className="mt-4">
            {autoNote}
          </Alert>
        )}

        {candidates.length > 0 && !running && (
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="候选" value={candidates.length} />
            <Stat label="建议拉黑" value={blocked} tone="accent" />
            <Stat label="待复核" value={review} tone="warn" />
            <Stat label="连坐" value={cascaded} tone="dim" />
          </div>
        )}
      </Panel>

      <Panel
        title="来源"
        right={
          <Btn size="sm" variant="ghost" onClick={() => setAdvanced((v) => !v)}>
            {advanced ? '收起参数' : '展开参数'}
          </Btn>
        }
      >
        <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
          <Switch
            checked={sources.history}
            onChange={(v) => setSources({ history: v })}
            label="观看历史"
          />
          <Switch checked={sources.popular} onChange={(v) => setSources({ popular: v })} label="热门 / 排行榜" />
          <Switch checked={sources.search} onChange={(v) => setSources({ search: v })} label="站内检索" />
          <Switch checked={sources.comments} onChange={(v) => setSources({ comments: v })} label="评论区" />
          <Switch checked={sources.cascade} onChange={(v) => setSources({ cascade: v })} label="粉丝连坐" />
        </div>

        <div className="mt-4 border-t border-line pt-3">
          <Switch
            checked={settings.autoBlock}
            onChange={(v) => setSettings({ autoBlock: v })}
            label="扫描完直接拉黑「建议拉黑」"
          />
          {settings.autoBlock && (
            <div className="mt-1.5 text-[11px] leading-relaxed text-warn">
              跳过复核，单次最多 100 个。判错的人需要去「黑名单」手动解除，建议第一次先不勾。
            </div>
          )}
        </div>

        {advanced && (
          <div className="mt-5 border-t border-line pt-5">
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
              <Num
                label="历史视频"
                value={budget.historyLimit}
                min={0}
                max={30}
                onChange={(v) => setBudget({ historyLimit: v })}
              />
              <Num
                label="热门视频"
                value={budget.popularLimit}
                min={0}
                max={100}
                onChange={(v) => setBudget({ popularLimit: v })}
              />
              <Num
                label="扫评论区"
                value={budget.videoLimit}
                min={0}
                max={40}
                onChange={(v) => setBudget({ videoLimit: v })}
                hint="个视频"
              />
              <Num
                label="评论翻页"
                value={budget.commentPages}
                min={1}
                max={4}
                onChange={(v) => setBudget({ commentPages: v })}
              />
              <Num
                label="补资料上限"
                value={budget.maxCandidates}
                min={10}
                max={200}
                onChange={(v) => setBudget({ maxCandidates: v })}
                hint="个账号"
              />
              <Num
                label="每号投稿"
                value={budget.profileDepth}
                min={0}
                max={30}
                onChange={(v) => setBudget({ profileDepth: v })}
              />
              <Num
                label="连坐账号"
                value={budget.cascadeTargets}
                min={0}
                max={12}
                onChange={(v) => setBudget({ cascadeTargets: v })}
              />
              <Num
                label="每个粉丝页"
                value={budget.cascadeFans}
                min={0}
                max={50}
                onChange={(v) => setBudget({ cascadeFans: v })}
              />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Btn size="sm" variant="ghost" onClick={() => setBudget({ ...DEFAULT_BUDGET })}>
                恢复默认
              </Btn>
              <span className={cn('text-[11px]', limiter.cooling ? 'text-warn' : 'text-faint')}>
                {limiter.cooling ? '风控冷却中，扫描会自动等待' : '串行请求，命中风控会自动退避'}
              </span>
            </div>
          </div>
        )}
      </Panel>
    </div>
  )
}
