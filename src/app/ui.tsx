import type { ReactNode, InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, ButtonHTMLAttributes } from 'react'

export function Panel({
  title,
  right,
  children,
  className = '',
}: {
  title?: string
  right?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`border border-line bg-panel ${className}`}>
      {title && (
        <header className="flex items-center justify-between gap-4 border-b border-line px-4 py-2.5">
          <h2 className="text-[12px] tracking-[0.14em] text-dim uppercase">{title}</h2>
          {right}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-baseline gap-2">
        <span className="text-[12px] text-dim">{label}</span>
        {hint && <span className="text-[11px] text-faint">{hint}</span>}
      </div>
      {children}
    </label>
  )
}

const inputBase =
  'w-full border border-line bg-raise px-2.5 py-1.5 text-[13px] text-ink transition-colors focus:border-accent/60 disabled:opacity-40'

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputBase} ${props.className ?? ''}`} />
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputBase} resize-y leading-relaxed ${props.className ?? ''}`} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputBase} cursor-pointer ${props.className ?? ''}`} />
}

type BtnTone = 'default' | 'primary' | 'ghost' | 'danger'

const btnTone: Record<BtnTone, string> = {
  default: 'border-line2 text-ink hover:border-faint hover:bg-raise',
  primary: 'border-accent/50 text-accent hover:bg-accent/10',
  ghost: 'border-transparent text-dim hover:text-ink',
  danger: 'border-danger/40 text-danger hover:bg-danger/10',
}

export function Btn({
  tone = 'default',
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: BtnTone }) {
  return (
    <button
      {...rest}
      className={`border px-3 py-1.5 text-[12px] transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${btnTone[tone]} ${className}`}
    />
  )
}

export function Tag({ children, tone = 'dim' }: { children: ReactNode; tone?: 'dim' | 'accent' | 'warn' | 'danger' }) {
  const map = {
    dim: 'border-line2 text-faint',
    accent: 'border-accent/40 text-accent',
    warn: 'border-warn/40 text-warn',
    danger: 'border-danger/40 text-danger',
  }
  return <span className={`border px-1.5 py-px text-[11px] whitespace-nowrap ${map[tone]}`}>{children}</span>
}

export function Meter({ value, tone }: { value: number; tone?: 'accent' | 'warn' | 'danger' }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100)
  const color = tone ?? (value >= 0.72 ? 'accent' : value >= 0.42 ? 'warn' : 'dim')
  const bar = { accent: 'bg-accent', warn: 'bg-warn', danger: 'bg-danger', dim: 'bg-faint' }[color]
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 w-16 bg-line2">
        <div className={`h-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="sd-mono w-9 text-[11px] text-dim">{(value * 100).toFixed(0)}</span>
    </div>
  )
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: 'accent' | 'warn' | 'danger' }) {
  const color = tone ? { accent: 'text-accent', warn: 'text-warn', danger: 'text-danger' }[tone] : 'text-ink'
  return (
    <div className="border border-line bg-panel px-3 py-2">
      <div className="text-[11px] text-faint">{label}</div>
      <div className={`sd-mono mt-0.5 text-[15px] ${color}`}>{value}</div>
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="py-10 text-center text-[12px] text-faint">{children}</div>
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  hint?: string
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-2.5 text-left"
    >
      <span
        className={`relative h-3.5 w-7 shrink-0 border transition-colors ${
          checked ? 'border-accent/60 bg-accent/25' : 'border-line2 bg-raise'
        }`}
      >
        <span
          className={`absolute top-px h-2.5 w-2.5 transition-all ${checked ? 'left-3.5 bg-accent' : 'left-px bg-faint'}`}
        />
      </span>
      <span className="text-[12px] text-ink">{label}</span>
      {hint && <span className="text-[11px] text-faint">{hint}</span>}
    </button>
  )
}
