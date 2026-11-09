import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { addDays, daysBetween, nextAnniversary, todayISO } from '@/lib/dates'
import type { Channel, MomentType, Urgency } from '@/lib/types'

type Sb = Awaited<ReturnType<typeof createClient>>

const URGENCY_RANK: Record<Urgency, number> = { urgent: 3, high: 2, normal: 1 }

export type QueueRow = {
  caseId: string
  personId: string
  name: string
  campusId: string | null
  campusName: string | null
  phone: string | null
  email: string | null
  urgency: Urgency
  sensitive: boolean
  why: string
  actionTitle: string
  actionDetail: string | null
  channels: Channel[]
  ownerTeamId: string | null
  dueOn: string | null
  lastTouchAt: string | null
  unassigned: boolean
}

export type QueueFilter = 'all' | 'urgent' | 'mine' | 'sensitive' | 'unassigned'

/** Open care cases the viewer can see (RLS), ranked by urgency, then longest since last touch. */
export async function loadQueue(sb: Sb, campus: string | null, teamIds: string[]) {
  const today = todayISO()
  const { data: cases } = await sb
    .from('care_cases')
    .select(
      'id, person_id, household_label, urgency, sensitive, why_flagged, action_title, action_detail, action_channels, owner_team_id, due_on, snoozed_until, person:people!care_cases_person_id_fkey(display_name, campus_id, phone, email, campus:campuses(name))',
    )
    .eq('status', 'open')
  const personIds = [...new Set((cases ?? []).map((c) => c.person_id))]
  const caseIds = (cases ?? []).map((c) => c.id)
  const [{ data: care }, { data: openTasks }] = await Promise.all([
    personIds.length ? sb.from('person_care').select('person_id, last_touch_at').in('person_id', personIds) : Promise.resolve({ data: [] as { person_id: string; last_touch_at: string | null }[] }),
    caseIds.length ? sb.from('tasks').select('case_id, assignee_team_id').in('case_id', caseIds).in('status', ['scheduled', 'due']) : Promise.resolve({ data: [] as { case_id: string | null; assignee_team_id: string | null }[] }),
  ])
  const lastTouch = new Map((care ?? []).map((c) => [c.person_id, c.last_touch_at]))
  const unassigned = new Set((openTasks ?? []).filter((t) => !t.assignee_team_id).map((t) => t.case_id))

  const rows: QueueRow[] = (cases ?? [])
    .filter((c) => !c.snoozed_until || c.snoozed_until <= today)
    .map((c) => {
      const p = c.person as unknown as { display_name: string; campus_id: string | null; phone: string | null; email: string | null; campus: { name: string } | null } | null
      return {
        caseId: c.id,
        personId: c.person_id,
        name: c.household_label ?? p?.display_name ?? 'Member',
        campusId: p?.campus_id ?? null,
        campusName: p?.campus?.name ?? null,
        phone: p?.phone ?? null,
        email: p?.email ?? null,
        urgency: c.urgency,
        sensitive: c.sensitive,
        why: c.why_flagged,
        actionTitle: c.action_title,
        actionDetail: c.action_detail,
        channels: c.action_channels,
        ownerTeamId: c.owner_team_id,
        dueOn: c.due_on,
        lastTouchAt: lastTouch.get(c.person_id) ?? null,
        unassigned: unassigned.has(c.id) || !c.owner_team_id,
      }
    })
    .filter((r) => !campus || r.campusId === campus)
    .sort((a, b) => {
      const u = URGENCY_RANK[b.urgency] - URGENCY_RANK[a.urgency]
      if (u) return u
      // Longest since last touch first; never touched counts as longest.
      return (a.lastTouchAt ?? '').localeCompare(b.lastTouchAt ?? '')
    })

  const counts: Record<QueueFilter, number> = {
    all: rows.length,
    urgent: rows.filter((r) => r.urgency === 'urgent').length,
    mine: rows.filter((r) => r.ownerTeamId && teamIds.includes(r.ownerTeamId)).length,
    sensitive: rows.filter((r) => r.sensitive).length,
    unassigned: rows.filter((r) => r.unassigned).length,
  }
  return { rows, counts }
}

export function applyFilter(rows: QueueRow[], filter: QueueFilter, teamIds: string[]) {
  switch (filter) {
    case 'urgent': return rows.filter((r) => r.urgency === 'urgent')
    case 'mine': return rows.filter((r) => r.ownerTeamId && teamIds.includes(r.ownerTeamId))
    case 'sensitive': return rows.filter((r) => r.sensitive)
    case 'unassigned': return rows.filter((r) => r.unassigned)
    default: return rows
  }
}

function median(xs: number[]) {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** Top KPI row. */
export async function loadKpis(sb: Sb, rows: QueueRow[], campus: string | null) {
  const today = todayISO()
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString()
  const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString()

  const [{ data: dueTasks }, { data: recentCases }, optedIn, totalConsents] = await Promise.all([
    sb.from('tasks').select('id, case:care_cases(urgency), person:people!tasks_person_id_fkey(campus_id)').in('status', ['scheduled', 'due']).lte('due_on', today),
    sb.from('care_cases').select('opened_at, first_touch_at, person:people!care_cases_person_id_fkey(campus_id)').gte('opened_at', since30),
    sb.from('consents').select('person_id', { count: 'exact', head: true }).eq('weekly_checkin', true),
    sb.from('consents').select('person_id', { count: 'exact', head: true }),
  ])

  const inCampus = (p: unknown) => !campus || (p as { campus_id: string | null } | null)?.campus_id === campus
  const due = (dueTasks ?? []).filter((t) => inCampus(t.person))
  const urgentDue = due.filter((t) => (t.case as { urgency: Urgency } | null)?.urgency === 'urgent').length
  const firstTouchHours = (recentCases ?? [])
    .filter((c) => c.first_touch_at && inCampus(c.person))
    .map((c) => (Date.parse(c.first_touch_at!) - Date.parse(c.opened_at)) / 3_600_000)
  const { count: newCases } = await sb.from('care_cases').select('id', { count: 'exact', head: true }).eq('status', 'open').gte('opened_at', weekAgo)

  return {
    membersNeedingCare: new Set(rows.map((r) => r.personId)).size,
    newThisWeek: newCases ?? 0,
    dueToday: due.length,
    urgentDue,
    routineDue: due.length - urgentDue,
    medianFirstTouch: median(firstTouchHours),
    optedIn: optedIn.count ?? 0,
    totalMembers: totalConsents.count ?? 0,
  }
}

// ─── Life moments ───────────────────────────────────────────────────────────

export const MOMENT_TILES: { type: MomentType; label: string; tone: string; summary: string }[] = [
  { type: 'bereavement', label: 'Bereavement', tone: 'bg-tile-rose', summary: 'Pastor call within 24h, Funerals ministry, grief follow-ups at 30/90/365 days' },
  { type: 'sickness', label: 'Sickness & hospital', tone: 'bg-tile-peach', summary: 'Visit or call, prayer team, meal train' },
  { type: 'shut_in', label: 'Shut-ins', tone: 'bg-tile-peach', summary: 'Monthly visit, Communion, livestream help' },
  { type: 'birth', label: 'Births', tone: 'bg-tile-sage', summary: 'Card and gift, Baby Dedication invite' },
  { type: 'wedding', label: 'Weddings', tone: 'bg-tile-sage', summary: 'Note from the pastor, marriage ministry intro' },
  { type: 'anniversary', label: 'Wedding anniversaries', tone: 'bg-tile-sky', summary: 'Text from the pastor on the date; e-card for 10, 25, 50 years' },
  { type: 'promotion', label: 'Promotions & new jobs', tone: 'bg-tile-sage', summary: 'Congratulate, invite to mentor or serve' },
  { type: 'award', label: 'Awards & graduations', tone: 'bg-tile-sage', summary: 'Card; Sunday shout-out only with permission' },
  { type: 'work_anniversary', label: 'Work anniversaries', tone: 'bg-tile-sky', summary: 'Encouragement text on the date' },
]

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

function describeMoment(type: MomentType, who: string | null, note: string | null, years: number | null) {
  switch (type) {
    case 'bereavement':
      return years ? `${years} year${years > 1 ? 's' : ''} since their loss${who ? ` (${who.toLowerCase()})` : ''}. Pastor call and a card.` : `Loss of a loved one${who ? ` (${who.toLowerCase()})` : ''}. Pastor call within 24h.`
    case 'anniversary':
      return years ? `${ordinal(years)} wedding anniversary. Pastor text${[10, 25, 50].includes(years) ? ' and e-card' : ''}.` : 'Wedding anniversary. Pastor text.'
    case 'work_anniversary':
      return `${years ? `${years} years at work` : 'Work anniversary'}. Encouragement text.`
    case 'promotion':
      return `${who ? `Promoted: ${who}` : 'New job or promotion'}. Congratulations text.`
    case 'sickness':
      return `${who ?? 'Illness or surgery'}. Prayer call, then a visit.`
    case 'shut_in':
      return `Shut-in${who ? `, ${who.toLowerCase()}` : ''}. Home visit.`
    case 'birth':
      return 'New baby. Card and Baby Dedication invite.'
    case 'birthday':
      return `${who ? `Turning ${who.replace(' years', '')}` : 'Birthday'}. Birthday text.`
    default:
      return note ?? who ?? 'Life moment'
  }
}

/** This week's moments (Sunday → Saturday) by type, and what's coming up in the next 7 days. */
export async function loadMoments(sb: Sb, campus: string | null) {
  const today = todayISO()
  const dow = new Date(today + 'T12:00:00Z').getUTCDay()
  const weekStart = addDays(today, -dow)
  const weekEnd = addDays(weekStart, 6)
  const horizon = addDays(today, 6)

  const [{ data: moments }, { count: shutIns }] = await Promise.all([
    sb
      .from('life_moments')
      .select('id, type, moment_date, who, note, remind_yearly, status, person:people!life_moments_person_id_fkey(id, display_name, campus_id)')
      .or(`moment_date.gte.${addDays(weekStart, -1)},remind_yearly.eq.true`),
    sb.from('person_care').select('person_id', { count: 'exact', head: true }).eq('is_shut_in', true),
  ])

  const effective = (moments ?? [])
    .map((m) => {
      const p = m.person as unknown as { id: string; display_name: string; campus_id: string | null } | null
      let date = m.moment_date
      let years: number | null = null
      if (m.remind_yearly || m.type === 'anniversary' || m.type === 'work_anniversary') {
        const next = nextAnniversary(m.moment_date, weekStart)
        date = next.date
        years = next.years || null
      }
      return { ...m, date, years, person: p }
    })
    .filter((m) => !campus || m.person?.campus_id === campus)

  const counts = new Map<MomentType, number>()
  for (const m of effective) if (m.date >= weekStart && m.date <= weekEnd) counts.set(m.type, (counts.get(m.type) ?? 0) + 1)
  counts.set('shut_in', Math.max(counts.get('shut_in') ?? 0, shutIns ?? 0))

  const upcoming = effective
    .filter((m) => m.date >= today && m.date <= horizon && m.person)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 8)
    .map((m) => ({ id: m.id, date: m.date, personId: m.person!.id, name: m.person!.display_name, text: describeMoment(m.type, m.who, m.note, m.years) }))

  const total = [...counts.entries()].filter(([t]) => t !== 'shut_in').reduce((s, [, n]) => s + n, 0) + (counts.get('shut_in') ?? 0)
  return { counts, upcoming, total }
}

// ─── Care pulse ─────────────────────────────────────────────────────────────

export async function loadPulse(sb: Sb) {
  const since = new Date(Date.now() - 42 * 86_400_000).toISOString()
  const cutoff = new Date(Date.now() - 21 * 86_400_000).toISOString()
  const [{ data: checkins }, { data: campuses }] = await Promise.all([
    sb.from('checkins').select('person_id, score, created_at, person:people!checkins_person_id_fkey(campus_id)').gte('created_at', since).order('created_at', { ascending: false }),
    sb.from('campuses').select('id, name').order('sort'),
  ])
  const latestNow = new Map<string, { campus: string; score: number }>()
  const latestThen = new Map<string, { campus: string; score: number }>()
  for (const c of checkins ?? []) {
    const campus = (c.person as { campus_id: string | null } | null)?.campus_id
    if (!campus) continue
    const target = c.created_at >= cutoff ? latestNow : latestThen
    if (!target.has(c.person_id)) target.set(c.person_id, { campus, score: c.score })
  }
  const avg = (m: Map<string, { campus: string; score: number }>, campus: string) => {
    const xs = [...m.values()].filter((v) => v.campus === campus).map((v) => ((v.score - 1) / 4) * 100)
    return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null
  }
  return (campuses ?? []).map((c) => {
    const now = avg(latestNow, c.id)
    const then = avg(latestThen, c.id)
    return { id: c.id, name: c.name, score: now, delta: now !== null && then !== null ? now - then : null }
  })
}

// ─── Giving (pastors only; RLS returns nothing for others) ──────────────────

export async function loadGiving(sb: Sb) {
  const since60 = addDays(todayISO(), -60)
  const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const [{ data: patterns }, { count: newRecurring }] = await Promise.all([
    sb.from('giving_patterns').select('trend, recurring_stopped_on, years_giving'),
    sb.from('signals').select('id', { count: 'exact', head: true }).eq('kind', 'giving_new_recurring').gte('occurred_at', since30),
  ])
  const p = patterns ?? []
  return {
    firstTime: p.filter((x) => x.trend === 'new').length,
    stopped: p.filter((x) => x.recurring_stopped_on && x.recurring_stopped_on >= since60).length,
    up: p.filter((x) => x.trend === 'up').length,
    newRecurring: newRecurring ?? 0,
    quiet: p.filter((x) => x.trend === 'lapsed' && (x.years_giving ?? 0) >= 3).length,
  }
}

// ─── Signal sources + outcomes ──────────────────────────────────────────────

export async function loadSources(sb: Sb) {
  const day = new Date(Date.now() - 36 * 3_600_000).toISOString()
  const [{ data: runs }, { data: events }, checkins, social, { data: lastRequest }] = await Promise.all([
    sb.from('sync_runs').select('kind, ok, finished_at').eq('ok', true).gte('finished_at', day),
    sb.from('oc_webhook_events').select('event, status').gte('received_at', day),
    sb.from('consents').select('person_id', { count: 'exact', head: true }).eq('weekly_checkin', true),
    sb.from('consents').select('person_id', { count: 'exact', head: true }).eq('social_connected', true),
    sb.from('care_requests').select('created_at').order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  const ran = (kind: string) => (runs ?? []).some((r) => r.kind === kind)
  const got = (event: string) => (events ?? []).some((e) => e.event === event && e.status !== 'failed')
  return {
    attendance: ran('attendance') || ran('reconcile') || got('reconcile'),
    giving: ran('reconcile') || got('contribution_created'),
    profiles: ran('reconcile') || got('person_updated') || got('person_created'),
    checkinsOptedIn: checkins.count ?? 0,
    requestsLive: !!lastRequest,
    socialConnected: social.count ?? 0,
  }
}

export async function loadOutcomes(sb: Sb) {
  const monthStart = todayISO().slice(0, 8) + '01'
  const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const since90 = new Date(Date.now() - 90 * 86_400_000).toISOString()
  const [touches, { data: closed }, { data: lapsed }, { data: ratings }] = await Promise.all([
    sb.from('touches').select('id', { count: 'exact', head: true }).gte('occurred_at', monthStart),
    sb.from('care_cases').select('opened_at, closed_at').eq('status', 'closed').gte('closed_at', since30),
    sb.from('care_cases').select('person_id, closed_at').eq('status', 'closed').gte('closed_at', since90).or('why_flagged.ilike.Missed%,why_flagged.ilike.Hasn%'),
    sb.from('care_ratings').select('rating').gte('created_at', since90),
  ])
  const c = closed ?? []
  const within72 = c.filter((x) => x.closed_at && Date.parse(x.closed_at) - Date.parse(x.opened_at) <= 72 * 3_600_000).length

  let returned = 0
  const lapsedRows = lapsed ?? []
  if (lapsedRows.length) {
    const { data: att } = await sb.from('attendance').select('person_id, meeting_date').in('person_id', lapsedRows.map((l) => l.person_id)).gte('meeting_date', since90.slice(0, 10))
    returned = lapsedRows.filter((l) => (att ?? []).some((a) => a.person_id === l.person_id && l.closed_at && a.meeting_date >= l.closed_at.slice(0, 10))).length
  }
  const r = ratings ?? []
  return {
    touchesThisMonth: touches.count ?? 0,
    closedWithin72: c.length ? Math.round((within72 / c.length) * 100) : null,
    lapsedReturned: returned,
    rating: r.length ? Math.round((r.reduce((s, x) => s + x.rating, 0) / r.length) * 10) / 10 : null,
  }
}

export function dayDiff(iso: string | null) {
  return iso ? daysBetween(iso.slice(0, 10), todayISO()) : null
}
