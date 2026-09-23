/**
 * 内置小模型：bge-small-zh-v1.5（ONNX，量化）。
 *
 * 仅在未配置 LLM API 时用于语义比对。模型运行时按需从 CDN 加载，
 * 不打包进产物（否则会带上 70MB+ 的 ONNX 运行时）。
 * 任何一步失败都降级为纯词表引擎，功能不受阻断。
 */

export const MODEL_ID = 'onnx-community/bge-small-zh-v1.5-ONNX'

const RUNTIME_CDNS = [
  'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.0/+esm',
  'https://esm.sh/@huggingface/transformers@4.3.0',
]

export type EmbedStatus = 'idle' | 'loading' | 'ready' | 'unavailable'

type FeatureExtractor = (
  input: string | string[],
  options: { pooling: 'cls'; normalize: boolean },
) => Promise<{ tolist: () => number[][] }>

interface TransformersModule {
  env: { allowLocalModels: boolean; useBrowserCache: boolean }
  pipeline: (task: string, model: string, options: Record<string, unknown>) => Promise<unknown>
}

let extractor: FeatureExtractor | null = null
let loading: Promise<FeatureExtractor | null> | null = null
let status: EmbedStatus = 'idle'
let listeners: Array<(s: EmbedStatus, detail?: string) => void> = []

export function onEmbedStatus(fn: (s: EmbedStatus, detail?: string) => void): () => void {
  listeners.push(fn)
  return () => {
    listeners = listeners.filter((l) => l !== fn)
  }
}

function emit(s: EmbedStatus, detail?: string): void {
  status = s
  for (const l of listeners) l(s, detail)
}

export function embedStatus(): EmbedStatus {
  return status
}

const cache = new Map<string, Float32Array>()

async function importRuntime(): Promise<TransformersModule> {
  let lastError = ''
  for (const url of RUNTIME_CDNS) {
    try {
      const mod = (await import(/* @vite-ignore */ url)) as unknown as TransformersModule
      if (typeof mod?.pipeline === 'function') return mod
      lastError = '运行时导出异常'
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
    }
  }
  throw new Error(lastError || '运行时不可用')
}

export async function loadEmbedder(): Promise<FeatureExtractor | null> {
  if (extractor) return extractor
  if (loading) return loading
  emit('loading')
  loading = (async () => {
    try {
      const tf = await importRuntime()
      tf.env.allowLocalModels = false
      tf.env.useBrowserCache = true
      const pipe = await tf.pipeline('feature-extraction', MODEL_ID, { dtype: 'q8' })
      extractor = pipe as FeatureExtractor
      emit('ready')
      return extractor
    } catch (err) {
      emit('unavailable', err instanceof Error ? err.message : String(err))
      return null
    } finally {
      loading = null
    }
  })()
  return loading
}

/** 返回归一化向量；模型不可用时返回 null。 */
export async function embed(texts: string[]): Promise<Float32Array[] | null> {
  if (!texts.length) return []
  const missing = texts.filter((t) => !cache.has(t))
  if (missing.length) {
    const ex = await loadEmbedder()
    if (!ex) return null
    try {
      const out = await ex(missing, { pooling: 'cls', normalize: true })
      const rows = out.tolist()
      missing.forEach((text, i) => cache.set(text, Float32Array.from(rows[i])))
    } catch {
      emit('unavailable', '推理失败')
      return null
    }
  }
  return texts.map((t) => cache.get(t)).filter((v): v is Float32Array => Boolean(v))
}

export function cosine(a: Float32Array, b: Float32Array): number {
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  if (!na || !nb) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

/** bge 相似度集中在 0.4~0.9，映射到 0..1 便于设阈值。 */
export function normalizeSimilarity(raw: number): number {
  const lo = 0.36
  const hi = 0.86
  return Math.max(0, Math.min(1, (raw - lo) / (hi - lo)))
}
