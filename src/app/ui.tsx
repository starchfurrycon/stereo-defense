import {
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/* ------------------------------------------------------------------ *
 * 线性图标：只用描边，不引入任何图片素材
 * ------------------------------------------------------------------ */

const PATHS = {
  check: 'M3.5 8.2 6.4 11l6.1-6.4',
  chevronDown: 'M3.6 6.2 8 10.4l4.4-4.2',
  chevronRight: 'M6.2 3.6 10.4 8l-4.2 4.4',
  close: 'M4 4l8 8M12 4l-8 8',
  external: 'M6.5 3.5h6v6M12.5 3.5 4 12',
  plus: 'M8 3.5v9M3.5 8h9',
  minus: 'M3.5 8h9',
} as const

export function Icon({
  name,
  className,
  size = 16,
}: {
  name: keyof typeof PATHS
  className?: string
  size?: number
}) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn('shrink-0', className)}
    >
      <path d={PATHS[name]} />
    </svg>
  )
}

/* ------------------------------------------------------------------ *
 * 面板
 * ------------------------------------------------------------------ */

export function Panel({
  title,
  count,
  right,
  children,
  className,
  bodyClassName,
  flush = false,
}: {
  title?: ReactNode
  count?: ReactNode
  right?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
  flush?: boolean
}) {
  return (
    <section className={cn('sd-panel', className)}>
      {title !== undefined && (
        <header className="flex min-h-[42px] items-center justify-between gap-4 border-b border-line px-4 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="text-[11px] font-medium tracking-[0.09em] text-dim uppercase">{title}</h2>
            {count !== undefined && (
              <span className="sd-mono rounded-full bg-line px-1.5 py-px text-[10px] leading-4 text-faint">{count}</span>
            )}
          </div>
          {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
        </header>
      )}
      <div className={cn(flush ? '' : 'p-4', bodyClassName)}>{children}</div>
    </section>
  )
}

/* ------------------------------------------------------------------ *
 * 按钮
 * ------------------------------------------------------------------ */

type BtnVariant = 'primary' | 'default' | 'ghost' | 'danger'
type BtnSize = 'sm' | 'md'

const BTN_VARIANT: Record<BtnVariant, string> = {
  primary: 'sd-primary',
  default:
    'border-line2 bg-raise text-ink hover:bg-hover hover:border-faint/60 shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]',
  ghost: 'border-transparent text-dim hover:text-ink hover:bg-raise',
  danger: 'sd-danger',
}

const BTN_SIZE: Record<BtnSize, string> = {
  sm: 'h-7 px-2.5 text-[12px] rounded-sm gap-1.5',
  md: 'h-8 px-3 text-[12.5px] rounded-md gap-1.5',
}

export function Btn({
  variant = 'default',
  size = 'md',
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: BtnSize }) {
  return (
    <button
      type="button"
      {...rest}
      className={cn(
        'inline-flex select-none items-center justify-center border font-medium whitespace-nowrap transition-colors duration-100',
        'focus-visible:ring-2 focus-visible:ring-accent/30 disabled:pointer-events-none disabled:opacity-35',
        BTN_SIZE[size],
        BTN_VARIANT[variant],
        className,
      )}
    >
      {children}
    </button>
  )
}

/* ------------------------------------------------------------------ *
 * 表单
 * ------------------------------------------------------------------ */

const FIELD_BASE =
  'sd-inset sd-focusable w-full px-2.5 text-[13px] text-ink transition-[border-color,box-shadow] placeholder:text-faint disabled:opacity-40'

export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={cn(FIELD_BASE, 'h-8', className)} />
}

export function TextArea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={cn(FIELD_BASE, 'resize-y py-2 leading-[1.7]', className)} />
}

/** 数字输入：右侧带步进按钮，避免原生 spinner 的样式差异。 */
export function NumberInput({
  value,
  onChange,
  min = 0,
  max = 9999,
  className,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  className?: string
}) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n))
  return (
    <div className={cn('sd-inset sd-focusable flex h-8 items-center pr-1 transition-[border-color,box-shadow]', className)}>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (Number.isFinite(n)) onChange(clamp(n))
        }}
        className="sd-mono h-full w-full min-w-0 bg-transparent px-2.5 text-[13px] text-ink"
      />
      <div className="flex shrink-0 flex-col">
        <button
          type="button"
          aria-label="增加"
          onClick={() => onChange(clamp(value + 1))}
          className="flex h-3.5 w-5 items-center justify-center rounded-[3px] text-faint transition-colors hover:bg-hover hover:text-ink"
        >
          <Icon name="plus" size={9} />
        </button>
        <button
          type="button"
          aria-label="减少"
          onClick={() => onChange(clamp(value - 1))}
          className="flex h-3.5 w-5 items-center justify-center rounded-[3px] text-faint transition-colors hover:bg-hover hover:text-ink"
        >
          <Icon name="minus" size={9} />
        </button>
      </div>
    </div>
  )
}

/** 下拉选择。不用 portal，避免 Shadow DOM 下的定位问题。 */
export function Select<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (v: T) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const root = (ref.current?.getRootNode() ?? document) as Document | ShadowRoot
    const onDown = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: Event) => {
      if ((e as KeyboardEvent).key === 'Escape') setOpen(false)
    }
    root.addEventListener('mousedown', onDown)
    root.addEventListener('keydown', onKey)
    return () => {
      root.removeEventListener('mousedown', onDown)
      root.removeEventListener('keydown', onKey)
    }
  }, [open])

  const current = options.find((o) => o.value === value)

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'sd-inset flex h-8 w-full items-center justify-between gap-2 px-2.5 text-left text-[13px] text-ink',
          'transition-[border-color]',
          open && 'border-accent/55',
        )}
      >
        <span className="truncate">{current?.label ?? value}</span>
        <Icon
          name="chevronDown"
          size={14}
          className={cn('text-faint transition-transform duration-150', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className={cn(
            'absolute top-[calc(100%+5px)] left-0 z-30 max-h-64 w-full overflow-auto p-1',
            'rounded-lg border border-line2 bg-raise shadow-[0_12px_32px_rgb(0_0_0/0.6)]',
          )}
        >
          {options.map((o) => {
            const active = o.value === value
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(o.value)
                  setOpen(false)
                }}
                className={cn(
                  'flex h-7 w-full items-center justify-between gap-2 rounded-sm px-2 text-left text-[12.5px] transition-colors',
                  active ? 'text-accent' : 'text-dim hover:bg-hover hover:text-ink',
                )}
              >
                <span className="truncate">{o.label}</span>
                {active && <Icon name="check" size={13} />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: ReactNode
  hint?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <label className={cn('block', className)}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-[12px] font-medium text-dim">{label}</span>
        {hint && <span className="sd-mono text-[11px] text-faint">{hint}</span>}
      </div>
      {children}
    </label>
  )
}

export function Switch({
  checked,
  onChange,
  label,
  className,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'group flex w-full items-center gap-2.5 rounded-sm py-1 text-left transition-colors',
        'focus-visible:ring-2 focus-visible:ring-accent/30',
        className,
      )}
    >
      <span
        className={cn(
          'relative h-[18px] w-8 shrink-0 rounded-full border transition-colors duration-150',
          checked
            ? 'border-accent/50 bg-accent/25'
            : 'border-line2 bg-raise group-hover:border-faint/60',
        )}
      >
        <span
          className={cn(
            'absolute top-[2px] h-[12px] w-[12px] rounded-full transition-all duration-150',
            checked ? 'left-[16px] bg-accent' : 'left-[2px] bg-faint group-hover:bg-dim',
          )}
        />
      </span>
      <span className={cn('text-[12.5px] transition-colors', checked ? 'text-ink' : 'text-dim')}>{label}</span>
    </button>
  )
}

export function Checkbox({
  checked,
  onChange,
  className,
}: {
  checked: boolean
  onChange: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onChange}
      className={cn(
        'flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-[4px] border transition-colors duration-100',
        'focus-visible:ring-2 focus-visible:ring-accent/30',
        checked
          ? 'border-accent/70 bg-accent/25 text-accent'
          : 'border-line2 text-transparent hover:border-faint',
        className,
      )}
    >
      <Icon name="check" size={11} />
    </button>
  )
}

/* ------------------------------------------------------------------ *
 * 展示
 * ------------------------------------------------------------------ */

type Tone = 'dim' | 'accent' | 'warn' | 'danger' | 'ok'

const TAG_TONE: Record<Tone, string> = {
  dim: 'border-line2 bg-raise text-dim',
  accent: 'border-accent/30 bg-accent/10 text-accent',
  warn: 'border-warn/30 bg-warn/10 text-warn',
  danger: 'border-danger/30 bg-danger/10 text-danger',
  ok: 'border-ok/30 bg-ok/10 text-ok',
}

export function Tag({
  children,
  tone = 'dim',
  className,
}: {
  children: ReactNode
  tone?: Tone
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-px text-[11px] leading-[16px] whitespace-nowrap',
        TAG_TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

/** 数值面板：靠字号而不是颜色制造重点。 */
export function Stat({
  label,
  value,
  tone = 'ink',
  hint,
  className,
}: {
  label: ReactNode
  value: ReactNode
  tone?: 'ink' | Tone
  hint?: ReactNode
  className?: string
}) {
  const color = {
    ink: 'text-ink',
    dim: 'text-dim',
    accent: 'text-accent',
    warn: 'text-warn',
    danger: 'text-danger',
    ok: 'text-ok',
  }[tone]

  return (
    <div className={cn('sd-panel px-4 py-3', className)}>
      <div className="text-[11px] font-medium tracking-[0.07em] text-faint uppercase">{label}</div>
      <div className={cn('sd-mono mt-1.5 text-[24px] leading-none font-medium', color)}>{value}</div>
      {hint && <div className="mt-1.5 text-[11px] text-faint">{hint}</div>}
    </div>
  )
}

export function Meter({
  value,
  width = 56,
  showValue = true,
  className,
}: {
  value: number
  width?: number
  showValue?: boolean
  className?: string
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100
  const tone = value >= 0.72 ? 'var(--color-accent)' : value >= 0.42 ? 'var(--color-warn)' : 'var(--color-faint)'
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span className="h-1 overflow-hidden rounded-full bg-line2" style={{ width }}>
        <span
          className="block h-full rounded-full transition-[width] duration-300"
          style={{ width: `${pct}%`, background: tone }}
        />
      </span>
      {showValue && <span className="sd-mono w-[30px] text-[11px] text-dim">{(value * 100).toFixed(0)}</span>}
    </span>
  )
}

export function Progress({ value, live = false }: { value: number; live?: boolean }) {
  const pct = Math.max(0, Math.min(1, value)) * 100
  return (
    <div className="sd-progress">
      <div className={cn('sd-progress-fill', live && 'sd-progress-live')} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="sd-rule w-16" />
      <p className="text-[12.5px] text-faint">{children}</p>
      {action}
    </div>
  )
}

export function Alert({
  tone = 'warn',
  children,
  className,
}: {
  tone?: 'warn' | 'danger' | 'accent'
  children: ReactNode
  className?: string
}) {
  const map = {
    warn: 'border-warn/25 bg-warn/[0.07] text-warn',
    danger: 'border-danger/25 bg-danger/[0.07] text-danger',
    accent: 'border-accent/25 bg-accent/[0.07] text-accent',
  }
  return (
    <div className={cn('flex items-start gap-2.5 rounded-md border px-3 py-2 text-[12px]', map[tone], className)}>
      <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
      <span className="min-w-0">{children}</span>
    </div>
  )
}

/** 键值行，用于通道、用量等只读信息。 */
export function Rows({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('divide-y divide-line', className)}>{children}</div>
}

export function Row({
  label,
  children,
  className,
}: {
  label: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-center justify-between gap-4 py-2 first:pt-0 last:pb-0', className)}>
      <span className="text-[12px] text-faint">{label}</span>
      <span className="sd-mono text-[12px] text-ink">{children}</span>
    </div>
  )
}

/** 分段控件，用于二选一/三选一的筛选。 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T
  options: Array<{ value: T; label: ReactNode }>
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <div className={cn('inline-flex items-center gap-0.5 rounded-md border border-line bg-raise p-0.5', className)}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex h-6 items-center gap-1.5 rounded-[5px] px-2.5 text-[12px] transition-colors duration-100',
              active
                ? 'bg-hover text-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.05)]'
                : 'text-faint hover:text-dim',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
