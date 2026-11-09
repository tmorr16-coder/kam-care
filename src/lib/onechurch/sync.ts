import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import type { AppRole } from '@/lib/types'
import { addDays, daysBetween, todayISO } from '@/lib/dates'
import { env } from '@/lib/env'
import { isOneChurchConfigured, ocPaginate, ocRequest } from './client'
import type {
  OcAttendance, OcBirthday, OcConnection, OcContribution, OcFormEntry, OcGroupMembership, OcPerson, WebhookEvent,
} from './types'
import { WEBHOOK_EVENTS } from './types'

type OcGroup = { id: number; name: string; members?: number; active?: boolean; managedBy?: { id: number; name?: string | null } | null; category?: { name?: string | null } | null }
type OcGroupMember = { id: number; person: number }
import { onCareRequest, openCase, suggestTeam } from '@/lib/care/engine'

type Db = SupabaseClient<Database>

export function errorText(e: unknown) {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message)
  return String(e)
}

// ─── Mapping helpers ────────────────────────────────────────────────────────

// Stands in for "year not recorded" (a leap year, so Feb 29 stays valid).
export const UNKNOWN_YEAR = 1904
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

/** OneChurch dates arrive as month/day/year parts, an ISO date, or display text like "May 5" or "May 5, 1980". */
export function toDate(b: OcBirthday | undefined): string | null {
  if (!b) return null
  const ymd = (y: number | null | undefined, m: number, d: number) =>
    m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y && y > 1800 ? y : UNKNOWN_YEAR}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : null
  if (b.month && b.day) return ymd(b.year, b.month, b.day)
  const raw = b.date?.trim()
  if (!raw) return null
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10)
  const text = raw.match(/^([A-Za-z]{3,})\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?/)
  if (text) {
    const m = MONTHS.indexOf(text[1].slice(0, 3).toLowerCase()) + 1
    return m ? ymd(text[3] ? Number(text[3]) : null, m, Number(text[2])) : null
  }
  const us = raw.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/)
  if (us) return ymd(us[3] ? Number(us[3]) : null, Number(us[1]), Number(us[2]))
  return null
}

function familyId(p: OcPerson): number | null {
  if (typeof p.family === 'number') return p.family
  return p.family?.id ?? p.familyId ?? null
}

function normalizePhone(phone: string | null | undefined) {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return digits ? `+${digits}` : null
}

/** OneChurch location names that didn't match a campus during this run (shown on the OneChurch page). */
export const unmatchedLocations = new Map<number, string>()

let campusCache: { byId: Map<number, string>; campuses: { id: string; name: string }[] } | null = null

/**
 * Maps a OneChurch location to a KAM campus: by saved location id, otherwise by name
 * ("Detroit", "KAM Atlanta", "Online" → global), saving the id the first time it matches.
 */
async function campusFor(db: Db, location: { id?: number; name?: string | null } | null | undefined) {
  if (!location?.id) return null
  if (!campusCache) {
    const { data } = await db.from('campuses').select('id, name, oc_location_id')
    campusCache = {
      byId: new Map((data ?? []).filter((c) => c.oc_location_id).map((c) => [c.oc_location_id!, c.id])),
      campuses: (data ?? []).map((c) => ({ id: c.id, name: c.name })),
    }
  }
  const known = campusCache.byId.get(location.id)
  if (known) return known
  const name = (location.name ?? '').toLowerCase()
  const match =
    campusCache.campuses.find((c) => name.includes(c.name.toLowerCase())) ??
    (/(online|global|virtual|stream)/.test(name) ? campusCache.campuses.find((c) => c.id === 'global') : undefined)
  if (!match) {
    unmatchedLocations.set(location.id, location.name ?? `Location ${location.id}`)
    return null
  }
  campusCache.byId.set(location.id, match.id)
  await db.from('campuses').update({ oc_location_id: location.id }).eq('id', match.id).is('oc_location_id', null)
  return match.id
}

// ─── People ─────────────────────────────────────────────────────────────────

export async function upsertPerson(db: Db, p: OcPerson) {
  let householdId: string | null = null
  const fam = familyId(p)
  if (fam) {
    const famName = typeof p.family === 'object' && p.family?.name ? p.family.name : p.last ?? null
    const { data } = await db.from('households').upsert({ oc_family_id: fam, name: famName, synced_at: new Date().toISOString() }, { onConflict: 'oc_family_id' }).select('id').single()
    householdId = data?.id ?? null
  }
  // A person added by hand before OneChurch was connected (e.g. the first admin) is adopted
  // by their OneChurch record on first sync, matched by email, instead of being duplicated.
  if (p.email) {
    const { data: known } = await db.from('people').select('id').eq('oc_person_id', p.id).maybeSingle()
    if (!known) {
      const { data: manual } = await db.from('people').select('id').is('oc_person_id', null).ilike('email', p.email).limit(2)
      if (manual?.length === 1) await db.from('people').update({ oc_person_id: p.id }).eq('id', manual[0].id)
    }
  }
  const { data, error } = await db
    .from('people')
    .upsert(
      {
        oc_person_id: p.id,
        household_id: householdId,
        title: p.title || null,
        first_name: p.nickname || p.first || '(no name)',
        last_name: p.last || '',
        email: p.email?.toLowerCase() || null,
        phone: normalizePhone(p.phone),
        campus_id: await campusFor(db, p.location ?? p.campus),
        family_position: p.familyPosition?.name ?? null,
        birthday: toDate(p.birthday),
        anniversary: toDate(p.anniversary),
        is_guest: !!p.guest,
        archived: !!p.archived,
        deceased: !!p.deceased,
        synced_at: new Date().toISOString(),
      },
      { onConflict: 'oc_person_id' },
    )
    .select('id')
    .single()
  if (error) throw error
  // Everyone gets a consent row with safe defaults; members change it in the portal.
  await db.from('consents').upsert({ person_id: data.id }, { onConflict: 'person_id', ignoreDuplicates: true })
  return data.id
}

export async function syncPerson(db: Db, ocPersonId: number) {
  const p = await ocRequest<OcPerson>(`/people/${ocPersonId}`)
  const personId = await upsertPerson(db, p)
  await syncRolesForPerson(db, personId, ocPersonId)
  return personId
}

/**
 * Role comes from OneChurch group membership (see role_mappings). Removing someone from
 * the group in OneChurch drops them back to member on the next sync.
 */
export async function syncRolesForPerson(db: Db, personId: string, ocPersonId: number) {
  const [{ data: profiles }, { data: mappings }, { data: teams }] = await Promise.all([
    db.from('profiles').select('user_id, role, is_admin, role_source').eq('person_id', personId),
    db.from('role_mappings').select('*'),
    db.from('care_teams').select('id, oc_group_id').not('oc_group_id', 'is', null),
  ])
  const needed = (profiles?.length ?? 0) > 0 || (teams?.length ?? 0) > 0
  // No group → role mappings yet: leave roles alone rather than demote everyone to member.
  if (!needed || !mappings?.length) return

  const groups: OcGroupMembership[] = []
  for await (const g of ocPaginate<OcGroupMembership>(`/people/${ocPersonId}/groups`, { current: true })) groups.push(g)
  const groupIds = new Set(groups.map((g) => Number(g.group?.id)))

  const rank: Record<AppRole, number> = { member: 0, care_leader: 1, staff: 2, pastor: 3 }
  let role: AppRole = 'member'
  let admin = false
  for (const m of mappings) {
    if (!groupIds.has(m.oc_group_id)) continue
    if (rank[m.role] > rank[role]) role = m.role
    admin ||= m.grants_admin
  }
  for (const prof of profiles ?? []) {
    if (prof.role_source === 'manual') continue
    await db.from('profiles').update({ role, is_admin: admin, last_role_sync_at: new Date().toISOString() }).eq('user_id', prof.user_id)
  }

  // Care teams linked to a OneChurch group mirror its membership.
  for (const t of teams ?? []) {
    if (groupIds.has(t.oc_group_id!)) {
      await db.from('care_team_members').upsert({ team_id: t.id, person_id: personId }, { onConflict: 'team_id,person_id', ignoreDuplicates: true })
    } else {
      await db.from('care_team_members').delete().eq('team_id', t.id).eq('person_id', personId)
    }
  }
}

async function personIdFor(db: Db, ocPersonId: number | null | undefined) {
  if (!ocPersonId) return null
  const { data } = await db.from('people').select('id').eq('oc_person_id', ocPersonId).maybeSingle()
  if (data) return data.id
  return isOneChurchConfigured() ? syncPerson(db, ocPersonId) : null
}

// ─── Giving pattern (amounts are never stored) ──────────────────────────────

type GiftLite = { date: string; amount: number; recurring: boolean }

/** Turns a person's recent gifts into a pattern. The gift list is discarded after this. */
export function givingPattern(gifts: GiftLite[], today = todayISO()) {
  if (!gifts.length) return null
  gifts.sort((a, b) => a.date.localeCompare(b.date))
  const sum = (from: string, to: string) => gifts.filter((g) => g.date >= from && g.date < to).reduce((s, g) => s + g.amount, 0)
  const last90 = sum(addDays(today, -90), addDays(today, 1))
  const prior90 = sum(addDays(today, -180), addDays(today, -90))
  const lastGift = gifts.at(-1)!.date
  const firstGift = gifts[0].date
  const recurringDates = gifts.filter((g) => g.recurring).map((g) => g.date)
  const lastRecurring = recurringDates.at(-1)
  const hasRecurring = !!lastRecurring && daysBetween(lastRecurring, today) <= 45
  let trend: 'new' | 'steady' | 'up' | 'down' | 'lapsed' | 'quiet'
  if (daysBetween(firstGift, today) <= 30) trend = 'new'
  else if (daysBetween(lastGift, today) > 60 && prior90 > 0) trend = 'lapsed'
  else if (prior90 > 0 && last90 >= prior90 * 1.25) trend = 'up'
  else if (prior90 > 0 && last90 <= prior90 * 0.5) trend = 'down'
  else trend = 'steady'
  return {
    first_gift_on: firstGift,
    last_gift_on: lastGift,
    has_recurring: hasRecurring,
    recurring_stopped_on: !hasRecurring && lastRecurring ? lastRecurring : null,
    gifts_last_90d: gifts.filter((g) => g.date >= addDays(today, -90)).length,
    trend,
    years_giving: Math.max(0, Math.floor(daysBetween(firstGift, today) / 365)),
  }
}

async function applyGivingPattern(db: Db, personId: string, pattern: ReturnType<typeof givingPattern>) {
  const { data: consent } = await db.from('consents').select('use_giving').eq('person_id', personId).maybeSingle()
  if (!consent?.use_giving) {
    // No consent: keep nothing at all.
    await db.from('giving_patterns').delete().eq('person_id', personId)
    return
  }
  if (!pattern) return
  const { data: before } = await db.from('giving_patterns').select('*').eq('person_id', personId).maybeSingle()
  await db.from('giving_patterns').upsert({ person_id: personId, ...pattern, updated_at: new Date().toISOString() })

  const today = todayISO()
  const signal = async (kind: Database['public']['Enums']['signal_kind'], summary: string) =>
    db.from('signals').upsert({ person_id: personId, kind, summary, source: 'OneChurch giving pattern', pastors_only: true, dedupe_key: `${kind}:${personId}:${today.slice(0, 7)}` }, { onConflict: 'dedupe_key', ignoreDuplicates: true })

  if (!before && pattern.trend === 'new') await signal('giving_first', 'First-time gift')
  if (pattern.has_recurring && before && !before.has_recurring) await signal('giving_new_recurring', 'Started a recurring gift')
  if (pattern.trend === 'up' && before?.trend !== 'up') await signal('giving_increase', 'Giving up 25% or more')
  if (pattern.recurring_stopped_on && before?.has_recurring) {
    await signal('giving_lapse', `Recurring giving stopped${pattern.years_giving ? ` after ${pattern.years_giving} years` : ''}`)
    const { data: person } = await db.from('people').select('campus_id').eq('id', personId).single()
    const team = await suggestTeam(db, { campusId: person?.campus_id, tags: ['re-engagement'] })
    // A lapse prompts a care call, never a giving ask. Care teams see the task, not the reason.
    await openCase(db, {
      personId, whyFlagged: `Recurring giving stopped${pattern.years_giving ? ` after ${pattern.years_giving} years` : ''}.`,
      urgency: 'high', sensitive: true, sensitiveReason: 'Giving pattern', sensitiveVisibility: 'pastors',
      channels: ['call'], actionTitle: 'Call', actionDetail: 'Care call, never about giving. Listen for hardship; offer Total Restoration.',
      ownerTeamId: team?.id, dueOn: addDays(today, 1), dedupeKey: `giving_lapse:${personId}:${today.slice(0, 7)}`,
      tasks: [{ title: 'Care call', instructions: 'Never about giving. Listen for hardship.', task_type: 'call', team_id: team?.id, due_on: addDays(today, 1) }],
    })
  }
  if (pattern.trend === 'lapsed' && before?.trend !== 'lapsed' && (pattern.years_giving ?? 0) >= 3) await signal('giving_quiet', 'Long-time giver gone quiet')
}

const giftOf = (c: OcContribution): GiftLite | null =>
  c.date && typeof c.amount === 'number' && c.status?.code !== 'refunded' ? { date: c.date, amount: c.amount, recurring: !!c.schedule } : null

export async function recomputeGivingForPerson(db: Db, ocPersonId: number) {
  const personId = await personIdFor(db, ocPersonId)
  if (!personId) return
  const gifts: GiftLite[] = []
  for await (const c of ocPaginate<OcContribution>('/contributions', { person: ocPersonId, 'date.start': addDays(todayISO(), -400) })) {
    const g = giftOf(c)
    if (g) gifts.push(g)
  }
  await applyGivingPattern(db, personId, givingPattern(gifts))
  gifts.length = 0
}

// ─── Attendance ─────────────────────────────────────────────────────────────

type AttendanceRules = { sunday: string[]; bible_study: string[] }

async function attendanceRules(db: Db): Promise<AttendanceRules> {
  const { data } = await db.from('app_settings').select('value').eq('key', 'attendance_event_keywords').maybeSingle()
  return (data?.value as AttendanceRules) ?? { sunday: ['sunday', 'worship', '10 am', 'service'], bible_study: ['bible study', 'tuesday'] }
}

function classifyEvent(name: string, rules: AttendanceRules): 'sunday' | 'bible_study' | 'other' {
  const n = name.toLowerCase()
  if (rules.bible_study.some((k) => n.includes(k))) return 'bible_study'
  if (rules.sunday.some((k) => n.includes(k))) return 'sunday'
  return 'other'
}

export async function syncAttendanceForPerson(db: Db, personId: string, ocPersonId: number, sinceISO: string) {
  const rules = await attendanceRules(db)
  const rows: Database['public']['Tables']['attendance']['Insert'][] = []
  for await (const a of ocPaginate<OcAttendance>(`/people/${ocPersonId}/attendance`, { 'date.start': sinceISO })) {
    const date = a.meetingDate ?? a.date?.slice(0, 10)
    if (!date) continue
    const label = [a.event?.name, ...(a.categories ?? []).map((c) => c.name), ...(a.groups ?? []).map((g) => g.name)].filter(Boolean).join(' ')
    rows.push({ person_id: personId, kind: classifyEvent(label, rules), meeting_date: date, via: /livestream|online/i.test(label) ? 'livestream' : 'in_person', oc_attendance_id: a.id })
  }
  if (rows.length) await db.from('attendance').upsert(rows, { onConflict: 'person_id,kind,meeting_date', ignoreDuplicates: true })
  return rows.length
}

// ─── Forms, connections, registrations ──────────────────────────────────────

function formText(entry: OcFormEntry) {
  return (entry.responses ?? [])
    .map((r) => (typeof r.response === 'string' ? r.response : Array.isArray(r.response) ? r.response.filter((x) => typeof x === 'string').join(', ') : ''))
    .filter(Boolean)
    .join('\n')
    .slice(0, 2000)
}

export async function handleFormEntry(db: Db, formId: number, entryId: number) {
  const { data: setting } = await db.from('app_settings').select('value').eq('key', 'care_form_ids').maybeSingle()
  const careForms = (setting?.value as number[] | null) ?? []
  if (careForms.length && !careForms.includes(formId)) return 'Not a care form; ignored'
  const entry = await ocRequest<OcFormEntry>(`/forms/${formId}/entries/${entryId}`)
  const personId = await personIdFor(db, entry.person?.linkedTo || entry.person?.id || null)
  if (!personId) return 'Form entry has no linked person; sent to match review'
  const { data: req, error } = await db
    .from('care_requests')
    .insert({ person_id: personId, kind: 'prayer', body: formText(entry), visibility: 'pastors', source: 'onechurch_form', oc_form_entry_id: entry.id })
    .select('id')
    .single()
  if (error?.code === '23505') return 'Already received'
  if (error) throw error
  await onCareRequest(db, req.id)
  return 'Prayer form → care task'
}

export async function handleConnection(db: Db, connectionId: number) {
  const c = await ocRequest<OcConnection>(`/connections/${connectionId}`)
  const ocPerson = typeof c.person === 'number' ? c.person : c.person?.id
  const personId = await personIdFor(db, ocPerson)
  if (!personId) return 'No person on connection'
  const { data: person } = await db.from('people').select('campus_id, first_name').eq('id', personId).single()
  const team = await suggestTeam(db, { campusId: person?.campus_id, tags: ['new guests'] })
  const today = todayISO()
  await db.from('signals').insert({ person_id: personId, kind: 'guest_visit', summary: `New guest connection${c.type?.name ? `: ${c.type.name}` : ''}`, source: 'OneChurch connections' })
  await openCase(db, {
    personId, whyFlagged: `New guest${c.type?.name ? ` (${c.type.name})` : ''}.`, urgency: 'normal', channels: ['text'], actionTitle: 'Text',
    actionDetail: 'Welcome text; invite to Become a Member class; share Plan Your Visit.', ownerTeamId: team?.id, dueOn: addDays(today, 2),
    dedupeKey: `guest:${personId}`,
    tasks: [{ title: 'Welcome text', task_type: 'text', team_id: team?.id, due_on: addDays(today, 2) }],
  })
  return 'Guest follow-up started'
}

// ─── Webhooks ───────────────────────────────────────────────────────────────

/**
 * OneChurch doesn't sign webhook deliveries yet, so we never trust the payload's contents:
 * we take the record id from it and fetch the record from the API ourselves.
 */
function pickId(payload: unknown, ...keys: string[]): number | null {
  const seen = new Set<unknown>()
  const visit = (v: unknown, depth: number): number | null => {
    if (!v || typeof v !== 'object' || seen.has(v) || depth > 3) return null
    seen.add(v)
    const o = v as Record<string, unknown>
    for (const k of keys) {
      const x = o[k]
      if (typeof x === 'number' && x > 0) return x
      if (typeof x === 'string' && /^\d+$/.test(x)) return Number(x)
      if (x && typeof x === 'object') {
        const inner = (x as Record<string, unknown>).id
        if (typeof inner === 'number' && inner > 0) return inner
      }
    }
    for (const k of ['data', 'entity', 'record', 'object', 'payload']) {
      const r = visit(o[k], depth + 1)
      if (r) return r
    }
    return null
  }
  return visit(payload, 0)
}

export async function processWebhook(db: Db, event: WebhookEvent | string, payload: unknown): Promise<string> {
  switch (event) {
    case 'person_created':
    case 'person_updated': {
      const id = pickId(payload, 'person', 'personId', 'id')
      if (!id) throw new Error('No person id in payload')
      const personId = await syncPerson(db, id)
      const { data } = await db.from('people').select('first_name, last_name').eq('id', personId).single()
      return `${data?.last_name}, ${data?.first_name} · refreshed`
    }
    case 'group_member_added': {
      const id = pickId(payload, 'person', 'personId')
      if (!id) throw new Error('No person id in payload')
      const personId = await personIdFor(db, id)
      if (personId) await syncRolesForPerson(db, personId, id)
      return 'Connections and leader roles updated'
    }
    case 'contribution_created': {
      // Fetch the gift only to find the giver; then recompute their pattern from the API.
      const cid = pickId(payload, 'contribution', 'contributionId', 'id')
      let personOc = pickId(payload, 'person', 'personId')
      if (!personOc && cid) personOc = (await ocRequest<OcContribution>(`/contributions/${cid}`)).person?.id ?? null
      if (!personOc) return 'Anonymous or unmatched gift; nothing to update'
      await recomputeGivingForPerson(db, personOc)
      return 'Pattern updated; amount discarded'
    }
    case 'form_entry_submitted': {
      const form = pickId(payload, 'form', 'formId')
      const entry = pickId(payload, 'entry', 'entryId', 'id')
      if (!form || !entry) throw new Error('No form/entry id in payload')
      return handleFormEntry(db, form, entry)
    }
    case 'connection_created': {
      const id = pickId(payload, 'connection', 'connectionId', 'id')
      if (!id) throw new Error('No connection id in payload')
      return handleConnection(db, id)
    }
    case 'event_registration_created': {
      const personId = await personIdFor(db, pickId(payload, 'person', 'personId'))
      if (personId) await db.from('signals').insert({ person_id: personId, kind: 'engagement', summary: 'Registered for an event', source: 'OneChurch events' })
      return 'Counted as an engagement signal'
    }
    default:
      return 'Event not used by KAM Care'
  }
}

export async function registerWebhooks(db: Db) {
  const token = env.onechurchWebhookToken
  if (!token) throw new Error('Set ONECHURCH_WEBHOOK_TOKEN first')
  const base = `${env.siteUrl}/api/webhooks/onechurch/${token}`
  const { data: existing } = await db.from('oc_webhook_subscriptions').select('event, url')
  const results: string[] = []
  for (const event of WEBHOOK_EVENTS) {
    const url = `${base}/${event}`
    if (existing?.some((e) => e.event === event && e.url === url)) continue
    const res = await ocRequest<{ id: number }>('/webhooks/subscriptions', { method: 'POST', body: { url, event } })
    await db.from('oc_webhook_subscriptions').upsert({ oc_subscription_id: res.id, event, url }, { onConflict: 'event' })
    results.push(event)
  }
  return results
}

// ─── Write-back ─────────────────────────────────────────────────────────────

/** Logs a care touch to the person's OneChurch Notes. Sensitive matters never leave KAM Care. */
export async function writeTouchToOneChurch(db: Db, touchId: string) {
  if (!isOneChurchConfigured()) return
  const { data: setting } = await db.from('app_settings').select('value').eq('key', 'write_back_to_onechurch').maybeSingle()
  if (setting?.value !== true) return
  const { data: t } = await db
    .from('touches')
    .select('id, summary, channel, occurred_at, oc_note_id, case:care_cases(sensitive), task:tasks(sensitive), person:people!touches_person_id_fkey(oc_person_id)')
    .eq('id', touchId)
    .single()
  if (!t || t.oc_note_id) return
  const sensitive = (t.case as { sensitive: boolean } | null)?.sensitive || (t.task as { sensitive: boolean } | null)?.sensitive
  const ocPerson = (t.person as { oc_person_id: number | null } | null)?.oc_person_id
  if (sensitive || !ocPerson) return
  const note = await ocRequest<{ id: number }>('/notes', {
    method: 'POST',
    body: { link: 'people', entity: ocPerson, date: t.occurred_at.slice(0, 10), privacy: 'private', comments: `KAM Care · ${t.summary}` },
  })
  await db.from('touches').update({ oc_note_id: note.id, oc_written_at: new Date().toISOString() }).eq('id', t.id)
}

// ─── Nightly reconcile ──────────────────────────────────────────────────────

export async function reconcile(db: Db, log: (msg: string) => void = () => {}) {
  const stats = { people: 0, failed: 0, roles: 0, givers: 0, rateLimited: 0 }
  const onRateLimited = (s: number) => {
    stats.rateLimited++
    log(`Rate limited; resumed after Retry-After (${s} sec)`)
  }

  // 1. People and households
  for await (const p of ocPaginate<OcPerson>('/people', { archived: false }, 100, { onRateLimited })) {
    try {
      await upsertPerson(db, p)
      stats.people++
    } catch (e) {
      // One bad record shouldn't stop the whole sync.
      stats.failed++
      log(`Person ${p.id} skipped: ${errorText(e)}`)
    }
  }

  if (unmatchedLocations.size) {
    const value = [...unmatchedLocations].map(([id, name]) => ({ id, name }))
    await db.from('app_settings').upsert({ key: 'unmatched_locations', value, updated_at: new Date().toISOString() })
    log(`Unmatched OneChurch locations: ${value.map((v) => `${v.name} (${v.id})`).join(', ')}`)
  }

  // 2. Members of mapped groups and linked care teams get their role and team membership
  const { data: mapped } = await db.from('role_mappings').select('oc_group_id')
  const { data: linked } = await db.from('care_teams').select('oc_group_id').not('oc_group_id', 'is', null)
  for (const g of new Set([...(mapped ?? []), ...(linked ?? [])].map((r) => r.oc_group_id!))) {
    stats.roles += await syncMappedGroup(db, g)
  }

  // …and everyone who already has a role is re-checked, so leaving a group removes access
  const { data: leaders } = await db.from('profiles').select('person:people(id, oc_person_id)').neq('role', 'member')
  for (const l of leaders ?? []) {
    const p = l.person as { id: string; oc_person_id: number | null } | null
    if (p?.oc_person_id) {
      await syncRolesForPerson(db, p.id, p.oc_person_id)
      stats.roles++
    }
  }

  // 3. Giving patterns, from one pass over the last ~13 months of gifts. Amounts are dropped after.
  const byPerson = new Map<number, GiftLite[]>()
  for await (const c of ocPaginate<OcContribution>('/contributions', { 'date.start': addDays(todayISO(), -400) }, 100, { onRateLimited })) {
    const g = giftOf(c)
    if (!g || !c.person?.id || c.anonymous) continue
    if (!byPerson.has(c.person.id)) byPerson.set(c.person.id, [])
    byPerson.get(c.person.id)!.push(g)
  }
  for (const [oc, gifts] of byPerson) {
    const personId = await personIdFor(db, oc)
    if (personId) {
      await applyGivingPattern(db, personId, givingPattern(gifts))
      stats.givers++
    }
  }
  byPerson.clear()

  return stats
}

/**
 * Attendance needs one API call per person, so it runs in slices (every 30 minutes by cron)
 * with a cursor, instead of in the nightly reconcile. ~250 people per run stays well inside
 * both the rate limit and the function time limit.
 */
export async function syncAttendanceBatch(db: Db, batchSize = 250) {
  const { data: cur } = await db.from('app_settings').select('value').eq('key', 'attendance_cursor').maybeSingle()
  const offset = (cur?.value as number | null) ?? 0
  const { data: rows } = await db
    .from('consents')
    .select('person:people!inner(id, oc_person_id, archived)')
    .eq('use_attendance', true)
    .eq('person.archived', false)
    .not('person.oc_person_id', 'is', null)
    .order('person_id')
    .range(offset, offset + batchSize - 1)
  const since = addDays(todayISO(), -9)
  let records = 0
  for (const r of rows ?? []) {
    const p = r.person as unknown as { id: string; oc_person_id: number }
    records += await syncAttendanceForPerson(db, p.id, p.oc_person_id, since)
  }
  const next = (rows?.length ?? 0) < batchSize ? 0 : offset + batchSize
  await db.from('app_settings').upsert({ key: 'attendance_cursor', value: next, updated_at: new Date().toISOString() })
  return { people: rows?.length ?? 0, records, nextOffset: next }
}

// ─── Groups ─────────────────────────────────────────────────────────────────

/** Name search over OneChurch groups, for picking which groups grant KAM Care roles. */
export async function searchGroups(name: string) {
  const page = await ocRequest<{ data: OcGroup[] }>('/groups', { query: { name, active: true, limit: 25, 'sort.property': 'name' } })
  return (page.data ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    members: g.members ?? null,
    campus: g.managedBy?.name ?? null,
    category: g.category?.name ?? null,
  }))
}

/**
 * Pulls a mapped group's current members and applies their role and care-team membership now,
 * instead of waiting for each person's next sign-in or the nightly sync.
 */
export async function syncMappedGroup(db: Db, ocGroupId: number) {
  let people = 0
  for await (const m of ocPaginate<OcGroupMember>(`/groups/${ocGroupId}/members`, { current: true })) {
    const personId = await personIdFor(db, m.person)
    if (!personId) continue
    await syncRolesForPerson(db, personId, m.person)
    people++
  }
  return people
}
