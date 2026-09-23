import { useEffect, useState } from 'react'
import { Btn, Field, Panel, Tag, TextArea } from '../ui'
import { useStore } from '../../lib/store'
import { buildLocalProfile } from '../../lib/analyze/local'
import { embedStatus, loadEmbedder, MODEL_ID, onEmbedStatus } from '../../lib/analyze/embed'
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
          <div className="flex items-center gap-2">
            <Tag tone={useLlm ? 'accent' : 'dim'}>{useLlm ? llm.model || 'LLM' : '本地模型'}</Tag>
            <Btn tone="primary" onClick={generate} disabled={busy || !rawInput.trim()}>
              {busy ? '提炼中' : '生成画像'}
            </Btn>
          </div>
        }
      >
        <TextArea
          rows={4}
          value={rawInput}
          onChange={(e) => setRawInput(e.target.value)}
          placeholder="描述你不想再看到的人"
        />
        <div className="mt-2 flex items-center justify-between gap-4">
          <span className="text-[11px] text-faint">
            {!useLlm && embed === 'loading' ? '本地模型加载中' : status}
          </span>
          {usage && (
            <span className="sd-mono text-[11px] text-faint">
              {usage.totalTokens.toLocaleString()} tok · {formatCost(usage.costUsd)} · {usage.calls} 次
              {!usage.authoritative && ' · 估算'}
            </span>
          )}
        </div>
      </Panel>

      {profile && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="判定标准">
            <div className="grid gap-3">
              <Field label="目标人群">
                <TextArea rows={2} value={profile.target} onChange={(e) => patch({ target: e.target.value })} />
              </Field>
              <div>
                <div className="mb-1.5 text-[12px] text-dim">立场族</div>
                <div className="flex flex-wrap gap-1.5">
                  {FAMILIES.map((f) => {
                    const on = profile.families.includes(f.id)
                    return (
                      <button
                        key={f.id}
                        onClick={() =>
                          patch({
                            families: on
                              ? profile.families.filter((x) => x !== f.id)
                              : [...profile.families, f.id],
                          })
                        }
                        className={`border px-2 py-0.5 text-[11px] transition-colors ${
                          on ? 'border-accent/50 text-accent' : 'border-line2 text-faint hover:text-dim'
                        }`}
                      >
                        {FAMILY_LABEL.get(f.id)}
                      </button>
                    )
                  })}
                </div>
              </div>
              <Field label="检索领域词" hint="只决定去哪找">
                <TextArea rows={3} value={listToText(profile.topics)} onChange={(e) => patch({ topics: textToList(e.target.value) })} />
              </Field>
              <Field label="放行">
                <TextArea rows={2} value={listToText(profile.allow)} onChange={(e) => patch({ allow: textToList(e.target.value) })} />
              </Field>
            </div>
          </Panel>

          <Panel title="判定依据">
            <div className="grid gap-3">
              <Field label="目标话术" hint={`${profile.markers.length}`}>
                <TextArea rows={8} value={listToText(profile.markers)} onChange={(e) => patch({ markers: textToList(e.target.value) })} />
              </Field>
              <Field label="反驳语境词" hint={`${profile.guards.length}`}>
                <TextArea rows={6} value={listToText(profile.guards)} onChange={(e) => patch({ guards: textToList(e.target.value) })} />
              </Field>
              <Field label="典型样例" hint={`${profile.exemplars.length}`}>
                <TextArea rows={4} value={listToText(profile.exemplars)} onChange={(e) => patch({ exemplars: textToList(e.target.value) })} />
              </Field>
            </div>
          </Panel>
        </div>
      )}

      {!useLlm && profile && (
        <Panel
          title="本地引擎"
          right={
            embed === 'idle' ? (
              <Btn onClick={() => void loadEmbedder()} disabled={busy}>
                加载语义模型
              </Btn>
            ) : undefined
          }
        >
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px]">
            <span className="sd-mono text-dim">{MODEL_ID}</span>
            <span className={embed === 'ready' ? 'text-accent' : embed === 'unavailable' ? 'text-warn' : 'text-faint'}>
              {embed === 'ready' ? '已加载' : embed === 'unavailable' ? '不可用，已降级为词表匹配' : embed === 'loading' ? '加载中' : '未加载'}
            </span>
          </div>
        </Panel>
      )}
    </div>
  )
}
