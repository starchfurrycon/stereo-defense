import { Btn, Field, Panel, Select, TextInput, Toggle } from '../ui'
import { useStore } from '../../lib/store'
import { setProxyPrefix } from '../../lib/bili/transport'
import { lookupPrice } from '../../lib/llm/pricing'
import { MODEL_ID } from '../../lib/analyze/embed'

const PRESETS = [
  { label: 'OpenAI', url: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { label: 'DeepSeek', url: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { label: '阿里云百炼', url: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  { label: '智谱', url: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
  { label: '月之暗面', url: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
  { label: 'OpenRouter', url: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini' },
  { label: '自定义', url: '', model: '' },
]

export function SettingsView() {
  const settings = useStore((s) => s.settings)
  const setLlm = useStore((s) => s.setLlm)
  const setSettings = useStore((s) => s.setSettings)
  const usage = useStore((s) => s.usage)

  const price = lookupPrice(settings.llm.model)

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="模型">
        <div className="grid gap-3">
          <Field label="服务">
            <Select
              value={PRESETS.find((p) => p.url === settings.llm.baseUrl)?.label ?? '自定义'}
              onChange={(e) => {
                const p = PRESETS.find((x) => x.label === e.target.value)
                if (p && p.url) setLlm({ baseUrl: p.url, model: p.model })
              }}
            >
              {PRESETS.map((p) => (
                <option key={p.label} value={p.label}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="地址">
            <TextInput
              value={settings.llm.baseUrl}
              onChange={(e) => setLlm({ baseUrl: e.target.value })}
              spellCheck={false}
            />
          </Field>
          <Field label="密钥">
            <TextInput
              type="password"
              value={settings.llm.apiKey}
              onChange={(e) => setLlm({ apiKey: e.target.value })}
              spellCheck={false}
            />
          </Field>
          <Field label="模型">
            <TextInput value={settings.llm.model} onChange={(e) => setLlm({ model: e.target.value })} spellCheck={false} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="输入单价" hint="$/百万">
              <TextInput
                type="number"
                step="0.01"
                value={settings.llm.priceInput ?? ''}
                placeholder={price ? String(price.input) : '0'}
                onChange={(e) => setLlm({ priceInput: e.target.value === '' ? undefined : Number(e.target.value) })}
              />
            </Field>
            <Field label="输出单价" hint="$/百万">
              <TextInput
                type="number"
                step="0.01"
                value={settings.llm.priceOutput ?? ''}
                placeholder={price ? String(price.output) : '0'}
                onChange={(e) => setLlm({ priceOutput: e.target.value === '' ? undefined : Number(e.target.value) })}
              />
            </Field>
          </div>
          {usage && (
            <div className="border border-line px-3 py-2 text-[12px]">
              <div className="flex justify-between">
                <span className="text-faint">输入</span>
                <span className="sd-mono">{usage.promptTokens.toLocaleString()}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-faint">输出</span>
                <span className="sd-mono">{usage.completionTokens.toLocaleString()}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-faint">调用</span>
                <span className="sd-mono">{usage.calls}</span>
              </div>
            </div>
          )}
        </div>
      </Panel>

      <div className="grid content-start gap-4">
        <Panel title="通道">
          <div className="grid gap-3">
            <Field label="转发地址" hint="可选">
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
            <Toggle
              checked={settings.aiReview}
              onChange={(v) => setSettings({ aiReview: v })}
              label="边界候选自动复核"
            />
          </div>
        </Panel>

        <Panel title="本地模型">
          <div className="sd-mono text-[12px] break-all text-dim">{MODEL_ID}</div>
        </Panel>

        <Panel title="数据">
          <div className="flex flex-wrap gap-2">
            <Btn
              tone="danger"
              onClick={() => {
                useStore.getState().reset()
                useStore.getState().setCandidates([])
                useStore.getState().setIgnored([])
              }}
            >
              清空扫描结果
            </Btn>
            <Btn
              tone="danger"
              onClick={() => {
                useStore.getState().setBlacklist([])
                useStore.getState().setProfile(null)
                useStore.getState().setRawInput('')
                useStore.getState().addUsage(null)
              }}
            >
              清空全部
            </Btn>
          </div>
        </Panel>
      </div>
    </div>
  )
}
