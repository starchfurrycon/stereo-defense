import { Btn, Field, Panel, Row, Rows, Select, Switch, TextInput } from '../ui'
import { useStore } from '../../lib/store'
import { setProxyPrefix } from '../../lib/bili/transport'
import { lookupPrice } from '../../lib/llm/pricing'

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

export function SettingsView() {
  const settings = useStore((s) => s.settings)
  const setLlm = useStore((s) => s.setLlm)
  const setSettings = useStore((s) => s.setSettings)
  const usage = useStore((s) => s.usage)

  const price = lookupPrice(settings.llm.model)
  const preset: PresetLabel = PRESETS.find((p) => p.url === settings.llm.baseUrl)?.label ?? '自定义'

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="模型">
        <div className="grid gap-4">
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

          <Field label="模型">
            <TextInput value={settings.llm.model} onChange={(e) => setLlm({ model: e.target.value })} spellCheck={false} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
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
            <div className="border-t border-line pt-4">
              <Rows>
                <Row label="输入">{usage.promptTokens.toLocaleString()}</Row>
                <Row label="输出">{usage.completionTokens.toLocaleString()}</Row>
                <Row label="调用">{usage.calls}</Row>
              </Rows>
            </div>
          )}
        </div>
      </Panel>

      <div className="grid content-start gap-4">
        <Panel title="通道">
          <div className="grid gap-4">
            <Field label="转发地址">
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
            <div className="border-t border-line pt-3">
              <Switch
                checked={settings.aiReview}
                onChange={(v) => setSettings({ aiReview: v })}
                label="边界候选自动复核"
              />
            </div>
          </div>
        </Panel>

        <Panel title="数据">
          <div className="flex flex-wrap gap-2">
            <Btn
              variant="danger"
              onClick={() => {
                useStore.getState().reset()
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
