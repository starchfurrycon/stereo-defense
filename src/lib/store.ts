import { create } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'
import { DEFAULT_LLM, mergeUsage, type LlmConfig } from './llm/provider'
import { DEFAULT_BUDGET, DEFAULT_SOURCES, type ScanBudget, type ScanSources } from './scan'
import { presetTargets } from './verdict'
import type { BlackEntry, Candidate, FamilyId, FamilyMode, Preset, Targets, Usage } from './types'

declare const GM_setValue: ((k: string, v: unknown) => void) | undefined
declare const GM_getValue: ((k: string, d?: unknown) => unknown) | undefined
declare const GM_deleteValue: ((k: string) => void) | undefined

/** 用户脚本环境优先写入脚本存储，跨页面导航不丢数据。 */
const gmStorage: StateStorage | null =
  typeof GM_setValue === 'function' && typeof GM_getValue === 'function'
    ? {
        getItem: (name) => {
          const v = GM_getValue!(name, null)
          return typeof v === 'string' ? v : v == null ? null : JSON.stringify(v)
        },
        setItem: (name, value) => GM_setValue!(name, value),
        removeItem: (name) => GM_deleteValue?.(name),
      }
    : null

/**
 * localStorage 只有 5MB，一次大扫描的候选很容易撑满。
 * 配额爆了就退化成「只存设置与名单」，保证界面不会因为写不进去而崩。
 */
function resilientStorage(base: StateStorage): StateStorage {
  return {
    getItem: (name) => {
      try {
        return base.getItem(name)
      } catch {
        return null
      }
    },
    setItem: (name, value) => {
      try {
        base.setItem(name, value)
      } catch {
        try {
          const parsed = JSON.parse(value) as { state?: Record<string, unknown> }
          if (parsed.state) {
            parsed.state.candidates = []
            base.setItem(name, JSON.stringify(parsed))
          }
        } catch {
          /* 写不进去就算了，下次再说 */
        }
      }
    },
    removeItem: (name) => {
      try {
        base.removeItem(name)
      } catch {
        /* ignore */
      }
    },
  }
}

export interface Settings {
  llm: LlmConfig
  budget: ScanBudget
  sources: ScanSources
  proxy: string
  concurrency: number
  /** 用 LLM 复核边界候选 */
  aiReview: boolean
  /** 扫描完成后直接拉黑「建议拉黑」，跳过复核 */
  autoBlock: boolean
}

export interface AccountState {
  mid: number
  uname: string
  csrf: string
  level: number
  ok: boolean
  checked: boolean
  /** 线上黑名单已有条数 */
  blockedTotal: number
}

export type Tab = 'targets' | 'scan' | 'review' | 'blacklist' | 'settings'

interface State {
  tab: Tab
  setTab: (t: Tab) => void
  settings: Settings
  account: AccountState
  targets: Targets
  candidates: Candidate[]
  blacklist: BlackEntry[]
  ignored: number[]
  usage: Usage | null
  lastScan: number
  /** 上一次批量拉黑的 mid，用于一键撤销 */
  lastBatch: number[]
  setLastBatch: (mids: number[]) => void
  setSettings: (patch: Partial<Settings>) => void
  setLlm: (patch: Partial<LlmConfig>) => void
  setBudget: (patch: Partial<ScanBudget>) => void
  setSources: (patch: Partial<ScanSources>) => void
  setTargets: (patch: Partial<Targets>) => void
  setMode: (family: FamilyId, mode: FamilyMode) => void
  setPreset: (preset: Preset) => void
  setAccount: (patch: Partial<AccountState>) => void
  setCandidates: (c: Candidate[]) => void
  patchCandidate: (mid: number, patch: Partial<Candidate>) => void
  setBlacklist: (b: BlackEntry[]) => void
  addBlacklist: (entries: BlackEntry[]) => void
  removeBlacklist: (mids: number[]) => void
  setIgnored: (ids: number[]) => void
  addUsage: (u: Usage | null) => void
  reset: () => void
}

const initialSettings: Settings = {
  llm: { ...DEFAULT_LLM },
  budget: { ...DEFAULT_BUDGET },
  sources: { ...DEFAULT_SOURCES },
  proxy: '',
  concurrency: 2,
  aiReview: false,
  autoBlock: false,
}

const initialTargets: Targets = {
  modes: presetTargets('standard'),
  preset: 'standard',
  extraMarkers: [],
  extraGuards: [],
  allow: [],
  topics: [],
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      tab: 'targets',
      setTab: (t) => set({ tab: t }),
      settings: initialSettings,
      account: { mid: 0, uname: '', csrf: '', level: 0, ok: false, checked: false, blockedTotal: 0 },
      targets: initialTargets,
      candidates: [],
      blacklist: [],
      ignored: [],
      usage: null,
      lastScan: 0,
      lastBatch: [],
      setLastBatch: (mids) => set({ lastBatch: mids }),
      setSettings: (patch) => set({ settings: { ...get().settings, ...patch } }),
      setLlm: (patch) => set({ settings: { ...get().settings, llm: { ...get().settings.llm, ...patch } } }),
      setBudget: (patch) => set({ settings: { ...get().settings, budget: { ...get().settings.budget, ...patch } } }),
      setSources: (patch) => set({ settings: { ...get().settings, sources: { ...get().settings.sources, ...patch } } }),
      setTargets: (patch) => set({ targets: { ...get().targets, ...patch } }),
      setMode: (family, mode) =>
        set({ targets: { ...get().targets, modes: { ...get().targets.modes, [family]: mode } } }),
      setPreset: (preset) => set({ targets: { ...get().targets, preset, modes: presetTargets(preset) } }),
      setAccount: (patch) => set({ account: { ...get().account, ...patch } }),
      setCandidates: (c) => set({ candidates: c, lastScan: Date.now() }),
      patchCandidate: (mid, patch) =>
        set({ candidates: get().candidates.map((c) => (c.mid === mid ? { ...c, ...patch } : c)) }),
      setBlacklist: (b) => set({ blacklist: b }),
      addBlacklist: (entries) => {
        const map = new Map(get().blacklist.map((e) => [e.mid, e]))
        for (const e of entries) map.set(e.mid, e)
        set({ blacklist: [...map.values()] })
      },
      removeBlacklist: (mids) => {
        const drop = new Set(mids)
        set({ blacklist: get().blacklist.filter((e) => !drop.has(e.mid)) })
      },
      setIgnored: (ids) => set({ ignored: ids }),
      addUsage: (u) => {
        if (!u) return
        const prev = get().usage
        set({ usage: prev ? mergeUsage(prev, u) : u })
      },
      reset: () => set({ candidates: [], usage: null, ignored: [] }),
    }),
    {
      name: 'stereo-defense',
      storage: createJSONStorage(() => resilientStorage(gmStorage ?? localStorage)),
      version: 2,
      partialize: (s) => ({
        settings: s.settings,
        account: s.account,
        targets: s.targets,
        candidates: s.candidates,
        blacklist: s.blacklist,
        ignored: s.ignored,
        usage: s.usage,
        lastScan: s.lastScan,
        lastBatch: s.lastBatch,
      }),
    },
  ),
)

export function enableCount(targets: Targets): number {
  return Object.values(targets.modes).filter((m) => m !== 'off').length
}
