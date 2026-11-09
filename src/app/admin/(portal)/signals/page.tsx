import type { Metadata } from 'next'
import { requireStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { addDays, fmtShort, todayISO } from '@/lib/dates'
import { Bar, buttonClass, Card, CardHeader, Empty, inputClass, PageTitle, PastorsOnly, Pill } from '@/components/ui'
import { deleteRoleMapping, saveRoleMapping } from './actions'
import { isOneChurchConfigured } from '@/lib/onechurch/client'
import { errorText, searchGroups } from '@/lib/onechurch/sync'

export const metadata: Metadata = { title: 'Signals & consent' }

const CAMPUS: Record<string, string> = { indianapolis: 'Indianapolis', detroit: 'Detroit', atlanta: 'Atlanta', global: 'Global' }
const ROLE_LABEL = { member: 'Member', care_leader: 'Care leader', staff: 'Staff', pastor: 'Pastor' } as const

const CONSENTS = [
  { key: 'weekly_checkin', label: 'Weekly check-in' },
  { key: 'texts', label: 'Texts from care team' },
  { key: 'emails', label: 'Emails' },
  { key: 'use_attendance', label: 'Use attendance to check on me' },
  { key: 'celebrate_milestones', label: 'Celebrate milestones' },
  { key: 'use_giving', label: 'Use giving changes to check on me' },
  { key: 'social_connected', label: 'Social account connected' },
] as const

const dotColor: Record<string, string> = { urgent: 'bg-urgent', high: 'bg-warn', normal: 'bg-navy-800' }

export default async function SignalsPage({ searchParams }: { searchParams: Promise<{ group?: string }> }) {
  const viewer = await requireStaff()
  const groupQuery = ((await searchParams).group ?? '').trim().slice(0, 80)
  const supabase = await createClient()
  // Health counts only (no member detail) — read across everything so the numbers are complete.
  const admin = createAdminClient()
  const today = todayISO()
  const weekAgo = addDays(today, -7)

  const headCount = async (key?: (typeof CONSENTS)[number]['key'], campus?: string) => {
    let q = admin.from('consents').select(campus ? 'person_id, people!inner(campus_id)' : 'person_id', { count: 'exact', head: true })
    if (key) q = q.eq(key, true)
    if (campus) q = q.eq('people.campus_id', campus)
    return (await q).count ?? 0
  }
  const campusIds = Object.keys(CAMPUS)
  const [total, consentCounts, campusTotals, campusOptIns] = await Promise.all([
    headCount(),
    Promise.all(CONSENTS.map((c) => headCount(c.key))),
    Promise.all(campusIds.map((id) => headCount(undefined, id))),
    Promise.all(campusIds.map((id) => headCount('weekly_checkin', id))),
  ])
  const count = (k: (typeof CONSENTS)[number]['key']) => consentCounts[CONSENTS.findIndex((c) => c.key === k)]

  const [signalsRes, mappingsRes, attendanceRes, requestsRes, datesRes, givingRes, lastPerson] = await Promise.all([
    supabase.from('signals').select('id, kind, summary, source, severity, occurred_at, pastors_only, person:people!signals_person_id_fkey(display_name)').order('occurred_at', { ascending: false }).limit(30),
    viewer.isAdmin ? supabase.from('role_mappings').select('*').order('role') : Promise.resolve({ data: null }),
    admin.from('attendance').select('id', { count: 'exact', head: true }).gte('meeting_date', weekAgo),
    admin.from('care_requests').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo),
    admin.from('people').select('id', { count: 'exact', head: true }).or('birthday.not.is.null,anniversary.not.is.null'),
    admin.from('giving_patterns').select('person_id', { count: 'exact', head: true }),
    admin.from('people').select('synced_at').not('synced_at', 'is', null).order('synced_at', { ascending: false }).limit(1).maybeSingle(),
  ])

  const synced = lastPerson.data?.synced_at

  const sources = [
    { name: 'OneChurch attendance', detail: 'Check-ins, streams, groups', status: attendanceRes.count ? `${attendanceRes.count} this week` : 'No records this week', ok: !!attendanceRes.count },
    { name: 'Giving patterns', detail: 'Firsts, lapses, increases · pastors only', status: viewer.role === 'pastor' ? `${givingRes.count ?? 0} patterns` : 'Pastors only', ok: true },
    { name: 'Profile dates', detail: 'Birthdays, anniversaries, work milestones', status: `${datesRes.count ?? 0} on file`, ok: !!datesRes.count },
    { name: 'Weekly member check-ins', detail: 'Member portal + text reply', status: `${count('weekly_checkin').toLocaleString()} opted in`, ok: true },
    { name: 'Prayer & care requests', detail: 'Portal, cards, text line', status: `${requestsRes.count ?? 0} this week`, ok: true },
    { name: 'People sync', detail: 'OneChurch webhooks + nightly reconcile', status: synced ? `Synced ${fmtShort(synced)}` : 'Not synced yet', ok: !!synced },
    { name: 'Member-connected social', detail: 'Public posts, opt-in only', status: `${count('social_connected')} connected`, ok: true },
  ]

  return (
    <div className="mx-auto max-w-6xl">
      <PageTitle title="Signals & consent" subtitle="Where care signals come from, and what each member has allowed us to use" />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="pb-3">
          <CardHeader title="Signal sources" />
          <ul>
            {sources.map((s) => (
              <li key={s.name} className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
                <span>
                  <span className="block text-sm font-semibold">{s.name}</span>
                  <span className="text-xs text-ink-muted">{s.detail}</span>
                </span>
                <Pill tone={s.ok ? 'ok' : 'warn'}>{s.status}</Pill>
              </li>
            ))}
          </ul>
          <p className="mx-5 mt-3 rounded-lg bg-canvas p-3 text-xs text-ink-muted">
            Signals are used only when the member has allowed it. Care teams see the signal, never a gift amount, and a giving change never leads to an ask.
          </p>
        </Card>

        <Card className="pb-5">
          <CardHeader title="Member consent" subtitle={`${total.toLocaleString()} members with consent settings`} />
          <ul className="space-y-3 px-5">
            {CONSENTS.map((c) => {
              const n = count(c.key)
              return (
                <li key={c.key}>
                  <div className="flex justify-between text-sm">
                    <span>{c.label}</span>
                    <span className="tabular-nums text-ink-muted"><strong className="text-ink">{n.toLocaleString()}</strong> · {total ? Math.round((n / total) * 100) : 0}%</span>
                  </div>
                  <Bar value={n} max={total} className="mt-1" />
                </li>
              )
            })}
          </ul>
          <h3 className="mt-6 px-5 text-sm font-semibold">Weekly check-in opt-in by campus</h3>
          <div className="mt-2 grid grid-cols-2 gap-3 px-5 sm:grid-cols-4">
            {campusIds.map((id, i) => {
              const name = CAMPUS[id]
              const pct = campusTotals[i] ? Math.round((campusOptIns[i] / campusTotals[i]) * 100) : 0
              return (
                <div key={id} className="rounded-lg bg-canvas p-3">
                  <p className="text-xs text-ink-muted">{name}</p>
                  <p className="font-serif text-2xl font-semibold">{pct}%</p>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      <Card className="mt-6 pb-2">
        <CardHeader title="Recent signals" subtitle="Newest first. Pastors-only signals are hidden from staff." />
        {!signalsRes.data?.length && <Empty>No signals yet.</Empty>}
        <ul>
          {(signalsRes.data ?? []).map((s) => (
            <li key={s.id} className="grid grid-cols-[64px_12px_1fr] items-start gap-3 border-t border-line px-5 py-3 text-sm">
              <span className="text-ink-muted">{fmtShort(s.occurred_at)}</span>
              <span className={`mt-1.5 size-2.5 rounded-full ${dotColor[s.severity]}`} aria-hidden />
              <span>
                <span className="font-semibold">{(s.person as { display_name: string } | null)?.display_name ?? 'Member'}</span> · {s.summary}
                {s.pastors_only && <span className="ml-2 align-middle"><PastorsOnly /></span>}
                <span className="block text-xs text-ink-muted">{s.source}</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>

      {viewer.isAdmin && (
        <Card className="mt-6 pb-5">
          <CardHeader
            title="Roles from OneChurch groups"
            subtitle="Membership in these OneChurch groups sets a person's KAM Care access. Removing someone from the group removes their access at the next sync."
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-canvas text-left text-xs tracking-wider text-ink-muted uppercase">
                <tr>{['Group id', 'Group', 'Role', 'Admin', ''].map((h) => <th key={h} scope="col" className="px-5 py-3 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {(mappingsRes.data ?? []).map((m) => (
                  <tr key={m.oc_group_id} className="border-t border-line">
                    <td className="px-5 py-3 font-mono tabular-nums">{m.oc_group_id}</td>
                    <td className="px-5">{m.group_name}</td>
                    <td className="px-5">{ROLE_LABEL[m.role]}</td>
                    <td className="px-5">{m.grants_admin ? 'Yes' : '—'}</td>
                    <td className="px-5 text-right">
                      <form action={deleteRoleMapping}>
                        <input type="hidden" name="ocGroupId" value={m.oc_group_id} />
                        <button className="text-sm text-urgent hover:underline">Remove</button>
                      </form>
                    </td>
                  </tr>
                ))}
                {!mappingsRes.data?.length && (
                  <tr><td colSpan={5} className="px-5 py-4 text-ink-muted">No groups mapped yet. Until you add some, everyone signs in as a member.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <GroupFinder query={groupQuery} />
          <details className="mt-4 px-5">
            <summary className="cursor-pointer text-sm font-medium text-navy-800">Add by group id instead</summary>
          <form action={saveRoleMapping} className="mt-4 grid gap-3 sm:grid-cols-[120px_1fr_160px_auto_auto] sm:items-end">
            <label className="text-sm"><span className="mb-1 block font-medium">Group id</span><input name="ocGroupId" required inputMode="numeric" className={inputClass} /></label>
            <label className="text-sm"><span className="mb-1 block font-medium">Group name</span><input name="groupName" required className={inputClass} placeholder="Care Deacons" /></label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Role</span>
              <select name="role" className={inputClass} defaultValue="care_leader">
                <option value="care_leader">Care leader</option>
                <option value="staff">Staff</option>
                <option value="pastor">Pastor</option>
                <option value="member">Member</option>
              </select>
            </label>
            <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" name="grantsAdmin" className="size-4" /> Admin</label>
            <button className={buttonClass('primary')}>Save mapping</button>
          </form>
          </details>
        </Card>
      )}
    </div>
  )
}

/** Searches OneChurch groups by name (server-side; the API key never reaches the browser). */
async function GroupFinder({ query }: { query: string }) {
  if (!isOneChurchConfigured()) {
    return <p className="mt-4 px-5 text-sm text-ink-muted">Connect OneChurch to search its groups here.</p>
  }
  let results: Awaited<ReturnType<typeof searchGroups>> = []
  let error: string | null = null
  if (query) {
    try {
      results = await searchGroups(query)
    } catch (e) {
      error = errorText(e)
    }
  }
  return (
    <div className="mt-5 border-t border-line px-5 pt-5">
      <h3 className="text-sm font-semibold">Find a OneChurch group</h3>
      <form className="mt-2 flex flex-wrap gap-2" role="search">
        <input name="group" defaultValue={query} placeholder="e.g. Care Team" className={inputClass + ' max-w-xs'} aria-label="Group name" />
        <button className={buttonClass('secondary')}>Search</button>
      </form>
      {error && <p className="mt-3 text-sm text-urgent">OneChurch said: {error}</p>}
      {query && !error && !results.length && <p className="mt-3 text-sm text-ink-muted">No active groups match &ldquo;{query}&rdquo;.</p>}
      {results.length > 0 && (
        <ul className="mt-3 divide-y divide-line rounded-lg border border-line">
          {results.map((g) => (
            <li key={g.id} className="p-3">
              <form action={saveRoleMapping} className="flex flex-wrap items-center gap-3">
                <input type="hidden" name="ocGroupId" value={g.id} />
                <input type="hidden" name="groupName" value={g.name} />
                <div className="min-w-48 flex-1">
                  <p className="font-medium">{g.name}</p>
                  <p className="text-xs text-ink-muted">
                    {[g.category, g.campus, g.members !== null ? `${g.members} members` : null, `id ${g.id}`].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <select name="role" defaultValue="care_leader" className={inputClass + ' w-40'} aria-label={`Role for ${g.name}`}>
                  <option value="care_leader">Care leader</option>
                  <option value="staff">Staff</option>
                  <option value="pastor">Pastor</option>
                </select>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="createTeam" defaultChecked className="size-4" /> Also make it a care team</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="grantsAdmin" className="size-4" /> Admin</label>
                <button className={buttonClass('primary', 'sm')}>Map group</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
