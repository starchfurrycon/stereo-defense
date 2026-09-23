export interface Price {
  /** 输入价，美元 / 百万 token */
  input: number
  /** 输出价，美元 / 百万 token */
  output: number
}

/** 预设单价，可在设置里覆盖。价格随厂商调整，仅作估算。 */
export const PRICE_TABLE: Array<{ match: RegExp; label: string; price: Price }> = [
  { match: /^gpt-4o-mini/, label: 'GPT-4o mini', price: { input: 0.15, output: 0.6 } },
  { match: /^gpt-4o/, label: 'GPT-4o', price: { input: 2.5, output: 10 } },
  { match: /^gpt-4\.1-mini/, label: 'GPT-4.1 mini', price: { input: 0.4, output: 1.6 } },
  { match: /^gpt-4\.1-nano/, label: 'GPT-4.1 nano', price: { input: 0.1, output: 0.4 } },
  { match: /^gpt-4\.1/, label: 'GPT-4.1', price: { input: 2, output: 8 } },
  { match: /^gpt-5-mini/, label: 'GPT-5 mini', price: { input: 0.25, output: 2 } },
  { match: /^gpt-5/, label: 'GPT-5', price: { input: 1.25, output: 10 } },
  { match: /^o4-mini/, label: 'o4-mini', price: { input: 1.1, output: 4.4 } },
  { match: /^claude.*haiku/, label: 'Claude Haiku', price: { input: 0.8, output: 4 } },
  { match: /^claude.*sonnet/, label: 'Claude Sonnet', price: { input: 3, output: 15 } },
  { match: /^claude.*opus/, label: 'Claude Opus', price: { input: 15, output: 75 } },
  { match: /^gemini.*flash/, label: 'Gemini Flash', price: { input: 0.1, output: 0.4 } },
  { match: /^gemini/, label: 'Gemini', price: { input: 1.25, output: 10 } },
  { match: /^deepseek-reasoner/, label: 'DeepSeek R1', price: { input: 0.55, output: 2.19 } },
  { match: /^deepseek/, label: 'DeepSeek', price: { input: 0.27, output: 1.1 } },
  { match: /^qwen-plus/, label: 'Qwen Plus', price: { input: 0.4, output: 1.2 } },
  { match: /^qwen-turbo/, label: 'Qwen Turbo', price: { input: 0.05, output: 0.2 } },
  { match: /^qwen/, label: 'Qwen', price: { input: 1.6, output: 6.4 } },
  { match: /^glm-4-flash/, label: 'GLM-4 Flash', price: { input: 0, output: 0 } },
  { match: /^glm/, label: 'GLM', price: { input: 0.6, output: 0.6 } },
  { match: /^moonshot|^kimi/, label: 'Kimi', price: { input: 1.68, output: 1.68 } },
  { match: /^ernie/, label: 'ERNIE', price: { input: 0.55, output: 1.1 } },
  { match: /^hunyuan/, label: 'Hunyuan', price: { input: 0.55, output: 1.1 } },
]

export function lookupPrice(model: string): Price | null {
  const m = model.trim().toLowerCase()
  for (const entry of PRICE_TABLE) if (entry.match.test(m)) return entry.price
  return null
}

export function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  const price = lookupPrice(model)
  if (!price) return 0
  return (promptTokens / 1e6) * price.input + (completionTokens / 1e6) * price.output
}

export function formatCost(usd: number): string {
  if (!usd) return '$0'
  if (usd < 0.01) return `$${usd.toFixed(4)}`
  if (usd < 1) return `$${usd.toFixed(3)}`
  return `$${usd.toFixed(2)}`
}
