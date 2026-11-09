import Link from 'next/link'
import { notFound } from 'next/navigation'
import { after } from 'next/server'
import type { Metadata } from 'next'
import { Lock } from 'lucide-react'
import { requireStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadMember, recentWeekdays } from '@/lib/data/member'
import { addDays, daysBetween, dueLabel, fmtShort, todayISO } from '@/lib/dates'
import { CHANNEL_LABELS, CHECKIN_LABELS } from '@/lib/types'
import { Card, CardHeader, Empty, Initials, PastorsOnly, Pill, cx } from '@/components/ui'
import { AssignFollowUp, ChangeAccess, FlagForCare, NextActionComposer, PastoralNoteForm, TextComposer } from './member-client'

export const metadata: Metadata = { title: 'Member' }

const DOT: Record<string, string> = {
  urgent: 'bg-urgent', high: 'bg-warn', normal: 'bg-navy-800', good: 'bg-[#2e8b57]',
}

export default async function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireStaff()
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const sb = await createClient()
  const m = await loadMember(sb, id, viewer.role === 'pastor')
  if (!m) notFound()

  const { person, care, consent, openCase: c } = m
  const today = todayISO()

  // Every view of a sensitive matter is logged. RLS already confirmed this viewer can see the case.
  if (c?.sensitive) {
    after(async () => {
      await createAdminClient().from('access_log').insert({ user_id: viewer.userId, person_id: person.id, case_id: c.id, action: 'view_sensitive' })
    })
  }

  const lastTouchDays = care?.last_touch_at ? daysBetween(care.last_touch_at.slice(0, 10), today) : null
  const memberYear = person.member_since?.slice(0, 4)
  const householdSize = m.household.length + 1
  const sundays = recentWeekdays(0)
  const tuesdays = recentWeekdays(2)
  const attended = (kind: string, d: string) => m.attendance.some((a) => a.kind === kind && a.meeting_date === d)

  const why: string[] = []
  for (const s of m.signals.filter((s) => s.kind !== 'flagged' && s.kind !== 'touch').slice(0, 3)) why.push(s.summary)
  if (care?.text_read_fast) why.push(`Reads texts within the hour${care.email_ignored ? '; leaves emails unopened' : ''}.`)
  if (c?.moment_type === 'job_loss' || c?.sensitive_reason === 'Employment and finances') why.push('Follow-up options: Total Restoration, Free Holiday Assistance, Food Pantries.')

  const timeline = [
    ...m.signals.filter((s) => s.kind !== 'touch').map((s) => ({
      id: 's' + s.id, at: s.occurred_at, title: s.summary, source: s.source,
      dot: s.kind === 'checkin_low' && /Good|Great/.test(s.summary) ? DOT.good : DOT[s.severity],
    })),
    ...m.touches.map((t) => ({ id: 't' + t.id, at: t.occurred_at, title: t.summary, source: `Outreach log · ${CHANNEL_LABELS[t.channel]}`, dot: DOT.normal })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 20)

  const chip = (on: boolean | undefined, label: string, onText = 'on', offText = 'off') => (
    <Pill tone={on ? 'ok' : 'neutral'}>{label}: {on ? onText : offText}</Pill>
  )

  return (
    <div className="mx-auto max-w-[1180px]">
      <Link href="/admin" className="mb-4 inline-block text-sm text-navy-800 hover:underline">← Back to care queue</Link>

      {c?.sensitive && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-navy-800 px-5 py-3.5 text-white">
          <div className="flex items-start gap-3">
            <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
            <div>
              <p className="text-sm font-semibold">Sensitive matter · {c.sensitive_visibility === 'pastors' ? 'Pastors only' : 'Pastors and care staff'}</p>
              <p className="text-xs text-white/75">
                Flagged on {fmtShort(c.opened_at)}{c.sensitive_reason ? ` · Reason: ${c.sensitive_reason.toLowerCase()}` : ''} · Every view is logged
              </p>
            </div>
          </div>
          {viewer.role === 'pastor' && <ChangeAccess personId={person.id} caseId={c.id} current={c.sensitive_visibility} />}
        </div>
      )}

      {/* Header */}
      <Card className="mb-6 flex flex-wrap items-center justify-between gap-6 p-5">
        <div className="flex items-center gap-4">
          <Initials name={person.display_name ?? person.first_name} />
          <div>
            <h1 className="font-serif text-2xl font-semibold">{person.display_name}</h1>
            <p className="text-sm text-ink-muted">
              {[person.campusName && `${person.campusName} campus`, memberYear && `Member since ${memberYear}`, householdSize > 1 && `Household of ${householdSize}`, ...person.ministries]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {chip(consent?.weekly_checkin, 'Check-ins')}
              {chip(consent?.texts, 'Text', care?.preferred_channel === 'text' ? 'preferred' : 'on')}
              {chip(consent?.emails, 'Email')}
              {chip(consent?.social_connected, 'Social', 'connected', 'not connected')}
            </div>
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-6 text-sm sm:gap-10">
          <div>
            <dt className="text-xs text-ink-muted">Care score</dt>
            <dd className="mt-1">
              <span className={cx('font-serif text-2xl font-semibold', (care?.care_score ?? 100) < 50 && 'text-urgent')}>{care?.care_score ?? '—'}</span>
              <span className="text-ink-muted"> / 100</span>
              {care?.care_score_delta_14d ? (
                <span className={cx('block text-xs', care.care_score_delta_14d < 0 ? 'text-urgent' : 'text-ok')}>
                  {care.care_score_delta_14d > 0 ? '+' : '−'}{Math.abs(care.care_score_delta_14d)} in 2 weeks
                </span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-muted">Last touch</dt>
            <dd className="mt-1">
              <span className="font-serif text-2xl font-semibold">{lastTouchDays === null ? '—' : `${lastTouchDays}d`}</span>
              {care?.last_touch_summary && <span className="block max-w-[10rem] text-xs text-ink-muted">{care.last_touch_summary}</span>}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-muted">Primary care leader</dt>
            <dd className="mt-1 font-semibold">{m.primaryTeam?.name ?? 'Not set'}</dd>
            {m.leadersOnOpenTasks > 0 && <dd className="text-xs text-ink-muted">{m.leadersOnOpenTasks} leader{m.leadersOnOpenTasks > 1 ? 's' : ''} on open tasks</dd>}
          </div>
        </dl>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_17.5rem]">
        <div className="min-w-0 space-y-6">
          {/* Next best action */}
          {c ? (
            <section className="rounded-xl bg-navy-900 p-5 text-white sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-xs font-semibold tracking-wider text-gold-500 uppercase">Next best action · {c.urgency}</p>
                {c.confidence && <span className="rounded-full bg-navy-800 px-3 py-1 text-xs">Confidence: {c.confidence}</span>}
              </div>
              <h2 className="mt-1 mb-4 font-serif text-2xl font-semibold">
                {c.action_title}{c.action_detail ? <span className="block text-base font-normal text-white/80">{c.action_detail}</span> : null}
              </h2>
              <NextActionComposer
                personId={person.id}
                caseId={c.id}
                suggested={c.suggested_message ?? `Hi ${person.first_name}, it's ${viewer.firstName ?? 'your care team'} from KAM. Thinking of you this week. How are you and the family holding up?`}
              />
              {why.length > 0 && (
                <div className="mt-5 border-t border-white/10 pt-4">
                  <h3 className="mb-2 text-sm font-semibold">Why this action</h3>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-white/85">
                    <li>{c.why_flagged}</li>
                    {why.map((w) => <li key={w}>{w}</li>)}
                  </ul>
                </div>
              )}
            </section>
          ) : (
            <Card className="p-5">
              {m.hiddenCase ? (
                <p className="text-sm text-ink-muted">
                  <Lock className="mr-1 inline size-4" aria-hidden />
                  A pastor is already caring for {person.first_name} on a private matter. Check with the pastoral office before reaching out.
                </p>
              ) : (
                <>
                  <h2 className="mb-1 font-serif text-xl font-semibold">No open care need</h2>
                  <p className="mb-4 text-sm text-ink-muted">Noticed something? Flag it and it goes into the care queue.</p>
                  <FlagForCare personId={person.id} teams={m.teams} defaultTeam={m.primaryTeam?.id ?? null} />
                  <div className="mt-6 border-t border-line pt-4">
                    <h3 className="mb-2 text-sm font-semibold">Send a text</h3>
                    <TextComposer personId={person.id} />
                  </div>
                </>
              )}
            </Card>
          )}

          {/* Follow-up tasks */}
          {(c || m.tasks.length > 0) && (
            <Card>
              <CardHeader title="Follow-up tasks" right={<span className="text-xs text-ink-muted">Each task has one leader, a due date and a status</span>} />
              <ul className="divide-y divide-line px-5">
                {m.tasks.map((t) => (
                  <li key={t.id} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 py-3 text-sm sm:grid-cols-[1.4fr_1fr_5rem_6rem]">
                    <span>
                      <span className="font-semibold">{t.title}</span>
                      {(t.subtitle || t.instructions) && <span className="block text-xs text-ink-muted">{t.subtitle ?? t.instructions}</span>}
                    </span>
                    <span className="text-xs text-ink-muted sm:text-sm">
                      Assigned to<span className="block font-semibold text-ink">{(t.team as { name: string } | null)?.name ?? 'Unassigned'}</span>
                    </span>
                    <span className="self-center text-ink-muted">{t.due_on === today ? 'Today' : fmtShort(t.due_on)}</span>
                    <span className="self-center">
                      {t.due_on < today ? <Pill tone="bad">{dueLabel(t.due_on)}</Pill>
                        : t.status === 'due' ? <Pill tone="bad">Due today</Pill>
                          : <Pill tone="navy">Scheduled</Pill>}
                      {t.escalation_level > 1 && <span className="mt-1 block text-[11px] text-high">Escalated · step {t.escalation_level}</span>}
                    </span>
                  </li>
                ))}
                {m.tasks.length === 0 && <li><Empty>No open tasks.</Empty></li>}
              </ul>
              <div className="p-5 pt-3">
                <AssignFollowUp
                  personId={person.id}
                  caseId={c?.id ?? null}
                  teams={m.teams}
                  defaultTeam={m.primaryTeam?.id ?? c?.owner_team_id ?? null}
                  defaultDue={addDays(today, 3)}
                  isPastor={viewer.role === 'pastor'}
                />
              </div>
            </Card>
          )}

          {/* Signals & touches */}
          <Card>
            <CardHeader title="Signals & touches" />
            <ol className="divide-y divide-line px-5 pb-2">
              {timeline.map((e) => (
                <li key={e.id} className="flex gap-4 py-3 text-sm">
                  <span className="w-14 shrink-0 text-ink-muted">{fmtShort(e.at)}</span>
                  <span className={cx('mt-1.5 size-2.5 shrink-0 rounded-full', e.dot)} aria-hidden />
                  <span>
                    <span className="font-semibold">{e.title}</span>
                    <span className="block text-xs text-ink-muted">{e.source}</span>
                  </span>
                </li>
              ))}
              {timeline.length === 0 && <li><Empty>No signals yet.</Empty></li>}
            </ol>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-3 font-serif text-lg font-semibold">Last 12 weeks</h2>
            {[['Sunday 10 AM', 'sunday', sundays], ['Tue Bible Study', 'bible_study', tuesdays]].map(([label, kind, days]) => (
              <div key={label as string} className="mb-2 flex items-center gap-2">
                <span className="w-16 shrink-0 text-xs text-ink-muted">{label as string}</span>
                <span className="flex gap-1">
                  {(days as string[]).map((d) => (
                    <span
                      key={d}
                      title={`${fmtShort(d)} · ${attended(kind as string, d) ? 'attended' : 'not recorded'}`}
                      className={cx('size-2.5 rounded-sm', attended(kind as string, d) ? 'bg-navy-800' : 'bg-[#e4e0d8]')}
                    />
                  ))}
                </span>
              </div>
            ))}
            <p className="mt-3 text-xs text-ink-muted">Filled = attended (in person or livestream) · from OneChurch</p>
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 font-serif text-lg font-semibold">Check-in trend</h2>
            {m.checkins.length ? (
              <>
                <div className="flex h-24 items-end gap-1.5" role="img" aria-label={`Last ${m.checkins.length} check-ins: ${m.checkins.map((x) => CHECKIN_LABELS[x.score]).join(', ')}`}>
                  {m.checkins.map((x) => (
                    <span
                      key={x.created_at}
                      title={`${fmtShort(x.created_at)} · ${CHECKIN_LABELS[x.score]}`}
                      className={cx('flex-1 rounded-t', x.score <= 2 ? 'bg-urgent' : 'bg-navy-800')}
                      style={{ height: `${(x.score / 5) * 100}%` }}
                    />
                  ))}
                </div>
                <div className="mt-2 flex justify-between text-xs text-ink-muted">
                  <span>{fmtShort(m.checkins[0].created_at)}</span>
                  <span>{fmtShort(m.checkins.at(-1)!.created_at)}</span>
                </div>
              </>
            ) : <p className="text-sm text-ink-muted">No check-ins yet.</p>}
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 font-serif text-lg font-semibold">Household & connections</h2>
            <ul className="space-y-2 text-sm">
              {m.household.map((h) => (
                <li key={h.id} className="flex justify-between gap-2">
                  <Link href={`/admin/members/${h.id}`} className="hover:underline">{h.display_name}</Link>
                  <span className="text-ink-muted">{h.family_position ?? 'Household'}</span>
                </li>
              ))}
              {m.primaryTeam && (
                <li className="flex justify-between gap-2"><span>{m.primaryTeam.name}</span><span className="text-ink-muted">Care leader</span></li>
              )}
              {person.ministries.map((min) => (
                <li key={min} className="flex justify-between gap-2"><span>{min}</span><span className="text-ink-muted">Ministry</span></li>
              ))}
              {!m.household.length && !m.primaryTeam && !person.ministries.length && <li className="text-ink-muted">No household or ministry links yet.</li>}
            </ul>
          </Card>

          {viewer.role === 'pastor' && (
            <section className="rounded-xl border border-[#f0dfb8] bg-[#fdf7ea] p-5">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-serif text-lg font-semibold">Pastoral notes</h2>
                <PastorsOnly />
              </div>
              <PastoralNoteForm personId={person.id} />
              <ul className="mt-4 space-y-3 text-sm">
                {m.notes.map((n) => (
                  <li key={n.id} className="border-t border-[#f0dfb8] pt-2">
                    <span className="text-xs text-ink-muted">{fmtShort(n.created_at)}</span>
                    <p className="whitespace-pre-wrap">{n.body}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
