import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import type { Channel } from '@/lib/types'
import { addDays, todayISO } from '@/lib/dates'

/**
 * Insights are aggregates (counts, medians, rates) over all care data, so they read with the
 * service-role client after the page has checked the viewer is staff. No member-level detail
 * leaves this module.
 */

type Db = SupabaseClient<Database>

export type Range = '30' | '90' | '365'
export const RANGE_LABEL: Record<Range, string> = { '30': 'last 30 days', '90': 'last 90 days', '365': 'last year' }

const FIRST_TOUCH_GOAL_H = 24
const H72 = 72 * 3_600_000

/** Pages past the 1,000-row API cap. */
async function all<T>(q: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await q(from, from + 999)
    if (error) throw error
    out.push(...(data ?? []))
    if (!data || data.length < 1000) return out
  }
}

function median(xs: number[]) {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

const hoursToFirstTouch = (c: { opened_at: string; first_touch_at: string | null }) =>
  c.first_touch_at ? (Date.parse(c.first_touch_at) - Date.parse(c.opened_at)) / 3_600_000 : null

const closedIn72 = (c: { opened_at: string; closed_at: string | null }) =>
  !!c.closed_at && Date.parse(c.closed_at) - Date.parse(c.opened_at) <= H72

export const NEED_TYPES = [
  'Missed attendance', 'Low check-in', 'Sickness & hospital', 'Practical help',
  'Celebrations', 'Bereavement', 'Shut-in visits', 'Giving pattern change',
] as const
type NeedType = (typeof NEED_TYPES)[number]

const CELEBRATIONS = new Set(['birth', 'wedding', 'promotion', 'award', 'anniversary', 'work_anniversary', 'birthday', 'moved'])

export function needType(c: { why_flagged: string; moment_type: string | null }): NeedType | null {
  const w = c.why_flagged.toLowerCase()
  if (c.moment_type === 'bereavement' || /bereave|passed/.test(w)) return 'Bereavement'
  if (/giving/.test(w)) return 'Giving pattern change'
  if (c.moment_type === 'shut_in' || /shut-in/.test(w)) return 'Shut-in visits'
  if (c.moment_type === 'sickness' || /hospital|surgery|sick/.test(w)) return 'Sickness & hospital'
  if (/practical|benevolence|groceries|holiday help/.test(w)) return 'Practical help'
  if (/check-in/.test(w)) return 'Low check-in'
  if (/missed|livestream|sundays/.test(w)) return 'Missed attendance'
  if (c.moment_type && CELEBRATIONS.has(c.moment_type)) return 'Celebrations'
  if (/baby|wedding|promot|anniversar|graduat/.test(w)) return 'Celebrations'
  return null
}

export async function loadInsights(db: Db, range: Range) {
  const days = Number(range)
  const now = Date.now()
  const today = todayISO()
  const start = new Date(now - days * 86_400_000).toISOString()
  const priorStart = new Date(now - 2 * days * 86_400_000).toISOString()
  const sixMonthsAgo = new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1).toISOString()
  const caseFrom = [priorStart, sixMonthsAgo, new Date(now - 455 * 86_400_000).toISOString()].sort()[0]

  const [cases, touches, people, consents, teams, openTasks, checkins, ratings, practical, attendance] = await Promise.all([
    all((f, t) => db.from('care_cases').select('id, person_id, status, opened_at, first_touch_at, closed_at, why_flagged, moment_type, owner_team_id').gte('opened_at', caseFrom).range(f, t)),
    all((f, t) => db.from('touches').select('person_id, channel, outcome, occurred_at').gte('occurred_at', priorStart).range(f, t)),
    all((f, t) => db.from('people').select('id, campus_id').eq('archived', false).eq('deceased', false).eq('is_guest', false).range(f, t)),
    all((f, t) => db.from('consents').select('person_id, weekly_checkin').range(f, t)),
    db.from('care_teams').select('id, name, kind, campus_id').eq('active', true).then((r) => r.data ?? []),
    all((f, t) => db.from('tasks').select('assignee_team_id, due_on, status').in('status', ['scheduled', 'due']).range(f, t)),
    all((f, t) => db.from('checkins').select('person_id, score, created_at').gte('created_at', new Date(Math.min(Date.parse(priorStart), now - 28 * 86_400_000)).toISOString()).order('created_at').range(f, t)),
    all((f, t) => db.from('care_ratings').select('rating, created_at').range(f, t)),
    all((f, t) => db.from('care_requests').select('person_id, status, created_at').eq('kind', 'practical').in('status', ['approved', 'closed']).gte('created_at', start).range(f, t)),
    all((f, t) => db.from('attendance').select('person_id, meeting_date').gte('meeting_date', addDays(today, -(days + 60))).range(f, t)),
  ])

  const inRange = (ts: string) => ts >= start
  const inPrior = (ts: string) => ts >= priorStart && ts < start
  const campusOf = new Map(people.map((p) => [p.id, p.campus_id]))

  // ── KPIs ──
  const touchesNow = touches.filter((t) => inRange(t.occurred_at))
  const touchesPrior = touches.filter((t) => inPrior(t.occurred_at))
  const casesNow = cases.filter((c) => inRange(c.opened_at))
  const casesPrior = cases.filter((c) => inPrior(c.opened_at))
  const ftNow = median(casesNow.map(hoursToFirstTouch).filter((x): x is number => x !== null))
  const ftPrior = median(casesPrior.map(hoursToFirstTouch).filter((x): x is number => x !== null))
  const rate72 = (cs: typeof cases) => {
    const eligible = cs.filter((c) => c.closed_at || now - Date.parse(c.opened_at) > H72)
    return eligible.length ? eligible.filter(closedIn72).length / eligible.length : null
  }
  const c72Now = rate72(casesNow)
  const c72Prior = rate72(casesPrior)
  const overdue = openTasks.filter((t) => t.due_on < today)
  const reached = new Set(touchesNow.map((t) => t.person_id)).size

  const kpis = {
    touches: touchesNow.length,
    touchesChange: touchesPrior.length ? (touchesNow.length - touchesPrior.length) / touchesPrior.length : null,
    reached,
    reachedShare: people.length ? reached / people.length : null,
    firstTouch: ftNow,
    firstTouchDelta: ftNow !== null && ftPrior !== null ? ftNow - ftPrior : null,
    closed72: c72Now,
    closed72Delta: c72Now !== null && c72Prior !== null ? c72Now - c72Prior : null,
    overdue: overdue.length,
    overdueThisWeek: overdue.filter((t) => t.due_on >= addDays(today, -7)).length,
  }

  // ── Monthly chart (last 6 months) ──
  const months: { key: string; label: string; flagged: number; met: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(new Date().getFullYear(), new Date().getMonth() - i, 1)
    months.push({ key: d.toISOString().slice(0, 7), label: d.toLocaleDateString('en-US', { month: 'short' }), flagged: 0, met: 0 })
  }
  for (const c of cases) {
    const m = months.find((x) => x.key === c.opened_at.slice(0, 7))
    if (!m) continue
    m.flagged++
    if (closedIn72(c)) m.met++
  }

  // ── Needs by type ──
  const needs = new Map<NeedType, number>(NEED_TYPES.map((n) => [n, 0]))
  for (const c of casesNow) {
    const n = needType(c)
    if (n) needs.set(n, needs.get(n)! + 1)
  }

  // ── Campus scorecard ──
  const optedIn = new Set(consents.filter((c) => c.weekly_checkin).map((c) => c.person_id))
  const recentCheckins = checkins.filter((c) => Date.parse(c.created_at) >= now - 28 * 86_400_000)
  const campusIds = ['indianapolis', 'detroit', 'atlanta', 'global']
  const scorecard = campusIds.map((id) => {
    const members = people.filter((p) => p.campus_id === id)
    const cs = casesNow.filter((c) => campusOf.get(c.person_id) === id)
    const scores = recentCheckins.filter((c) => campusOf.get(c.person_id) === id).map((c) => c.score)
    return {
      id,
      members: members.length,
      optedIn: members.length ? members.filter((m) => optedIn.has(m.id)).length / members.length : null,
      openNeeds: cases.filter((c) => c.status === 'open' && campusOf.get(c.person_id) === id).length,
      firstTouch: median(cs.map(hoursToFirstTouch).filter((x): x is number => x !== null)),
      closed72: rate72(cs),
      pulse: scores.length ? Math.round(((scores.reduce((a, b) => a + b, 0) / scores.length - 1) / 4) * 100) : null,
    }
  })

  // ── Channels ──
  const channels: Channel[] = ['text', 'call', 'visit', 'app', 'email']
  const channelRates = channels.map((ch) => {
    const ts = touchesNow.filter((t) => t.channel === ch)
    return { channel: ch, total: ts.length, rate: ts.length ? ts.filter((t) => t.outcome === 'reached').length / ts.length : null }
  })

  // ── Suggestions ──
  const worst = scorecard.filter((s) => s.firstTouch !== null).sort((a, b) => b.firstTouch! - a.firstTouch!)[0]
  let capacity: { headline: string; body: string } | null = null
  if (worst) {
    const campusTeams = teams.filter((t) => t.campus_id === worst.id).map((t) => t.id)
    const loads = campusTeams.map((id) => openTasks.filter((t) => t.assignee_team_id === id).length).sort((a, b) => b - a)
    const total = loads.reduce((a, b) => a + b, 0)
    const top2 = total ? (loads[0] ?? 0) + (loads[1] ?? 0) : 0
    const name = worst.id[0].toUpperCase() + worst.id.slice(1)
    const over = worst.firstTouch! > FIRST_TOUCH_GOAL_H
    capacity = {
      headline: over
        ? `${name} first touch is ${fmtHours(worst.firstTouch)}, against a ${FIRST_TOUCH_GOAL_H}-hour goal.`
        : `Every campus is under the ${FIRST_TOUCH_GOAL_H}-hour first-touch goal.`,
      body: over
        ? total
          ? `Two leaders carry ${Math.round((top2 / total) * 100)}% of ${name}'s open tasks. Adding trained leaders there would bring first touch down.`
          : `${name} has no care teams with open tasks. Assign leaders for ${name}.`
        : `Slowest is ${name} at ${fmtHours(worst.firstTouch)}. Keep an eye on leaders near their weekly limit.`,
    }
  }

  const bereaved = cases.filter((c) => c.moment_type === 'bereavement' && now - Date.parse(c.opened_at) > 90 * 86_400_000 && now - Date.parse(c.opened_at) < 455 * 86_400_000)
  const got90 = bereaved.filter((c) => {
    const lo = Date.parse(c.opened_at) + 75 * 86_400_000
    const hi = Date.parse(c.opened_at) + 120 * 86_400_000
    return touches.some((t) => t.person_id === c.person_id && Date.parse(t.occurred_at) >= lo && Date.parse(t.occurred_at) <= hi)
  }).length
  const followThrough = bereaved.length
    ? {
        headline: got90 / bereaved.length < 0.8 ? 'Grief follow-ups drop off after 30 days.' : 'Grief follow-ups are holding past 90 days.',
        body: `${got90} of ${bereaved.length} bereaved ${bereaved.length === 1 ? 'family' : 'families'} got a 90-day call. ${got90 / bereaved.length < 0.8 ? 'Make sure the Funerals ministry works its 90- and 365-day tasks.' : 'Keep the 365-day call on the calendar.'}`,
      }
    : { headline: 'No grief follow-ups to measure yet.', body: 'Once bereaved families pass 90 days, this shows how many got their 90-day call.' }

  const text = channelRates.find((c) => c.channel === 'text')!
  const email = channelRates.find((c) => c.channel === 'email')!
  const channel = text.rate !== null && email.rate !== null
    ? {
        headline: `Email gets ${pct(email.rate)} response; text gets ${pct(text.rate)}.`,
        body: text.rate >= email.rate ? 'Use text first for urgent care. Keep email for celebrations and updates.' : 'Email is out-performing text here; check text numbers are up to date.',
      }
    : { headline: 'Not enough outreach yet to compare channels.', body: 'Log touches with an outcome to see which channels reach people.' }

  // ── Outcomes ──
  const attByPerson = new Map<string, string[]>()
  for (const a of attendance) attByPerson.set(a.person_id, [...(attByPerson.get(a.person_id) ?? []), a.meeting_date])
  const lapsed = casesNow.filter((c) => needType(c) === 'Missed attendance' && c.first_touch_at)
  const returned = lapsed.filter((c) => {
    const from = c.first_touch_at!.slice(0, 10)
    const to = addDays(from, 60)
    return (attByPerson.get(c.person_id) ?? []).some((d) => d > from && d <= to)
  }).length

  const ciByPerson = new Map<string, { score: number; at: number }[]>()
  for (const c of checkins) ciByPerson.set(c.person_id, [...(ciByPerson.get(c.person_id) ?? []), { score: c.score, at: Date.parse(c.created_at) }])
  const lifts: number[] = []
  for (const t of touchesNow) {
    const list = ciByPerson.get(t.person_id)
    if (!list) continue
    const at = Date.parse(t.occurred_at)
    const before = list.filter((c) => c.at <= at).at(-1)
    const after = list.find((c) => c.at > at && c.at <= at + 14 * 86_400_000)
    if (before && after) lifts.push((after.score - before.score) * 25)
  }
  const ratingsNow = ratings.filter((r) => inRange(r.created_at))
  const outcomes = {
    lapsedBack: lapsed.length ? returned / lapsed.length : null,
    families: new Set(practical.map((p) => p.person_id)).size,
    lift: lifts.length ? lifts.reduce((a, b) => a + b, 0) / lifts.length : null,
    rating: ratingsNow.length ? ratingsNow.reduce((a, r) => a + r.rating, 0) / ratingsNow.length : null,
  }

  return { kpis, months, needs: [...needs.entries()], scorecard, channelRates, suggestions: { capacity, followThrough, channel }, outcomes, goalHours: FIRST_TOUCH_GOAL_H }
}

export function pct(x: number | null | undefined, digits = 0) {
  return x === null || x === undefined ? '—' : `${(x * 100).toFixed(digits)}%`
}

export function fmtHours(h: number | null | undefined) {
  if (h === null || h === undefined) return '—'
  return h >= 10 ? `${Math.round(h)}h` : `${h.toFixed(1)}h`
}
