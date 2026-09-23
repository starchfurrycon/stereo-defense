import { useEffect, useState } from 'react'
import { Alert, Btn, Field, Panel, Tag, TextArea, cn } from '../ui'
import { useStore } from '../../lib/store'
import { buildLocalProfile } from '../../lib/analyze/local'
import { embedStatus, loadEmbedder, onEmbedStatus } from '../../lib/analyze/embed'
import { generateProfile } from '../../lib/llm/provider'
import { PROFILE_SYSTEM, profileUserPrompt } from '../../lib/llm/prompt'
import { formatCost } from '../../lib/llm/pricing'
import { FAMILIES } from '../../lib/analyze/lexicon'
import type { Profile } from '../../lib/types'

const FAMILY_LABEL = new Map(FAMILIES.map((f) => [f.id, f.label]))

function listToText(list: string[]): string {
  return list.join('\n')
}
function textToList(text: string): string[] {
  return text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function ProfileView() {
  const rawInput = useStore((s) => s.rawInput)
  const setRawInput = useStore((s) => s.setRawInput)
  const profile = useStore((s) => s.profile)
  const setProfile = useStore((s) => s.setProfile)
  const llm = useStore((s) => s.settings.llm)
  const usage = useStore((s) => s.usage)
  const addUsage = useStore((s) => s.addUsage)
  const reset = useStore((s) => s.reset)

  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [embed, setEmbed] = useState(embedStatus())

  useEffect(
    () =>
      onEmbedStatus((s, detail) => {
        setEmbed(s)
        setStatus(s === 'unavailable' ? (detail ? `本地模型不可用：${detail}` : '本地模型不可用') : '')
      }),
    [],
  )

  const useLlm = llm.apiKey.trim().length > 0

  const generate = async () => {
    if (!rawInput.trim()) return
    setBusy(true)
    setStatus('')
    try {
      if (useLlm) {
        const { profile: p, usage: u } = await generateProfile(llm, PROFILE_SYSTEM, profileUserPrompt(rawInput.trim()))
        setProfile(p)
        addUsage(u)
      } else {
        void loadEmbedder()
        const p = await buildLocalProfile(rawInput.trim())
        setProfile(p)
      }
      reset()
    } catch (err) {
      setStatus(err instanceof Error ? err.message : '生成失败')
    } finally {
      setBusy(false)
    }
  }

  const patch = (p: Partial<Profile>) => profile && setProfile({ ...profile, ...p })

  return (
    <div className="grid gap-4">
      <Panel
        title="偏好"
        right={
          <>
            {useLlm ? (
              <Tag tone="accent">{llm.model || 'LLM'}</Tag>
            ) : embed === 'idle' ? (
              <Btn size="sm" variant="ghost" onClick={() => void loadEmbedder()} disabled={busy}>
                加载语义模型
              </Btn>
            ) : (
              <Tag tone={embed === 'ready' ? 'ok' : embed === 'unavailable' ? 'warn' : 'dim'}>
                {embed === 'ready' ? '语义模型' : embed === 'unavailable' ? '词表匹配' : '加载中'}
              </Tag>
            )}
            <Btn variant="primary" onClick={generate} disabled={busy || !rawInput.trim()}>
              {busy ? '提炼中' : '生成画像'}
            </Btn>
          </>
        }
      >
        <TextArea
          rows={5}
          value={rawInput}
          onChange={(e) => setRawInput(e.target.value)}
          placeholder="描述你不想再看到的人"
          className="text-[13.5px]"
        />
        <div className="mt-3 flex min-h-[20px] flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">{status && <Alert tone="warn">{status}</Alert>}</div>
          {usage && (
            <div className="sd-mono flex shrink-0 items-center gap-3 text-[11.5px] text-faint">
              <span>
                <span className="text-dim">{usage.totalTokens.toLocaleString()}</span> tok
              </span>
              <span className="h-3 w-px bg-line2" />
              <span>
                <span className="text-dim">{formatCost(usage.costUsd)}</span>
              </span>
              <span className="h-3 w-px bg-line2" />
              <span>
                <span className="text-dim">{usage.calls}</span> 次
              </span>
              {!usage.authoritative && <span className="text-warn">估算</span>}
            </div>
          )}
        </div>
      </Panel>

      {profile && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="判定标准">
            <div className="grid gap-4">
              <Field label="目标人群">
                <TextArea rows={2} value={profile.target} onChange={(e) => patch({ target: e.target.value })} />
              </Field>

              <div>
                <div className="mb-2 text-[12px] font-medium text-dim">立场族</div>
                <div className="flex flex-wrap gap-1.5">
                  {FAMILIES.map((f) => {
                    const on = profile.families.includes(f.id)
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() =>
                          patch({
                            families: on ? profile.families.filter((x) => x !== f.id) : [...profile.families, f.id],
                          })
                        }
                        className={cn(
                          'rounded-full border px-2.5 py-1 text-[11.5px] transition-colors duration-100',
                          on
                            ? 'border-accent/35 bg-accent/12 text-accent'
                            : 'border-line2 text-faint hover:border-faint/60 hover:text-dim',
                        )}
                      >
                        {FAMILY_LABEL.get(f.id)}
                      </button>
                    )
                  })}
                </div>
              </div>

              <Field label="检索领域词" hint={profile.topics.length}>
                <TextArea
                  rows={4}
                  value={listToText(profile.topics)}
                  onChange={(e) => patch({ topics: textToList(e.target.value) })}
                />
              </Field>

              <Field label="放行" hint={profile.allow.length}>
                <TextArea
                  rows={3}
                  value={listToText(profile.allow)}
                  onChange={(e) => patch({ allow: textToList(e.target.value) })}
                />
              </Field>
            </div>
          </Panel>

          <Panel title="判定依据">
            <div className="grid gap-4">
              <Field label="目标话术" hint={profile.markers.length}>
                <TextArea
                  rows={10}
                  value={listToText(profile.markers)}
                  onChange={(e) => patch({ markers: textToList(e.target.value) })}
                />
              </Field>
              <Field label="反驳语境词" hint={profile.guards.length}>
                <TextArea
                  rows={7}
                  value={listToText(profile.guards)}
                  onChange={(e) => patch({ guards: textToList(e.target.value) })}
                />
              </Field>
              <Field label="典型样例" hint={profile.exemplars.length}>
                <TextArea
                  rows={5}
                  value={listToText(profile.exemplars)}
                  onChange={(e) => patch({ exemplars: textToList(e.target.value) })}
                />
              </Field>
            </div>
          </Panel>
        </div>
      )}
    </div>
  )
}
