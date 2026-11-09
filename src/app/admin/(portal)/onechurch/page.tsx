import type { Metadata } from 'next'
import Link from 'next/link'
import { requireStaff } from '@/lib/auth'
import { env } from '@/lib/env'
import { createAdminClient } from '@/lib/supabase/admin'
import { isOneChurchConfigured, rateLimitSnapshot } from '@/lib/onechurch/client'
import { WEBHOOK_EVENTS } from '@/lib/onechurch/types'
import { addDays, CHURCH_TZ, fmtShort } from '@/lib/dates'
import { Bar, buttonClass, Card, CardHeader, cx, Pill } from '@/components/ui'
import { markKeyRotated } from './actions'
import { ActionButton, MatchReview, WriteBackToggle } from './controls'

export const metadata: Metadata = { title: 'OneChurch connection' }

const EVENT_DOES: Record<(typeof WEBHOOK_EVENTS)[number], string> = {
  person_created: 'Add to matching so they can sign in',
  person_updated: 'Refresh contact info, campus and life dates',
  group_member_added: 'Update connections and leader roles',
  contribution_created: 'Recompute giving pattern; discard amount',
  form_entry_submitted: 'Turn website prayer requests into care tasks',
  connection_created: 'Start new-guest follow-up',
  event_registration_created: 'Count as an engagement signal',
}

// Labels match OneChurch's API key permission screen (Custom access).
const PERMISSIONS: { name: string; detail: string; level: 'Read + write' | 'Read' | 'Write' | 'Off' }[] = [
  { name: 'Limited Read People', detail: 'Names, contact info, campus, household, involvement', level: 'Read' },
  { name: 'Full Read Connections', detail: 'New-guest follow-up', level: 'Read' },
  { name: 'Write Notes', detail: 'Log non-sensitive care touches back (add only)', level: 'Write' },
  { name: 'Full Read Groups', detail: 'Group membership decides pastor, staff and leader roles', level: 'Read' },
  { name: 'API', detail: 'Register webhooks', level: 'Write' },
  { name: 'Events & Check-In', detail: 'Attendance signals', level: 'Read' },
  { name: 'Limited Read Contributions', detail: 'Giving pattern only; amounts not kept', level: 'Read' },
  { name: 'Full Read Forms', detail: 'Website prayer and care forms', level: 'Read' },
  { name: 'Everything else', detail: 'Account, billing, safeguards, files, write/delete people, import', level: 'Off' },
]

const SIGNAL_SOURCES: { signal: string; source: string; use: string; status: 'Available' | 'Verify' }[] = [
  { signal: 'Identity & household', source: 'People, Families · person_created / person_updated', use: 'Match sign-ins; show household on the profile', status: 'Available' },
  { signal: 'Roles & care teams', source: 'Groups, Users · group_member_added', use: 'Decide admin access and who can be assigned tasks', status: 'Available' },
  { signal: 'Giving pattern', source: 'Contributions · contribution_created', use: 'First gift, lapse or increase; pastors only', status: 'Available' },
  { signal: 'Website prayer & care forms', source: 'Forms · form_entry_submitted', use: 'Create a care task automatically', status: 'Available' },
  { signal: 'New guests', source: 'Connections · connection_created', use: 'Start the guest follow-up playbook', status: 'Available' },
  { signal: 'Attendance', source: 'Check-In, Events', use: 'Missed Sundays and Bible Study', status: 'Verify' },
  { signal: 'Livestream (Global Campus)', source: 'Not in OneChurch; from the streaming platform', use: 'Online engagement for Global Campus', status: 'Verify' },
  { signal: 'Life dates', source: 'People (birthday), Families, Custom Fields', use: 'Anniversaries and milestones on the calendar', status: 'Verify' },
  { signal: 'Care touches back to OneChurch', source: 'Notes', use: 'Keep one history across both systems', status: 'Verify' },
]

function ago(ts: string) {
  const mins = Math.round((Date.now() - Date.parse(ts)) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const h = Math.round(mins / 60)
  return h < 48 ? `${h}h ago` : `${Math.round(h / 24)}d ago`
}

const isoHoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString()

const time = (ts: string) => new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: CHURCH_TZ })

export default async function OneChurchPage() {
  await requireStaff({ admin: true })
  // Admin-only page; the viewer was checked above.
  const db = createAdminClient()
  const configured = isOneChurchConfigured()
  const key = env.onechurchApiKey
  const since24 = isoHoursAgo(24)

  const [lastHook, matched, totalProfiles, reviews, settings, subs, recent, runs, ...counts] = await Promise.all([
    db.from('oc_webhook_events').select('received_at').neq('event', 'reconcile').order('received_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('profiles').select('user_id', { count: 'exact', head: true }).eq('match_status', 'matched'),
    db.from('profiles').select('user_id', { count: 'exact', head: true }),
    db.from('match_reviews').select('id, label, reason, candidate_person_ids, created_at').eq('status', 'open').order('created_at'),
    db.from('app_settings').select('key, value').in('key', ['api_key_rotated_on', 'write_back_to_onechurch']),
    db.from('oc_webhook_subscriptions').select('event, url, created_at'),
    db.from('oc_webhook_events').select('id, event, received_at, http_status, status, summary, error').order('received_at', { ascending: false }).limit(6),
    db.from('sync_runs').select('id, kind, started_at, finished_at, ok, stats, error').in('kind', ['reconcile', 'attendance']).order('started_at', { ascending: false }).limit(5),
    ...WEBHOOK_EVENTS.map((e) => db.from('oc_webhook_events').select('id', { count: 'exact', head: true }).eq('event', e).gte('received_at', since24)),
  ])

  const candidateIds = [...new Set((reviews.data ?? []).flatMap((r) => r.candidate_person_ids))]
  const { data: candidates } = candidateIds.length
    ? await db.from('people').select('id, display_name, email, phone, campus_id').in('id', candidateIds)
    : { data: [] }
  const candidateHit = (id: string) => {
    const p = candidates?.find((c) => c.id === id)
    return p ? { id: p.id, name: p.display_name ?? '', detail: [p.email, p.phone, p.campus_id].filter(Boolean).join(' · ') } : null
  }

  const setting = (k: string) => settings.data?.find((s) => s.key === k)?.value
  const rotatedOn = setting('api_key_rotated_on') as string | undefined
  const writeBack = setting('write_back_to_onechurch') === true
  const rate = rateLimitSnapshot()
  const openReviews = reviews.data ?? []
  const subscribed = new Set((subs.data ?? []).map((s) => s.event))
  const live = configured && !!lastHook.data

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/admin" className="text-sm text-navy-800 hover:underline">← Care queue</Link>
      <header className="mt-3 mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">OneChurch connection</h1>
          <p className="mt-1 text-[15px] text-ink-muted">{env.onechurchTenant}.onechurchsoftware.com · Admins only</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <ActionButton kind="reconcile" label="Run full reconcile" pendingLabel="Starting…" />
          <ActionButton kind="test" label="Test connection" pendingLabel="Testing…" variant="primary" />
        </div>
      </header>

      {!configured && (
        <div className="mb-6 rounded-xl border border-high/30 bg-high-bg p-4 text-sm text-high" role="status">
          <strong>Not connected yet.</strong> Create a Custom API key in OneChurch (Settings → API / Webhooks → API Keys) with the permissions below, then add it as
          <code className="mx-1 rounded bg-white/70 px-1">ONECHURCH_API_KEY</code> in Vercel and redeploy. Never use a Super User key.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-sm text-ink-muted">Connection</p>
          <p className={cx('mt-2 flex items-center gap-2 font-serif text-2xl font-semibold', live ? 'text-ok' : configured ? 'text-high' : 'text-ink-muted')}>
            <span className={cx('size-2.5 rounded-full', live ? 'bg-ok' : configured ? 'bg-warn' : 'bg-ink-muted')} aria-hidden />
            {live ? 'Connected' : configured ? 'Key set' : 'Not connected'}
          </p>
          <p className="mt-1 text-xs text-ink-muted">{lastHook.data ? `Last webhook ${ago(lastHook.data.received_at)}` : 'No webhooks received yet'}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-ink-muted">OneChurch plan</p>
          <p className="mt-2 font-serif text-2xl font-semibold">Core Plus or Premium</p>
          <p className="mt-1 text-xs text-high">Required for API and webhooks · confirm KAM&apos;s plan</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-ink-muted">API rate limit</p>
          <p className="mt-2 font-serif text-2xl font-semibold">{rate.used} of {rate.limit} <span className="font-sans text-sm font-normal text-ink-muted">requests / 10 sec</span></p>
          <Bar value={rate.used} max={rate.limit} className="mt-2" />
          <p className="mt-1 text-xs text-ink-muted">This server, right now{rate.remaining !== null ? ` · OneChurch says ${rate.remaining} left` : ''}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-ink-muted">Sign-ins matched</p>
          <p className="mt-2 font-serif text-2xl font-semibold">{(matched.count ?? 0).toLocaleString()} <span className="font-sans text-sm font-normal text-ink-muted">of {(totalProfiles.count ?? 0).toLocaleString()}</span></p>
          {openReviews.length > 0
            ? <a href="#matching" className="mt-1 block text-xs text-navy-800 underline">{openReviews.length} waiting for review</a>
            : <p className="mt-1 text-xs text-ink-muted">Nothing waiting for review</p>}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card className="pb-5">
          <CardHeader title="API key" right={<a href="#rotate" className={buttonClass('secondary', 'sm')}>Rotate key</a>} />
          <dl className="grid grid-cols-[96px_1fr] gap-y-3 px-5 text-sm">
            <dt className="text-ink-muted">Name</dt><dd className="font-medium">KAM Care backend</dd>
            <dt className="text-ink-muted">Access level</dt><dd><strong>Custom</strong> · never Super User</dd>
            <dt className="text-ink-muted">Key</dt><dd className="font-mono">{key ? `ocs_••••••••${key.slice(-4)}` : 'Not set'}</dd>
            <dt className="text-ink-muted">Stored</dt><dd>Server environment only. Never in the app or browser.</dd>
            <dt className="text-ink-muted">Rotation</dt>
            <dd>
              Every 90 days · {rotatedOn ? `next ${fmtShort(addDays(rotatedOn, 90))}` : 'no rotation logged'}
              <form action={markKeyRotated} className="mt-1"><button className="text-xs text-navy-800 underline">Mark rotated today</button></form>
            </dd>
          </dl>
          <h3 className="mt-5 px-5 text-sm font-semibold">Custom permissions</h3>
          <ul className="mt-2 px-5">
            {PERMISSIONS.map((p) => (
              <li key={p.name} className="flex items-center justify-between gap-3 border-t border-line py-2.5">
                <span>
                  <span className="block text-sm font-medium">{p.name}</span>
                  <span className="text-xs text-ink-muted">{p.detail}</span>
                </span>
                <Pill tone={p.level === 'Off' ? 'neutral' : p.level === 'Write' ? 'warn' : p.level === 'Read + write' ? 'navy' : 'ok'}>{p.level}</Pill>
              </li>
            ))}
          </ul>
          <details id="rotate" className="mx-5 mt-4 rounded-lg bg-canvas p-3 text-sm">
            <summary className="cursor-pointer font-medium">How to rotate the key</summary>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-ink-muted">
              <li>In OneChurch, go to Settings → API / Webhooks → API Keys → Add New.</li>
              <li>Name it &ldquo;KAM Care backend&rdquo;, choose <strong>Custom</strong> access and set the permissions above.</li>
              <li>Copy the token (OneChurch shows it once) into <code>ONECHURCH_API_KEY</code> in Vercel → Settings → Environment Variables.</li>
              <li>Redeploy, then press <strong>Test connection</strong> here.</li>
              <li>Delete the old key in OneChurch and press &ldquo;Mark rotated today&rdquo;.</li>
            </ol>
          </details>
        </Card>

        <div className="space-y-6">
          <Card className="overflow-hidden pb-4">
            <CardHeader
              title="Webhook subscriptions"
              subtitle="OneChurch tells KAM Care the moment something changes, so we rarely need to ask."
              right={<ActionButton kind="webhooks" label={subscribed.size ? 'Re-register webhooks' : 'Register webhooks'} pendingLabel="Registering…" />}
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-canvas text-left text-xs tracking-wider text-ink-muted uppercase">
                  <tr>{['Event', 'What KAM Care does', 'Last 24h'].map((h) => <th key={h} scope="col" className="px-5 py-3 font-medium">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {WEBHOOK_EVENTS.map((e, i) => (
                    <tr key={e} className="border-t border-line">
                      <td className="px-5 py-3 font-mono text-[13px] font-semibold">
                        {e}
                        {!subscribed.has(e) && <span className="ml-2 font-sans text-[11px] font-normal text-high">not subscribed</span>}
                      </td>
                      <td className="px-5">{EVENT_DOES[e]}</td>
                      <td className="px-5 tabular-nums">{counts[i].count ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h3 className="mt-4 px-5 text-sm font-semibold">Recent deliveries</h3>
            {!recent.data?.length && <p className="px-5 pt-2 text-sm text-ink-muted">Nothing received yet.</p>}
            <ul className="mt-2 px-5 text-xs">
              {(recent.data ?? []).map((r) => (
                <li key={r.id} className="grid grid-cols-[64px_1fr_40px] gap-3 py-1.5 sm:grid-cols-[64px_200px_40px_1fr]">
                  <span className="text-ink-muted">{time(r.received_at)}</span>
                  <span className="font-mono">{r.event === 'reconcile' ? 'nightly reconcile' : r.event}</span>
                  <span className={cx('font-semibold tabular-nums', r.http_status === 200 && r.status !== 'failed' ? 'text-ok' : 'text-high')}>{r.status === 'failed' ? 'ERR' : r.http_status}</span>
                  <span className="col-span-3 text-ink-muted sm:col-span-1">{r.error ?? r.summary ?? (r.status === 'received' ? 'Processing…' : '')}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="pb-4">
            <CardHeader title="Sync history" subtitle="Nightly reconcile at 2 AM and attendance every 30 minutes." />
            {!runs.data?.length && <p className="px-5 text-sm text-ink-muted">No runs yet.</p>}
            <ul className="px-5 text-sm">
              {(runs.data ?? []).map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-line py-2">
                  <span><span className="font-medium capitalize">{r.kind}</span> · <span className="text-ink-muted">{fmtShort(r.started_at)} {time(r.started_at)}</span></span>
                  <span className="text-xs text-ink-muted">
                    {r.finished_at === null ? <Pill tone="navy">Running</Pill> : r.ok ? (
                      <Pill tone="ok">{Object.entries((r.stats as Record<string, unknown>) ?? {}).map(([k, v]) => `${k} ${v}`).join(' · ') || 'Done'}</Pill>
                    ) : <Pill tone="bad">{(r.error ?? 'Failed').slice(0, 80)}</Pill>}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <Card className="mt-6 overflow-hidden">
        <CardHeader title="Where each care signal comes from" subtitle={'From OneChurch\u2019s public API reference. \u201cVerify\u201d items need a test with KAM\u2019s own account.'} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-canvas text-left text-xs tracking-wider text-ink-muted uppercase">
              <tr>{['KAM Care signal', 'OneChurch source', "How it's used", 'Status'].map((h) => <th key={h} scope="col" className="px-5 py-3 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {SIGNAL_SOURCES.map((s) => (
                <tr key={s.signal} className="border-t border-line">
                  <th scope="row" className="px-5 py-3 text-left font-semibold">{s.signal}</th>
                  <td className="px-5">{s.source}</td>
                  <td className="px-5">{s.use}</td>
                  <td className="px-5"><Pill tone={s.status === 'Available' ? 'ok' : 'warn'}>{s.status}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card id="matching" className="px-5 pb-3">
          <h2 className="pt-5 font-serif text-xl font-semibold">Matching sign-ins to People</h2>
          <ol className="mt-3 mb-3 list-decimal space-y-1 pl-5 text-sm">
            <li>Verified email matches one OneChurch person</li>
            <li>Otherwise, verified mobile matches one person</li>
            <li>Shared family email or no match: Member Services reviews</li>
          </ol>
          {openReviews.length === 0 && <p className="border-t border-line py-4 text-sm text-ink-muted">No sign-ins waiting for review.</p>}
          <ul>
            {openReviews.map((r) => (
              <MatchReview
                key={r.id}
                reviewId={r.id}
                label={r.label}
                reason={r.reason}
                candidates={r.candidate_person_ids.map(candidateHit).filter((x): x is NonNullable<typeof x> => !!x)}
              />
            ))}
          </ul>
        </Card>

        <section className="h-fit rounded-xl bg-navy-900 p-5 text-white">
          <h2 className="font-serif text-xl font-semibold">Sync rules</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-white/90">
            <li>Webhooks first; a nightly reconcile at 2 AM catches anything missed</li>
            <li>Requests queue under 30 per 10 seconds; on a 429, wait for Retry-After</li>
            <li>Gift amounts are read to spot a pattern, then discarded, never stored</li>
            <li>Care touches can be written back as OneChurch Notes, pastors-only</li>
            <li>Sensitive matters never leave KAM Care</li>
          </ul>
          <div className="mt-5">
            <WriteBackToggle on={writeBack} />
          </div>
        </section>
      </div>
    </div>
  )
}
