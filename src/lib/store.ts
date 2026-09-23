import { create } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'
import { DEFAULT_LLM, mergeUsage, type LlmConfig } from './llm/provider'
import { DEFAULT_BUDGET, type ScanBudget } from './scan'
import { DEFAULT_THRESHOLDS, type Thresholds } from './analyze/score'
import type { BlackEntry, Candidate, Profile, Usage } from './types'

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

export interface Settings {
  llm: LlmConfig
  budget: ScanBudget
  thresholds: Thresholds
  proxy: string
  concurrency: number
  /** 用 LLM 复核边界候选 */
  aiReview: boolean
}

export interface AccountState {
  mid: number
  uname: string
  csrf: string
  ok: boolean
  checked: boolean
}

export type Tab = 'account' | 'profile' | 'scan' | 'review' | 'blacklist' | 'settings'

interface State {
  tab: Tab
  setTab: (t: Tab) => void
  settings: Settings
  account: AccountState
  rawInput: string
  profile: Profile | null
  candidates: Candidate[]
  blacklist: BlackEntry[]
  ignored: number[]
  usage: Usage | null
  setSettings: (patch: Partial<Settings>) => void
  setLlm: (patch: Partial<LlmConfig>) => void
  setBudget: (patch: Partial<ScanBudget>) => void
  setThresholds: (patch: Partial<Thresholds>) => void
  setAccount: (patch: Partial<AccountState>) => void
  setRawInput: (v: string) => void
  setProfile: (p: Profile | null) => void
  setCandidates: (c: Candidate[]) => void
  patchCandidate: (mid: number, patch: Partial<Candidate>) => void
  setBlacklist: (b: BlackEntry[]) => void
  addBlacklist: (entries: BlackEntry[]) => void
  setIgnored: (ids: number[]) => void
  addUsage: (u: Usage | null) => void
  reset: () => void
}

const initialSettings: Settings = {
  llm: { ...DEFAULT_LLM },
  budget: { ...DEFAULT_BUDGET },
  thresholds: { ...DEFAULT_THRESHOLDS },
  proxy: '',
  concurrency: 2,
  aiReview: false,
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      tab: 'account',
      setTab: (t) => set({ tab: t }),
      settings: initialSettings,
      account: { mid: 0, uname: '', csrf: '', ok: false, checked: false },
      rawInput: '',
      profile: null,
      candidates: [],
      blacklist: [],
      ignored: [],
      usage: null,
      setSettings: (patch) => set({ settings: { ...get().settings, ...patch } }),
      setLlm: (patch) => set({ settings: { ...get().settings, llm: { ...get().settings.llm, ...patch } } }),
      setBudget: (patch) => set({ settings: { ...get().settings, budget: { ...get().settings.budget, ...patch } } }),
      setThresholds: (patch) =>
        set({ settings: { ...get().settings, thresholds: { ...get().settings.thresholds, ...patch } } }),
      setAccount: (patch) => set({ account: { ...get().account, ...patch } }),
      setRawInput: (v) => set({ rawInput: v }),
      setProfile: (p) => set({ profile: p }),
      setCandidates: (c) => set({ candidates: c }),
      patchCandidate: (mid, patch) =>
        set({ candidates: get().candidates.map((c) => (c.mid === mid ? { ...c, ...patch } : c)) }),
      setBlacklist: (b) => set({ blacklist: b }),
      addBlacklist: (entries) => {
        const map = new Map(get().blacklist.map((e) => [e.mid, e]))
        for (const e of entries) map.set(e.mid, e)
        set({ blacklist: [...map.values()] })
      },
      setIgnored: (ids) => set({ ignored: ids }),
      addUsage: (u) => {
        if (!u) return
        const prev = get().usage
        set({ usage: prev ? mergeUsage(prev, u) : u })
      },
      reset: () => set({ candidates: [], profile: null, usage: null, ignored: [] }),
    }),
    {
      name: 'stereo-defense',
      storage: createJSONStorage(() => gmStorage ?? localStorage),
      version: 1,
      partialize: (s) => ({
        settings: s.settings,
        account: { ...s.account, csrf: s.account.csrf },
        rawInput: s.rawInput,
        profile: s.profile,
        candidates: s.candidates,
        blacklist: s.blacklist,
        ignored: s.ignored,
        usage: s.usage,
      }),
    },
  ),
)
