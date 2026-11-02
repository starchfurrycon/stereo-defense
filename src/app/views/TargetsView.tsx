import { useMemo, useState } from 'react'
import { Alert, Btn, Field, Panel, Segmented, Stat, Tag, TextArea, cn } from '../ui'
import { useStore } from '../../lib/store'
import { FAMILIES, type FamilyId } from '../../lib/analyze/families'
import { PACK_MAP } from '../../lib/analyze/packs'
import { calibrate } from '../../lib/analyze/calibrate'
import { enabledFamilies } from '../../lib/verdict'
import type { FamilyMode, Preset } from '../../lib/types'

const MODES: Array<{ value: FamilyMode; label: string }> = [
  { value: 'off', label: '关' },
  { value: 'watch', label: '只标记' },
  { value: 'standard', label: '标准' },
  { value: 'aggressive', label: '连坐' },
]

const PRESET_HINT: Record<Preset, string> = {
  conservative: '只对「几乎是骂人」的两类动手，其余只进复核区。适合先跑一遍看效果。',
  standard: '八类都按标准阈值判定。极端发言单条即可建议拉黑，轻症需要多条证据。',
  aggressive: '阈值下调，并顺着高分账号的粉丝列表继续挖。误伤率会上升，建议先小范围试。',
}

function listToText(list: string[]): string {
  return list.join('\n')
}
function textToList(text: string): string[] {
  return text
    .split(/[\n,，、;；]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function TargetsView() {
  const targets = useStore((s) => s.targets)
  const setMode = useStore((s) => s.setMode)
  const setPreset = useStore((s) => s.setPreset)
  const setTargets = useStore((s) => s.setTargets)
  const setSettings = useStore((s) => s.setSettings)
  const setTab = useStore((s) => s.setTab)
  const [advanced, setAdvanced] = useState(false)

  const families = useMemo(() => enabledFamilies(targets.modes), [targets.modes])
  const result = useMemo(() => calibrate(families, targets.modes), [families, targets.modes])

  const blockFamilies = FAMILIES.filter((f) => targets.modes[f.id] === 'standard' || targets.modes[f.id] === 'aggressive')
  const watchFamilies = FAMILIES.filter((f) => targets.modes[f.id] === 'watch')
  const recall = result.targetTotal ? result.targetCaught / result.targetTotal : 0
  const falseRate = result.negativeTotal ? result.negativeHit / result.negativeTotal : 0

  return (
    <div className="grid gap-4">
      <Panel
        title="力度"
        right={
          <>
            <Tag tone="dim">{blockFamilies.length} 类会自动建议拉黑</Tag>
            <Btn
              variant="primary"
              onClick={() => {
                setPreset('aggressive')
                setSettings({ autoBlock: true })
                useStore.getState().setAutoRun(true)
                setTab('scan')
              }}
            >
              一键执行
            </Btn>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            value={targets.preset}
            onChange={(v) => setPreset(v as Preset)}
            options={[
              { value: 'conservative', label: '保守' },
              { value: 'standard', label: '标准' },
              { value: 'aggressive', label: '激进' },
            ]}
          />
          <span className="text-[12px] text-dim">{PRESET_HINT[targets.preset]}</span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="判定类别" value={families.length} />
          <Stat label="建议拉黑" value={blockFamilies.length} tone="accent" />
          <Stat label="只进复核" value={watchFamilies.length} tone="warn" />
          <Stat
            label="样本召回"
            value={`${(recall * 100).toFixed(0)}%`}
            hint={`反例误伤 ${(falseRate * 100).toFixed(0)}% · ${result.negativeTotal} 条`}
          />
        </div>

        {falseRate > 0.05 && (
          <Alert tone="warn" className="mt-4">
            当前力度在样本库上误伤了 {(falseRate * 100).toFixed(0)}% 的反例，建议把对应类别调回「标准」或加进放行名单。
          </Alert>
        )}

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3">
          <span className="text-[11.5px] text-faint">
            自检跑的是内置样本库（{result.targetTotal} 条正例 / {result.negativeTotal} 条反例），不是你的真实账号。
          </span>
          <Btn size="sm" variant="ghost" onClick={() => setTab('settings')}>
            看误伤细节
          </Btn>
        </div>

        <div className="mt-3 rounded-md border border-accent/25 bg-accent/[0.05] px-3 py-2 text-[11.5px] leading-relaxed text-dim">
          <span className="text-accent">一键执行</span> = 八类全开 + 激进 + 扫描完直接拉黑建议项。
          适用于「我不想看，直接清干净」；想先看证据就自己点「扫描」，复核后再拉。
        </div>
      </Panel>

      <Panel title="目标分类" count={FAMILIES.length}>
        <div className="divide-y divide-line">
          {FAMILIES.map((family) => {
            const pack = PACK_MAP.get(family.id)
            const mode = targets.modes[family.id]
            const on = mode !== 'off'
            return (
              <div key={family.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={cn('text-[13px] font-medium', on ? 'text-ink' : 'text-faint')}>
                      {family.label}
                    </span>
                    <span className="sd-mono text-[10.5px] text-faint">
                      {pack ? pack.rules.length : 0} 条规则
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11.5px] leading-relaxed text-faint">{family.desc}</div>
                </div>
                <Segmented
                  value={mode}
                  options={MODES.map((m) => ({ value: m.value, label: m.label }))}
                  onChange={(v) => setMode(family.id as FamilyId, v as FamilyMode)}
                  className="shrink-0"
                />
              </div>
            )
          })}
        </div>
      </Panel>

      <Panel
        title="补充"
        right={
          <Btn size="sm" variant="ghost" onClick={() => setAdvanced((v) => !v)}>
            {advanced ? '收起' : '展开'}
          </Btn>
        }
      >
        {!advanced ? (
          <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-faint">
            <Tag>{targets.extraMarkers.length} 条补充话术</Tag>
            <Tag>{targets.extraGuards.length} 条反驳语境</Tag>
            <Tag>{targets.allow.length} 个放行账号</Tag>
            <Tag>{targets.topics.length} 个额外检索词</Tag>
            <span>词库不可能写全，遇到规则没覆盖的说法就补在这里。</span>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <Field label="补充话术" hint={`${targets.extraMarkers.length} 条`}>
              <TextArea
                rows={5}
                value={listToText(targets.extraMarkers)}
                onChange={(e) => setTargets({ extraMarkers: textToList(e.target.value) })}
                placeholder={'一行一条，例如：\n这不就是缅北二游吗\n男的都不懂共情'}
              />
            </Field>
            <Field label="反驳语境" hint={`${targets.extraGuards.length} 条`}>
              <TextArea
                rows={5}
                value={listToText(targets.extraGuards)}
                onChange={(e) => setTargets({ extraGuards: textToList(e.target.value) })}
                placeholder={'出现这些词的窗口会被降权，例如：\n揭露\n辟谣\n我反对'}
              />
            </Field>
            <Field label="放行名单" hint={`${targets.allow.length} 个`}>
              <TextArea
                rows={4}
                value={listToText(targets.allow)}
                onChange={(e) => setTargets({ allow: textToList(e.target.value) })}
                placeholder={'昵称或签名包含这些片段就不拉黑，例如：\n观察者网\n澎湃新闻'}
              />
            </Field>
            <Field label="额外检索词" hint={`${targets.topics.length} 个`}>
              <TextArea
                rows={4}
                value={listToText(targets.topics)}
                onChange={(e) => setTargets({ topics: textToList(e.target.value) })}
                placeholder={'只决定去哪里找，不参与判定，例如：\n缅北二游\n一般向'}
              />
            </Field>
          </div>
        )}
      </Panel>
    </div>
  )
}
