import { useRef, useState } from 'react'
import { Btn, Field, Panel, Stat, Tag, TextInput, Toggle } from '../ui'
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
      <TextInput
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (Number.isFinite(n)) onChange(Math.max(min, Math.min(max, n)))
        }}
      />
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

  return (
    <div className="grid gap-4">
      <Panel
        title="扫描"
        right={
          running ? (
            <Btn tone="danger" onClick={() => abortRef.current?.abort()}>
              停止
            </Btn>
          ) : (
            <Btn tone="primary" onClick={start} disabled={!profile || !account.ok}>
              {candidates.length ? '重新扫描' : '开始扫描'}
            </Btn>
          )
        }
      >
        {!profile && <div className="text-[12px] text-faint">尚未生成画像</div>}
        {profile && !account.ok && <div className="text-[12px] text-warn">账号未登录</div>}

        {progress && (
          <div className="mt-1">
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-dim">{progress.phase}</span>
              <span className="sd-mono text-faint">
                {progress.done}/{progress.total}
                {progress.note ? ` · ${progress.note}` : ''}
              </span>
            </div>
            <div className="mt-2 h-1 bg-line2">
              <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}

        {error && <div className="mt-3 border border-danger/30 px-3 py-2 text-[12px] text-danger">{error}</div>}

        {candidates.length > 0 && !running && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="候选" value={candidates.length} />
            <Stat label="建议拉黑" value={blocked} tone="accent" />
            <Stat label="待复核" value={review} tone="warn" />
            <Stat label="已拉黑" value={blacklist.length} />
          </div>
        )}
      </Panel>

      <Panel
        title="范围"
        right={
          <Btn tone="ghost" onClick={() => setAdvanced((v) => !v)}>
            {advanced ? '收起' : '展开'}
          </Btn>
        }
      >
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Num label="检索页数" value={budget.searchPages} min={1} max={5} onChange={(v) => setBudget({ searchPages: v })} />
          <Num label="候选上限" value={budget.maxCandidates} min={10} max={400} onChange={(v) => setBudget({ maxCandidates: v })} />
          <Num label="投稿页数" value={budget.videoPages} min={1} max={5} onChange={(v) => setBudget({ videoPages: v })} />
          <Num label="动态页数" value={budget.dynamicPages} min={1} max={5} onChange={(v) => setBudget({ dynamicPages: v })} />
          <Num label="评论区数" value={budget.commentVideos} min={0} max={80} onChange={(v) => setBudget({ commentVideos: v })} />
          <Num label="评论页数" value={budget.commentPages} min={1} max={5} onChange={(v) => setBudget({ commentPages: v })} />
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
          <div className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-2 lg:grid-cols-3">
            <Toggle checked={budget.articles} onChange={(v) => setBudget({ articles: v })} label="专栏" />
            <Toggle checked={budget.followings} onChange={(v) => setBudget({ followings: v })} label="关注列表" />
            <Toggle
              checked={budget.indexedReplies}
              onChange={(v) => setBudget({ indexedReplies: v })}
              label="历史评论补全"
              hint="非官方索引"
            />
            <Num
              label="并发"
              value={settings.concurrency}
              min={1}
              max={4}
              onChange={(v) => useStore.getState().setSettings({ concurrency: v })}
            />
            <div className="flex items-end">
              <Btn tone="ghost" onClick={() => setBudget({ ...DEFAULT_BUDGET })}>
                恢复默认
              </Btn>
            </div>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] text-faint">
          <Tag>视频</Tag>
          <Tag>动态</Tag>
          <Tag>专栏</Tag>
          <Tag>评论</Tag>
          <Tag>他人评价</Tag>
          <Tag>关注列表</Tag>
          <Tag>账号状态</Tag>
        </div>
      </Panel>
    </div>
  )
}
