import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useStore, type Tab } from '../lib/store'
import { AccountView } from './views/Account'
import { ProfileView } from './views/ProfileView'
import { ScanView } from './views/ScanView'
import { ReviewView } from './views/ReviewView'
import { BlacklistView } from './views/BlacklistView'
import { SettingsView } from './views/SettingsView'
import { setProxyPrefix, limiter } from '../lib/bili/transport'
import { cn } from './ui'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'account', label: '账号' },
  { id: 'profile', label: '画像' },
  { id: 'scan', label: '扫描' },
  { id: 'review', label: '复核' },
  { id: 'blacklist', label: '黑名单' },
  { id: 'settings', label: '设置' },
]

/** 三层叠线，取「立体」之意。纯描边，不使用任何图片素材。 */
function Mark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width={18}
      height={18}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M10 2.6 2.8 6.2 10 9.8l7.2-3.6L10 2.6Z" />
      <path d="M2.8 10.2 10 13.8l7.2-3.6" />
      <path d="M2.8 14 10 17.6 17.2 14" />
    </svg>
  )
}

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

  // 下划线跟随当前标签滑动
  const navRef = useRef<HTMLElement>(null)
  const [indicator, setIndicator] = useState({ left: 0, width: 0, ready: false })

  useLayoutEffect(() => {
    const nav = navRef.current
    if (!nav) return
    const measure = () => {
      const el = nav.querySelector<HTMLElement>(`[data-tab="${tab}"]`)
      if (el) setIndicator({ left: el.offsetLeft, width: el.offsetWidth, ready: true })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(nav)
    return () => ro.disconnect()
  }, [tab, pending])

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1180px] items-center gap-6 px-6">
          <div className="flex shrink-0 items-center gap-2.5">
            <Mark className="text-accent" />
            <span className="text-[13.5px] font-medium tracking-[0.02em] text-ink">立体防御</span>
          </div>

          <nav ref={navRef} className="relative flex items-center gap-0.5">
            {TABS.map((t) => {
              const active = tab === t.id
              return (
                <button
                  key={t.id}
                  data-tab={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'relative flex h-14 items-center gap-1.5 px-3 text-[13px] transition-colors duration-150',
                    active ? 'text-ink' : 'text-faint hover:text-dim',
                  )}
                >
                  {t.label}
                  {t.id === 'review' && pending > 0 && (
                    <span className="sd-mono rounded-full bg-warn/15 px-1.5 py-px text-[10px] leading-4 text-warn">
                      {pending > 999 ? '999+' : pending}
                    </span>
                  )}
                </button>
              )
            })}
            <span
              aria-hidden="true"
              className={cn(
                'pointer-events-none absolute bottom-0 h-px bg-accent transition-[left,width,opacity] duration-200 ease-out',
                indicator.ready ? 'opacity-100' : 'opacity-0',
              )}
              style={{ left: indicator.left, width: indicator.width }}
            />
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-3">
            <span className="flex items-center gap-2 rounded-full border border-line bg-raise py-1 pr-3 pl-2.5">
              <span
                className={cn('h-1.5 w-1.5 rounded-full', account.ok ? 'bg-ok' : 'bg-faint')}
                aria-hidden="true"
              />
              <span className="max-w-[140px] truncate text-[12px] text-dim">
                {account.ok ? account.uname : '未登录'}
              </span>
            </span>
            {onClose && (
              <button
                onClick={onClose}
                className="rounded-sm px-2 py-1 text-[12px] text-faint transition-colors hover:bg-raise hover:text-ink"
              >
                关闭
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-[1180px] flex-1 px-6 py-6">
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
