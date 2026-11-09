import clsx from 'clsx'
import { Lock } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'
import type { Urgency } from '@/lib/types'

export { clsx as cx }

export function Card({ className, ...props }: ComponentProps<'section'>) {
  return <section className={clsx('rounded-xl border border-line bg-white', className)} {...props} />
}

export function CardHeader({ title, subtitle, right, className }: { title: ReactNode; subtitle?: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <div className={clsx('flex flex-wrap items-start justify-between gap-3 px-5 pt-5 pb-3', className)}>
      <div>
        <h2 className="font-serif text-xl font-semibold text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {right}
    </div>
  )
}

export function PageTitle({ eyebrow, title, subtitle, right }: { eyebrow?: ReactNode; title: ReactNode; subtitle?: ReactNode; right?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="mb-1 text-sm text-ink-muted">{eyebrow}</p>}
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-ink sm:text-[2rem]">{title}</h1>
        {subtitle && <p className="mt-1 text-[15px] text-ink-muted">{subtitle}</p>}
      </div>
      {right && <div className="flex flex-wrap items-center gap-3">{right}</div>}
    </header>
  )
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'good' | 'bad' }) {
  return (
    <Card className="p-4">
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="mt-2 font-serif text-3xl font-semibold text-ink">{value}</p>
      {sub && <p className={clsx('mt-1 text-xs', tone === 'good' ? 'text-ok' : tone === 'bad' ? 'text-urgent' : 'text-ink-muted')}>{sub}</p>}
    </Card>
  )
}

const urgencyStyles: Record<Urgency, string> = {
  urgent: 'bg-urgent-bg text-urgent',
  high: 'bg-high-bg text-high',
  normal: 'bg-normal-bg text-normal',
}

export function UrgencyPill({ urgency }: { urgency: Urgency }) {
  return (
    <span className={clsx('inline-flex rounded px-1.5 py-0.5 text-[11px] font-semibold capitalize', urgencyStyles[urgency])}>
      {urgency}
    </span>
  )
}

export function SensitivePill({ label = 'Sensitive' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-navy-800 px-1.5 py-0.5 text-[11px] font-semibold text-white">
      <Lock className="size-3" aria-hidden /> {label}
    </span>
  )
}

export function Pill({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'ok' | 'warn' | 'bad' | 'navy' | 'gold'; className?: string }) {
  const tones = {
    neutral: 'bg-[#eef0f3] text-ink-muted',
    ok: 'bg-ok-bg text-ok',
    warn: 'bg-high-bg text-high',
    bad: 'bg-urgent-bg text-urgent',
    navy: 'bg-navy-100 text-navy-900',
    gold: 'bg-gold-100 text-high',
  }
  return <span className={clsx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', tones[tone], className)}>{children}</span>
}

export function PastorsOnly() {
  return <span className="rounded bg-gold-100 px-2 py-0.5 text-[11px] font-bold tracking-wide text-high uppercase">Pastors only</span>
}

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'onDark'
export function buttonClass(variant: BtnVariant = 'primary', size: 'sm' | 'md' | 'lg' = 'md') {
  return clsx(
    'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60',
    size === 'sm' && 'px-3 py-1.5 text-sm',
    size === 'md' && 'px-4 py-2 text-sm',
    size === 'lg' && 'px-5 py-3 text-base',
    variant === 'primary' && 'bg-navy-800 text-white hover:bg-navy-900',
    variant === 'secondary' && 'border border-line bg-white text-ink hover:bg-canvas',
    variant === 'ghost' && 'text-navy-800 hover:bg-navy-50',
    variant === 'danger' && 'bg-urgent text-white hover:opacity-90',
    variant === 'onDark' && 'border border-white/25 bg-white/5 text-white hover:bg-white/10',
  )
}

export function Button({ variant, size, className, ...props }: ComponentProps<'button'> & { variant?: BtnVariant; size?: 'sm' | 'md' | 'lg' }) {
  return <button className={clsx(buttonClass(variant, size), className)} {...props} />
}

export function Bar({ value, max = 100, tone = 'navy', className }: { value: number; max?: number; tone?: 'navy' | 'gold' | 'red' | 'light'; className?: string }) {
  const pct = Math.max(0, Math.min(100, (value / (max || 1)) * 100))
  const color = { navy: 'bg-navy-800', gold: 'bg-warn', red: 'bg-urgent', light: 'bg-[#bcd2e8]' }[tone]
  return (
    <div className={clsx('h-2 w-full rounded-full bg-[#ede9e2]', className)} role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <div className={clsx('h-2 rounded-full', color)} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Initials({ name, className }: { name: string; className?: string }) {
  const letters = name.replace(/^(Sis\.|Bro\.|Dcn\.|Mother|Pastor)\s+/, '').split(/\s+/).map((w) => w[0]).slice(0, 2).join('')
  return (
    <span className={clsx('inline-flex size-14 items-center justify-center rounded-full bg-navy-100 font-serif text-lg text-navy-900', className)}>
      {letters}
    </span>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-5 py-8 text-center text-sm text-ink-muted">{children}</p>
}

export function Field({ label, children, hint, className }: { label: string; children: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <label className={clsx('block', className)}>
      <span className="mb-1 block text-sm font-medium text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-muted">{hint}</span>}
    </label>
  )
}

export const inputClass =
  'w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-muted/70 focus:border-navy-700 focus:outline-none'

export function Logo({ size = 40, className }: { size?: number; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/kam-logo.png" alt="Kingdom Apostolic Ministries" width={size} height={size} className={clsx('rounded-full bg-white', className)} />
}
