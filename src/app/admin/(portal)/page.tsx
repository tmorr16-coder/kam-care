import Link from 'next/link'
import type { Metadata } from 'next'
import { requireStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { dueLabel, fmtLong, fmtShort, todayISO } from '@/lib/dates'
import { Bar, Card, CardHeader, Empty, PageTitle, PastorsOnly, Pill, SensitivePill, Stat, UrgencyPill, cx } from '@/components/ui'
import {
  MOMENT_TILES, applyFilter, loadGiving, loadKpis, loadMoments, loadOutcomes, loadPulse, loadQueue, loadSources, type QueueFilter,
} from '@/lib/data/queue'
import { CampusSelect, DoItButtons, OwnerSelect, RunOutreachButton } from './queue-client'

export const metadata: Metadata = { title: 'Care queue' }

const FILTERS: { key: QueueFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'urgent', label: 'Urgent' },
  { key: 'mine', label: 'Mine' },
  { key: 'sensitive', label: 'Sensitive' },
  { key: 'unassigned', label: 'Unassigned' },
]

export default async function CareQueuePage({ searchParams }: { searchParams: Promise<{ campus?: string; filter?: string }> }) {
  const viewer = await requireStaff()
  const sp = await searchParams
  const campus = sp.campus || null
  const filter = (FILTERS.some((f) => f.key === sp.filter) ? sp.filter : 'all') as QueueFilter
  const sb = await createClient()

  const [{ data: campuses }, { data: teams }, queue, moments, pulse, sources, outcomes, giving] = await Promise.all([
    sb.from('campuses').select('id, name').order('sort'),
    sb.from('care_teams').select('id, name').eq('active', true).order('name'),
    loadQueue(sb, campus, viewer.teamIds),
    loadMoments(sb, campus),
    loadPulse(sb),
    loadSources(sb),
    loadOutcomes(sb),
    viewer.role === 'pastor' ? loadGiving(sb) : Promise.resolve(null),
  ])
  const kpis = await loadKpis(sb, queue.rows, campus)
  const rows = applyFilter(queue.rows, filter, viewer.teamIds)
  const campusName = campuses?.find((c) => c.id === campus)?.name

  const momentCount = (t: string) => moments.counts.get(t as never) ?? 0
  const lowest = pulse.filter((p) => p.score !== null).sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0]
  const href = (f: QueueFilter) => `/admin?${new URLSearchParams({ ...(campus ? { campus } : {}), ...(f !== 'all' ? { filter: f } : {}) })}`

  return (
    <div className="mx-auto max-w-[1280px]">
      <PageTitle
        eyebrow={`${fmtLong()} · ${campusName ?? 'All campuses'}`}
        title="Care Command Center"
        right={
          <>
            <CampusSelect value={campus ?? ''} campuses={campuses ?? []} />
            <div className="self-end"><RunOutreachButton /></div>
          </>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <Stat label="Members needing care" value={kpis.membersNeedingCare} sub={`${kpis.newThisWeek} new in the last 7 days`} />
        <Stat label="Actions due today" value={kpis.dueToday} sub={`${kpis.urgentDue} urgent · ${kpis.routineDue} routine`} />
        <Stat
          label="Median time to first touch"
          value={kpis.medianFirstTouch === null ? '—' : `${kpis.medianFirstTouch.toFixed(1)}h`}
          sub="Goal: under 24h"
          tone={kpis.medianFirstTouch !== null && kpis.medianFirstTouch > 24 ? 'bad' : undefined}
        />
        <Stat
          label="Members opted in to check-ins"
          value={kpis.totalMembers ? `${Math.round((kpis.optedIn / kpis.totalMembers) * 100)}%` : '—'}
          sub={`${kpis.optedIn.toLocaleString()} of ${kpis.totalMembers.toLocaleString()} members`}
        />
        <Stat
          label="Life moments this week"
          value={moments.total}
          sub={`${momentCount('bereavement')} bereavements · ${momentCount('sickness')} sick · ${momentCount('birth')} births`}
        />
      </div>

      {/* Life moments */}
      <Card className="mt-6 grid gap-6 p-5 lg:grid-cols-[1fr_15rem]">
        <div>
          <h2 className="font-serif text-xl font-semibold">Life moments this week</h2>
          <p className="mt-0.5 mb-4 text-sm text-ink-muted">
            From the member portal, OneChurch profile dates, care requests and opted-in social. Each type comes with its own care playbook.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {MOMENT_TILES.map((t) => (
              <div key={t.type} className={cx('rounded-lg p-3', t.tone)}>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold">{t.label}</span>
                  <span className="font-serif text-xl font-semibold">{momentCount(t.type)}</span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-ink-muted">{t.summary}</p>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-[15px] font-semibold">Coming up in the next 7 days</h3>
          {moments.upcoming.length === 0 && <p className="text-sm text-ink-muted">Nothing on the calendar this week.</p>}
          <ul className="divide-y divide-line">
            {moments.upcoming.map((m) => (
              <li key={m.id} className="flex gap-3 py-2.5 text-sm">
                <span className="w-12 shrink-0 text-ink-muted">{fmtShort(m.date)}</span>
                <span>
                  <Link href={`/admin/members/${m.personId}`} className="font-semibold hover:underline">{m.name}</Link>
                  <span className="block text-xs leading-relaxed text-ink-muted">{m.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_17.5rem]">
        {/* Next best actions */}
        <Card className="min-w-0">
          <CardHeader title="Next best actions" subtitle="Ranked by urgency, then time since last touch" />
          <div className="flex flex-wrap gap-2 px-5 pb-4">
            {FILTERS.map((f) => (
              <Link
                key={f.key}
                href={href(f.key)}
                className={cx(
                  'rounded-full border px-3 py-1 text-sm',
                  filter === f.key ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink hover:bg-canvas',
                )}
              >
                {f.label} · {queue.counts[f.key]}
              </Link>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-canvas text-left text-[11px] tracking-wide text-ink-muted uppercase">
                <tr>
                  <th className="px-5 py-2.5 font-semibold">Member</th>
                  <th className="px-3 py-2.5 font-semibold">Why flagged</th>
                  <th className="px-3 py-2.5 font-semibold">Recommended action</th>
                  <th className="px-3 py-2.5 font-semibold">Owner</th>
                  <th className="px-3 py-2.5 pr-5 font-semibold">Do it</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.caseId} className="align-top">
                    <td className="px-5 py-4">
                      <Link href={`/admin/members/${r.personId}`} className="font-semibold hover:underline">{r.name}</Link>
                      <span className="block text-xs text-ink-muted">{r.campusName}</span>
                      <span className="mt-1 flex flex-col items-start gap-1">
                        <UrgencyPill urgency={r.urgency} />
                        {r.sensitive && <SensitivePill />}
                      </span>
                    </td>
                    <td className="max-w-[13rem] px-3 py-4 text-ink-muted">{r.why}</td>
                    <td className="max-w-[12rem] px-3 py-4">
                      <span className="font-semibold">{r.actionTitle}</span>
                      {r.actionDetail && <span className="block text-ink-muted">{r.actionDetail}</span>}
                    </td>
                    <td className="px-3 py-4">
                      <OwnerSelect key={r.ownerTeamId ?? 'none'} caseId={r.caseId} value={r.ownerTeamId} teams={teams ?? []} />
                      {r.dueOn && (
                        <span className={cx('mt-1 block text-xs', r.dueOn < todayISO() ? 'text-urgent' : 'text-ink-muted')}>
                          Due {dueLabel(r.dueOn)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-4 pr-5">
                      <DoItButtons caseId={r.caseId} personId={r.personId} phone={r.phone} email={r.email} channel={r.channels[0] ?? 'call'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && <Empty>No open care needs here. Thank you for caring well.</Empty>}
          </div>
        </Card>

        {/* Right column */}
        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="font-serif text-lg font-semibold">Care pulse by campus</h2>
            <p className="mb-4 text-xs text-ink-muted">Average weekly check-in score, 0–100</p>
            <ul className="space-y-3">
              {pulse.map((p) => (
                <li key={p.id}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{p.name}</span>
                    <span className="text-ink-muted">
                      {p.score ?? '—'}
                      {p.delta !== null && <span className="ml-1">{p.delta > 0 ? `+${p.delta}` : p.delta === 0 ? '±0' : `−${-p.delta}`}</span>}
                    </span>
                  </div>
                  <Bar value={p.score ?? 0} tone={lowest && p.id === lowest.id && pulse.length > 1 ? 'gold' : 'navy'} />
                </li>
              ))}
            </ul>
            {lowest && lowest.score !== null && (
              <p className="mt-4 rounded-lg bg-gold-100 p-3 text-xs leading-relaxed text-ink">
                <b>Insight:</b> {lowest.name} has the lowest check-in pulse ({lowest.score})
                {lowest.delta !== null && lowest.delta < 0 ? `, down ${-lowest.delta} pts in 3 weeks` : ''}. Consider extra outreach there this week.
              </p>
            )}
          </Card>

          {giving && (
            <Card className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-serif text-lg font-semibold">Giving insights</h2>
                <PastorsOnly />
              </div>
              <ul className="divide-y divide-line text-sm">
                {[
                  [giving.firstTime, 'First-time givers this month', 'Thank-you text from the campus pastor within 48h'],
                  [giving.stopped, 'Recurring gifts stopped', 'Care call; listen for job loss or hardship'],
                  [giving.up, 'Giving up 25% or more', 'Personal thank-you; invite to serve or lead'],
                  [giving.newRecurring, 'New recurring givers', 'Welcome note and ministry update'],
                  [giving.quiet, 'Long-time givers gone quiet', 'Flag with attendance; pastoral check-in'],
                ].map(([n, title, hint]) => (
                  <li key={title as string} className="flex gap-3 py-2.5">
                    <span className="w-8 shrink-0 font-serif text-xl font-semibold">{n}</span>
                    <span>
                      <span className="font-semibold">{title}</span>
                      <span className="block text-xs text-ink-muted">{hint}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 rounded-lg bg-canvas p-3 text-xs text-ink-muted">
                Care teams see the signal, never the amount. A lapse prompts a care call, never a giving ask.
              </p>
            </Card>
          )}

          <Card className="p-5">
            <h2 className="mb-3 font-serif text-lg font-semibold">Signal sources</h2>
            <ul className="space-y-3 text-sm">
              {[
                ['OneChurch attendance', 'Check-ins, streams, groups', sources.attendance ? 'Synced' : 'Waiting'],
                ['Giving patterns', 'Firsts, lapses, increases · pastors only', sources.giving ? 'Synced' : 'Waiting'],
                ['Profile dates', 'Birthdays, anniversaries, work milestones', sources.profiles ? 'Synced' : 'Waiting'],
                ['Weekly member check-ins', 'Member portal + text reply', `${sources.checkinsOptedIn.toLocaleString()} opted in`],
                ['Prayer & care requests', 'Portal, cards, text line', sources.requestsLive ? 'Live' : 'Ready'],
                ['KAM social pages', 'Comments & DMs to KAM', 'Not connected'],
                ['Member-connected social', 'Public posts, opt-in only', `${sources.socialConnected.toLocaleString()} connected`],
              ].map(([title, sub, status]) => (
                <li key={title} className="flex items-start justify-between gap-2">
                  <span>
                    <span className="font-semibold">{title}</span>
                    <span className="block text-xs text-ink-muted">{sub}</span>
                  </span>
                  <Pill tone={status === 'Waiting' || status === 'Not connected' ? 'neutral' : 'ok'} className="shrink-0">{status}</Pill>
                </li>
              ))}
            </ul>
          </Card>

          <div className="grid grid-cols-2 gap-4 rounded-xl bg-navy-900 p-5 text-white">
            {[
              [outcomes.touchesThisMonth, 'Care touches this month'],
              [outcomes.closedWithin72 === null ? '—' : `${outcomes.closedWithin72}%`, 'Closed the loop in 72h'],
              [outcomes.lapsedReturned, 'Lapsed members returned'],
              [outcomes.rating ?? '—', 'Member rating of care'],
            ].map(([n, label]) => (
              <div key={label}>
                <p className="font-serif text-2xl font-semibold">{n}</p>
                <p className="text-xs text-white/75">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
