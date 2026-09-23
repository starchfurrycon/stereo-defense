import { useRef, useState } from 'react'
import { Alert, Btn, Empty, Field, NumberInput, Panel, Progress, Stat, Switch, Tag } from '../ui'
import { useStore } from '../../lib/store'
import { DEFAULT_BUDGET, isAborted, runScan, type ScanProgress } from '../../lib/scan'
import { makeScorer } from '../../lib/analyze/score'
import { limiter } from '../../lib/bili/transport'

function Num({
  label,
  value,
  onChange,
  min = 0,
  max = 999,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
}) {
  return (
    <Field label={label}>
      <NumberInput value={value} onChange={onChange} min={min} max={max} />
    </Field>
  )
}

export function ScanView() {
  const profile = useStore((s) => s.profile)
  const settings = useStore((s) => s.settings)
  const setBudget = useStore((s) => s.setBudget)
  const setTab = useStore((s) => s.setTab)
  const setCandidates = useStore((s) => s.setCandidates)
  const candidates = useStore((s) => s.candidates)
  const blacklist = useStore((s) => s.blacklist)
  const ignored = useStore((s) => s.ignored)
  const account = useStore((s) => s.account)

  const [progress, setProgress] = useState<ScanProgress | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [advanced, setAdvanced] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const budget = settings.budget

  const start = async () => {
    if (!profile) return
    setRunning(true)
    setError('')
    setProgress({ phase: '准备', done: 0, total: 1 })
    const controller = new AbortController()
    abortRef.current = controller
    limiter.setConcurrency(settings.concurrency)
    try {
      const scorer = await makeScorer(profile, settings.thresholds)
      const excluded = new Set<number>([...blacklist.map((b) => b.mid), ...ignored])
      const results = await runScan({
        profile,
        scorer,
        budget,
        excluded,
        selfMid: account.mid,
        onProgress: setProgress,
        signal: controller.signal,
      })
      setCandidates(results)
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

  const sources = [
    '视频',
    '动态',
    budget.articles && '专栏',
    '评论',
    '他人评价',
    budget.followings && '关注列表',
    '账号状态',
    budget.indexedReplies && '历史评论',
  ].filter((s): s is string => Boolean(s))

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
            <Btn variant="primary" onClick={start} disabled={!profile || !account.ok}>
              {candidates.length ? '重新扫描' : '开始扫描'}
            </Btn>
          )
        }
      >
        {!profile && <Empty>尚未生成画像</Empty>}

        {profile && !account.ok && (
          <Alert tone="warn" className="mb-4">
            账号未登录
          </Alert>
        )}

        {profile && progress && (
          <div className="mb-5">
            <div className="flex items-end justify-between gap-6">
              <div className="min-w-0">
                <div className="truncate text-[15px] font-medium text-ink">{progress.phase}</div>
                <div className="sd-mono mt-1.5 text-[11.5px] text-faint">
                  {progress.done}/{progress.total}
                  {progress.note ? ` · ${progress.note}` : ''}
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
          <Alert tone="danger" className="mb-4">
            {error}
          </Alert>
        )}

        {candidates.length > 0 && !running && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="候选" value={candidates.length} />
            <Stat label="建议拉黑" value={blocked} tone="accent" />
            <Stat label="待复核" value={review} tone="warn" />
            <Stat label="已拉黑" value={blacklist.length} />
          </div>
        )}

        {profile && !progress && candidates.length === 0 && !error && (
          <div className="flex flex-wrap items-center gap-1.5">
            {sources.map((s) => (
              <Tag key={s}>{s}</Tag>
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title="范围"
        right={
          <Btn size="sm" variant="ghost" onClick={() => setAdvanced((v) => !v)}>
            {advanced ? '收起' : '展开'}
          </Btn>
        }
      >
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <Num label="检索页数" value={budget.searchPages} min={1} max={5} onChange={(v) => setBudget({ searchPages: v })} />
          <Num
            label="候选上限"
            value={budget.maxCandidates}
            min={10}
            max={400}
            onChange={(v) => setBudget({ maxCandidates: v })}
          />
          <Num label="投稿页数" value={budget.videoPages} min={1} max={5} onChange={(v) => setBudget({ videoPages: v })} />
          <Num
            label="动态页数"
            value={budget.dynamicPages}
            min={1}
            max={5}
            onChange={(v) => setBudget({ dynamicPages: v })}
          />
          <Num
            label="评论区数"
            value={budget.commentVideos}
            min={0}
            max={80}
            onChange={(v) => setBudget({ commentVideos: v })}
          />
          <Num
            label="评论页数"
            value={budget.commentPages}
            min={1}
            max={5}
            onChange={(v) => setBudget({ commentPages: v })}
          />
          <Num
            label="他人评价赞数"
            value={budget.peerLikeThreshold}
            min={0}
            max={1000}
            onChange={(v) => setBudget({ peerLikeThreshold: v })}
          />
          <Num
            label="历史评论补全"
            value={budget.indexedCandidates}
            min={0}
            max={60}
            onChange={(v) => setBudget({ indexedCandidates: v })}
          />
        </div>

        {advanced && (
          <div className="mt-5 border-t border-line pt-5">
            <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
              <Switch checked={budget.articles} onChange={(v) => setBudget({ articles: v })} label="专栏" />
              <Switch checked={budget.followings} onChange={(v) => setBudget({ followings: v })} label="关注列表" />
              <Switch checked={budget.indexedReplies} onChange={(v) => setBudget({ indexedReplies: v })} label="历史评论补全" />
              <div className="pt-3 sm:pt-0">
                <Num
                  label="并发"
                  value={settings.concurrency}
                  min={1}
                  max={4}
                  onChange={(v) => useStore.getState().setSettings({ concurrency: v })}
                />
              </div>
            </div>
            <div className="mt-4">
              <Btn size="sm" variant="ghost" onClick={() => setBudget({ ...DEFAULT_BUDGET })}>
                恢复默认
              </Btn>
            </div>
          </div>
        )}
      </Panel>
    </div>
  )
}
