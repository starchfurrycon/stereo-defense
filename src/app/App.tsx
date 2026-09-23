import { useEffect } from 'react'
import { useStore, type Tab } from '../lib/store'
import { AccountView } from './views/Account'
import { ProfileView } from './views/ProfileView'
import { ScanView } from './views/ScanView'
import { ReviewView } from './views/ReviewView'
import { BlacklistView } from './views/BlacklistView'
import { SettingsView } from './views/SettingsView'
import { setProxyPrefix, limiter } from '../lib/bili/transport'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'account', label: '账号' },
  { id: 'profile', label: '画像' },
  { id: 'scan', label: '扫描' },
  { id: 'review', label: '复核' },
  { id: 'blacklist', label: '黑名单' },
  { id: 'settings', label: '设置' },
]

export function App({ onClose }: { onClose?: () => void }) {
  const tab = useStore((s) => s.tab)
  const setTab = useStore((s) => s.setTab)
  const account = useStore((s) => s.account)
  const candidates = useStore((s) => s.candidates)
  const proxy = useStore((s) => s.settings.proxy)
  const concurrency = useStore((s) => s.settings.concurrency)

  useEffect(() => {
    setProxyPrefix(proxy)
  }, [proxy])

  useEffect(() => {
    limiter.setConcurrency(concurrency)
  }, [concurrency])

  const pending = candidates.filter((c) => c.verdict !== 'skip' && !c.blocked).length

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3">
          <span className="text-[13px] tracking-[0.2em] text-ink">立体防御</span>
          <nav className="flex flex-wrap items-center gap-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`border px-2.5 py-1 text-[12px] transition-colors ${
                  tab === t.id ? 'border-accent/50 text-accent' : 'border-transparent text-faint hover:text-dim'
                }`}
              >
                {t.label}
                {t.id === 'review' && pending > 0 && <span className="sd-mono ml-1 text-warn">{pending}</span>}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="sd-mono text-[11px] text-faint">{account.ok ? account.uname : '未登录'}</span>
            {onClose && (
              <button onClick={onClose} className="text-[12px] text-faint hover:text-ink">
                关闭
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1180px] flex-1 px-5 py-5">
        {tab === 'account' && <AccountView />}
        {tab === 'profile' && <ProfileView />}
        {tab === 'scan' && <ScanView />}
        {tab === 'review' && <ReviewView />}
        {tab === 'blacklist' && <BlacklistView />}
        {tab === 'settings' && <SettingsView />}
      </main>
    </div>
  )
}
