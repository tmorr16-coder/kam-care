import type { Metadata } from 'next'
import Link from 'next/link'
import { requireStaff } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { fmtHours, loadInsights, pct, RANGE_LABEL, type Range } from '@/lib/data/insights'
import { CHANNEL_LABELS } from '@/lib/types'
import { Bar, Card, CardHeader, cx, Stat } from '@/components/ui'
import { NeedsChart } from './needs-chart'

export const metadata: Metadata = { title: 'Insights' }

const RANGES: { value: Range; label: string }[] = [
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: '365', label: 'Year' },
]

const CAMPUS_NAMES: Record<string, string> = { indianapolis: 'Indianapolis', detroit: 'Detroit', atlanta: 'Atlanta', global: 'Global' }

function signedPct(x: number | null, suffix = 'vs. prior period') {
  if (x === null) return 'No prior period to compare'
  return `${x >= 0 ? '+' : '−'}${Math.abs(Math.round(x * 100))}% ${suffix}`
}

export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  await requireStaff()
  const { range: raw } = await searchParams
  const range: Range = raw === '30' || raw === '365' ? raw : '90'
  const d = await loadInsights(createAdminClient(), range)
  const k = d.kpis
  const maxNeed = Math.max(1, ...d.needs.map(([, n]) => n))

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/admin" className="text-sm text-navy-800 hover:underline">← Care queue</Link>
      <header className="mt-3 mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Insights</h1>
          <p className="mt-1 text-[15px] text-ink-muted">How well we&apos;re caring for the KAM family · {RANGE_LABEL[range]}</p>
        </div>
        <nav className="flex gap-2" aria-label="Time range">
          {RANGES.map((r) => (
            <Link
              key={r.value}
              href={`/admin/insights?range=${r.value}`}
              aria-current={r.value === range ? 'page' : undefined}
              className={cx(
                'rounded-full border px-4 py-1.5 text-sm font-medium',
                r.value === range ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink hover:bg-canvas',
              )}
            >
              {r.label}
            </Link>
          ))}
        </nav>
      </header>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <Stat label="Care touches" value={k.touches} sub={signedPct(k.touchesChange)} tone={k.touchesChange !== null && k.touchesChange >= 0 ? 'good' : undefined} />
        <Stat label="Members reached" value={k.reached} sub={k.reachedShare !== null ? `${pct(k.reachedShare)} of membership` : undefined} tone="good" />
        <Stat
          label="Median first touch"
          value={fmtHours(k.firstTouch)}
          sub={k.firstTouchDelta === null ? `Goal: under ${d.goalHours}h` : `${k.firstTouchDelta <= 0 ? '−' : '+'}${fmtHours(Math.abs(k.firstTouchDelta))}, ${k.firstTouchDelta <= 0 ? 'faster' : 'slower'}`}
          tone={k.firstTouchDelta !== null ? (k.firstTouchDelta <= 0 ? 'good' : 'bad') : undefined}
        />
        <Stat
          label="Closed within 72h"
          value={pct(k.closed72)}
          sub={k.closed72Delta === null ? undefined : `${k.closed72Delta >= 0 ? '+' : '−'}${Math.abs(Math.round(k.closed72Delta * 100))} pts`}
          tone={k.closed72Delta !== null ? (k.closed72Delta >= 0 ? 'good' : 'bad') : undefined}
        />
        <Stat label="Overdue tasks" value={k.overdue} sub={`+${k.overdueThisWeek} this week`} tone={k.overdueThisWeek > 0 ? 'bad' : undefined} />
      </div>

      <section className="mt-6 rounded-xl bg-navy-900 p-5 text-white">
        <h2 className="font-serif text-xl font-semibold">What the data suggests</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {[
            { label: 'Capacity', ...(d.suggestions.capacity ?? { headline: 'No first-touch data yet.', body: 'Once cases get their first touch, this shows which campus needs more leaders.' }) },
            { label: 'Follow-through', ...d.suggestions.followThrough },
            { label: 'Channel', ...d.suggestions.channel },
          ].map((s) => (
            <div key={s.label} className="rounded-lg bg-navy-800/80 p-4">
              <p className="text-xs font-bold tracking-wider text-gold-500 uppercase">{s.label}</p>
              <p className="mt-2 font-semibold">{s.headline}</p>
              <p className="mt-2 text-sm text-white/80">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card className="pb-4">
          <NeedsChart months={d.months} />
        </Card>
        <Card className="pb-5">
          <CardHeader title="Needs by type" subtitle={RANGE_LABEL[range]} />
          <ul className="space-y-3 px-5">
            {d.needs.map(([label, n]) => (
              <li key={label}>
                <div className="flex justify-between text-sm"><span>{label}</span><span className="font-semibold tabular-nums">{n}</span></div>
                <Bar value={n} max={maxNeed} className="mt-1" />
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mt-6 overflow-hidden">
        <CardHeader title="Campus scorecard" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-canvas text-left text-xs tracking-wider text-ink-muted uppercase">
              <tr>
                {['Campus', 'Members', 'Opted in', 'Open needs', 'First touch', 'Closed 72h', 'Pulse'].map((h) => (
                  <th key={h} scope="col" className="px-5 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.scorecard.map((s) => (
                <tr key={s.id} className="border-t border-line">
                  <th scope="row" className="px-5 py-3.5 text-left font-semibold">{CAMPUS_NAMES[s.id]}</th>
                  <td className="px-5 tabular-nums">{s.members}</td>
                  <td className="px-5 tabular-nums">{pct(s.optedIn)}</td>
                  <td className="px-5 tabular-nums">{s.openNeeds}</td>
                  <td className={cx('px-5 tabular-nums', s.firstTouch !== null && s.firstTouch > d.goalHours && 'font-semibold text-urgent')}>
                    {fmtHours(s.firstTouch)}
                    {s.firstTouch !== null && s.firstTouch > d.goalHours && <span className="sr-only"> (over the {d.goalHours}-hour goal)</span>}
                  </td>
                  <td className="px-5 tabular-nums">{pct(s.closed72)}</td>
                  <td className="px-5 tabular-nums">{s.pulse ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Card className="pb-5">
          <CardHeader title="What reaches people" subtitle="Share of outreach that got a response, by channel" />
          <ul className="space-y-3 px-5">
            {d.channelRates.map((c) => (
              <li key={c.channel} className="grid grid-cols-[90px_1fr_44px] items-center gap-3 text-sm">
                <span>{CHANNEL_LABELS[c.channel]}</span>
                <Bar value={(c.rate ?? 0) * 100} />
                <span className="text-right font-semibold tabular-nums" title={`${c.total} touches`}>{pct(c.rate)}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="pb-5">
          <CardHeader title="Outcomes after care" />
          <dl className="grid grid-cols-1 gap-5 px-5 sm:grid-cols-2">
            <div>
              <dt className="sr-only">Lapsed members back</dt>
              <dd className="font-serif text-3xl font-semibold">{pct(d.outcomes.lapsedBack)}</dd>
              <dd className="mt-1 text-sm text-ink-muted">of lapsed members back within 60 days of a care call</dd>
            </div>
            <div>
              <dt className="sr-only">Families helped</dt>
              <dd className="font-serif text-3xl font-semibold">{d.outcomes.families}</dd>
              <dd className="mt-1 text-sm text-ink-muted">families helped through Food Pantries and Holiday Assistance</dd>
            </div>
            <div>
              <dt className="sr-only">Check-in lift</dt>
              <dd className="font-serif text-3xl font-semibold">
                {d.outcomes.lift === null ? '—' : `${d.outcomes.lift >= 0 ? '+' : '−'}${Math.abs(Math.round(d.outcomes.lift))} pts`}
              </dd>
              <dd className="mt-1 text-sm text-ink-muted">average check-in lift two weeks after contact</dd>
            </div>
            <div>
              <dt className="sr-only">Care rating</dt>
              <dd className="font-serif text-3xl font-semibold">{d.outcomes.rating === null ? '—' : `${d.outcomes.rating.toFixed(1)} / 5`}</dd>
              <dd className="mt-1 text-sm text-ink-muted">members&apos; rating of the care they received</dd>
            </div>
          </dl>
        </Card>
      </div>
    </div>
  )
}
