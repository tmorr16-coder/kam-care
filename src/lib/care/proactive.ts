import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { addDays, todayISO } from '@/lib/dates'
import { addTasks, onLifeMoment, openCase, resolveTeam, setting } from './engine'

/**
 * Proactive care: life events and drift KAM Care notices without the member telling us.
 * Every result is a gentle task for a person to act on; nothing goes to the member directly.
 */

type Db = SupabaseClient<Database>

// ─── Slow fades ─────────────────────────────────────────────────────────────

/**
 * Someone who came most Sundays and now comes only now and then. Missed-attendance catches a
 * hard stop; this catches the slide before it (still attending, but far less).
 */
export async function detectAttendanceFade(db: Db) {
  const today = todayISO()
  const recentFrom = addDays(today, -56) // last 8 weeks
  const priorFrom = addDays(today, -168) // the 16 weeks before that
  const { data: consented } = await db.from('consents').select('person_id').eq('use_attendance', true)
  const allowed = new Set((consented ?? []).map((c) => c.person_id))
  const { data: rows } = await db.from('attendance').select('person_id, meeting_date').eq('kind', 'sunday').gte('meeting_date', priorFrom)
  const counts = new Map<string, { recent: number; prior: number }>()
  for (const r of rows ?? []) {
    const c = counts.get(r.person_id) ?? { recent: 0, prior: 0 }
    if (r.meeting_date >= recentFrom) c.recent++
    else c.prior++
    counts.set(r.person_id, c)
  }
  let flagged = 0
  for (const [personId, c] of counts) {
    if (!allowed.has(personId)) continue
    const priorRate = c.prior / 16
    const recentRate = c.recent / 8
    // Came at least 10 of 16 Sundays, now at most half as often, but not stopped (0 is missed-attendance's job).
    if (priorRate < 0.6 || c.recent === 0 || recentRate > priorRate / 2) continue
    const { data: person } = await db.from('people').select('campus_id').eq('id', personId).single()
    const team = await resolveTeam(db, personId, person?.campus_id ?? null, null, ['re-engagement'])
    const month = today.slice(0, 7)
    await db.from('signals').upsert({
      person_id: personId, kind: 'attendance_fade', source: 'OneChurch attendance', severity: 'normal',
      summary: `Sundays down from ${c.prior} of 16 to ${c.recent} of the last 8`, dedupe_key: `fade:${personId}:${month}`,
    }, { onConflict: 'dedupe_key', ignoreDuplicates: true })
    const res = await openCase(db, {
      personId,
      whyFlagged: `Coming less often: ${c.prior} of 16 Sundays before, ${c.recent} of the last 8.`,
      urgency: 'normal',
      channels: ['call'], actionTitle: 'Call', actionDetail: 'A friendly check-in. No ask, and no mention of attendance.',
      ownerTeamId: team, dueOn: addDays(today, 2), dedupeKey: `fade:${personId}:${month}`,
      tasks: [{ title: 'Friendly check-in call', instructions: 'Just checking in on them and the family. Don\'t mention attendance.', task_type: 'call', team_id: team, due_on: addDays(today, 2) }],
    })
    if (res.created) flagged++
  }
  return flagged
}

// ─── Lost contact ───────────────────────────────────────────────────────────

/** Two or more texts or emails failed in 30 days and none got through: their details may be out of date. */
export async function detectLostContact(db: Db) {
  const today = todayISO()
  const since = addDays(today, -30) + 'T00:00:00'
  const { data } = await db.from('touches').select('person_id, delivery_status').in('channel', ['text', 'email']).gte('occurred_at', since).in('delivery_status', ['sent', 'failed'])
  const byPerson = new Map<string, { failed: number; sent: number }>()
  for (const t of data ?? []) {
    const c = byPerson.get(t.person_id) ?? { failed: 0, sent: 0 }
    if (t.delivery_status === 'failed') c.failed++
    else c.sent++
    byPerson.set(t.person_id, c)
  }
  let flagged = 0
  for (const [personId, c] of byPerson) {
    if (c.failed < 2 || c.sent > 0) continue
    const month = today.slice(0, 7)
    await db.from('signals').upsert({
      person_id: personId, kind: 'contact_lost', source: 'KAM Care messages', severity: 'normal',
      summary: `${c.failed} texts or emails failed in 30 days`, dedupe_key: `contact:${personId}:${month}`,
    }, { onConflict: 'dedupe_key', ignoreDuplicates: true })
    const { data: person } = await db.from('people').select('campus_id').eq('id', personId).single()
    const team = await resolveTeam(db, personId, person?.campus_id ?? null)
    const res = await openCase(db, {
      personId,
      whyFlagged: `Messages aren't getting through (${c.failed} failed in 30 days). Their phone or email may have changed.`,
      urgency: 'normal',
      channels: ['call', 'visit'], actionTitle: 'Reach another way',
      actionDetail: 'Try a call, a family member, or say hello on Sunday. Ask Member Services to update OneChurch.',
      ownerTeamId: team, dueOn: addDays(today, 3), dedupeKey: `contact:${personId}:${month}`,
      tasks: [{ title: 'Reach them another way', instructions: 'Texts or emails are failing. Try calling, a family member, or catch them on Sunday, then update their details in OneChurch.', task_type: 'call', team_id: team, due_on: addDays(today, 3) }],
    })
    if (res.created) flagged++
  }
  return flagged
}

// ─── Grief ──────────────────────────────────────────────────────────────────

/** Fourth Thursday of November. */
function thanksgiving(year: number) {
  const d = new Date(Date.UTC(year, 10, 1))
  const firstThu = 1 + ((4 - d.getUTCDay() + 7) % 7)
  return `${year}-11-${String(firstThu + 21).padStart(2, '0')}`
}

/**
 * The bereavement playbook already follows up at 30, 90 and 365 days. This adds 6 months and the
 * first Thanksgiving and Christmas, which are when grieving families most often feel forgotten.
 */
export async function addGriefFollowUps(db: Db, caseId: string, personId: string, lossDate: string) {
  const today = todayISO()
  const { data: person } = await db.from('people').select('campus_id').eq('id', personId).single()
  const team = await resolveTeam(db, personId, person?.campus_id ?? null)
  const year = Number(lossDate.slice(0, 4))
  const firstYearEnd = addDays(lossDate, 365)
  const holidays = [year, year + 1].flatMap((y) => [
    { name: 'Thanksgiving', date: thanksgiving(y) },
    { name: 'Christmas', date: `${y}-12-25` },
  ])
  const tasks = [
    { title: 'Grief follow-up · 6 months', due_on: addDays(lossDate, 182), instructions: 'Six months on. Call to see how they are really doing.' },
    ...holidays
      // The first of each holiday within the year, at least two weeks after the loss.
      .filter((h, i, all) => h.date > addDays(lossDate, 14) && h.date <= firstYearEnd && all.findIndex((x) => x.name === h.name && x.date > addDays(lossDate, 14)) === i)
      .map((h) => ({ title: `First ${h.name} since the loss`, due_on: addDays(h.date, -5), instructions: `Their first ${h.name} without their loved one. Call or send a card this week.` })),
  ].filter((t) => t.due_on >= today)
  if (tasks.length) await addTasks(db, caseId, personId, tasks.map((t) => ({ ...t, task_type: 'call', team_id: team })), true)
}

// ─── Household changes (from OneChurch) ─────────────────────────────────────

let baseline: boolean | null = null
/**
 * Household changes only mean something after the first full import; otherwise every person
 * would look "new". True once any reconcile has finished successfully.
 */
async function baselineReady(db: Db) {
  if (baseline) return true
  const { count } = await db.from('sync_runs').select('id', { count: 'exact', head: true }).eq('kind', 'reconcile').eq('ok', true)
  baseline = (count ?? 0) > 0
  return baseline
}

export type PersonBefore = { id: string; household_id: string | null; deceased: boolean } | null

/** Adults still in a household, heads and spouses first, to receive care for that household. */
async function householdAdults(db: Db, householdId: string, exclude: string) {
  const { data } = await db.from('people').select('id, family_position, last_name').eq('household_id', householdId).eq('archived', false).eq('deceased', false).neq('id', exclude)
  const rank = (pos: string | null) => (pos === 'Head' ? 0 : pos === 'Spouse' ? 1 : pos === 'Child' ? 3 : 2)
  return (data ?? []).filter((p) => p.family_position !== 'Child').sort((a, b) => rank(a.family_position) - rank(b.family_position))
}

/**
 * Called after each OneChurch person sync with their record before and after.
 *   - marked deceased → bereavement care (with grief follow-ups) for the household
 *   - new baby in an existing household → new-baby playbook for the parents
 *   - someone joins or leaves a household → a gentle check-in
 */
export async function onPersonSynced(
  db: Db,
  before: PersonBefore,
  after: { id: string; household_id: string | null; deceased: boolean; first_name: string; last_name: string; family_position: string | null; birthday: string | null },
) {
  if (!(await baselineReady(db))) return
  const today = todayISO()

  // Passed away
  if (before && !before.deceased && after.deceased && after.household_id) {
    const [survivor] = await householdAdults(db, after.household_id, after.id)
    if (!survivor) return
    const { data: m } = await db.from('life_moments').insert({
      person_id: survivor.id, type: 'bereavement', moment_date: today, who: `${after.first_name} ${after.last_name}`,
      note: 'Marked as passed away in OneChurch.', source: 'onechurch_profile',
    }).select('id').single()
    if (m) await onLifeMoment(db, m.id)
    return
  }

  // New person in an existing household
  if (!before && after.household_id) {
    const adults = await householdAdults(db, after.household_id, after.id)
    if (!adults.length) return // a brand-new household, not a change
    const lead = adults[0]
    const born = after.birthday && !after.birthday.startsWith('1904') ? after.birthday : null
    if (after.family_position === 'Child' && born && born >= addDays(today, -120)) {
      const { data: m } = await db.from('life_moments').insert({
        person_id: lead.id, type: 'birth', moment_date: born, who: after.first_name,
        note: `${after.first_name} added to the household in OneChurch.`, source: 'onechurch_profile',
      }).select('id').single()
      if (m) await onLifeMoment(db, m.id)
      return
    }
    await householdSignal(db, lead.id, `${after.first_name} ${after.last_name} joined the ${lead.last_name} household in OneChurch`,
      `${after.first_name} was added to their household in OneChurch. It may be a marriage, a relative moving in, or a blended family.`,
      `hh:join:${after.id}`)
    return
  }

  // Moved between households
  if (before && before.household_id && after.household_id && before.household_id !== after.household_id) {
    await householdSignal(db, after.id, `Moved to a different household in OneChurch`,
      'Their household changed in OneChurch. It can mean a marriage, moving out, or a separation. Check in gently and let them share.',
      `hh:move:${after.id}:${today.slice(0, 7)}`, true)
  }
}

async function householdSignal(db: Db, personId: string, summary: string, why: string, key: string, sensitive = false) {
  const today = todayISO()
  await db.from('signals').upsert({
    person_id: personId, kind: 'household_change', summary, source: 'OneChurch profile', severity: 'normal',
    pastors_only: sensitive, dedupe_key: key,
  }, { onConflict: 'dedupe_key', ignoreDuplicates: true })
  const { data: person } = await db.from('people').select('campus_id').eq('id', personId).single()
  const team = await resolveTeam(db, personId, person?.campus_id ?? null)
  await openCase(db, {
    personId, whyFlagged: why, urgency: 'normal',
    sensitive, sensitiveReason: sensitive ? 'Family conflict' : null, sensitiveVisibility: 'pastors_and_staff',
    channels: ['call'], actionTitle: 'Call', actionDetail: 'A warm check-in. Don\'t ask about the change; let them bring it up.',
    confidence: 'low', ownerTeamId: team, dueOn: addDays(today, 3), dedupeKey: key,
    tasks: [{ title: 'Warm check-in call', instructions: 'Something changed in their household. Check in on them; let them share what they want to.', task_type: 'call', team_id: team, due_on: addDays(today, 3) }],
  })
}

// ─── Daily run ──────────────────────────────────────────────────────────────

export async function runProactive(db: Db) {
  const enabled = await setting(db, 'proactive_care_enabled', true)
  if (!enabled) return { skipped: true }
  return {
    attendanceFade: await detectAttendanceFade(db),
    lostContact: await detectLostContact(db),
  }
}
