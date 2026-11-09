import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import type { Channel, MomentType, PlaybookStep, Urgency } from '@/lib/types'
import { addDays, daysBetween, dueLabel, nextAnniversary, todayISO } from '@/lib/dates'
import { env } from '@/lib/env'
import { fillTemplate, sendSms } from '@/lib/messaging'
import { addGriefFollowUps, runProactive } from './proactive'

/**
 * The care engine turns signals into care cases and follow-up tasks.
 * It runs on the server with the service-role client, and is called from:
 *   - member portal actions (check-in, prayer request, practical help, life moment)
 *   - OneChurch webhooks (forms, connections, contributions)
 *   - the daily cron (attendance, milestones, shut-in visits, care scores, escalation)
 */

type Db = SupabaseClient<Database>

const URGENCY_RANK: Record<Urgency, number> = { urgent: 3, high: 2, normal: 1 }

// Words in a check-in note that change how we respond.
const SAFETY_WORDS = /\b(suicid\w*|kill myself|end it all|hurt myself|self[- ]harm|abus\w*|unsafe at home|hits me|violent)\b/i
const SENSITIVE_RULES: { re: RegExp; reason: string; moment?: MomentType }[] = [
  { re: /\b(lost my job|laid off|fired|unemploy\w*|job loss|rent|evict\w*|bills|money|financ\w*)\b/i, reason: 'Employment and finances', moment: 'job_loss' },
  { re: /\b(hospital\w*|surgery|cancer|diagnos\w*|sick|illness|chemo|stroke)\b/i, reason: 'Health', moment: 'sickness' },
  { re: /\b(passed away|passed|funeral|died|death|loss of)\b/i, reason: 'Bereavement', moment: 'bereavement' },
  { re: /\b(divorce|separat\w*|marriage|custody)\b/i, reason: 'Family conflict' },
  { re: /\b(drinking|drugs|relapse|addict\w*|sober)\b/i, reason: 'Addiction' },
  { re: /\b(court|arrest\w*|jail|lawyer|legal)\b/i, reason: 'Legal' },
]

export function classifyNote(note: string | null | undefined) {
  if (!note) return { safety: false as const }
  if (SAFETY_WORDS.test(note)) return { safety: true as const, reason: 'Safety concern' }
  const rule = SENSITIVE_RULES.find((r) => r.re.test(note))
  return { safety: false as const, reason: rule?.reason, moment: rule?.moment }
}

// ─── Teams ──────────────────────────────────────────────────────────────────

export async function teamBySlug(db: Db, slug: string) {
  const { data } = await db.from('care_teams').select('id').eq('slug', slug).maybeSingle()
  return data?.id ?? null
}

/** Open task counts per team, for capacity. */
export async function teamLoads(db: Db) {
  const { data } = await db.from('tasks').select('assignee_team_id').in('status', ['scheduled', 'due'])
  const loads = new Map<string, number>()
  for (const t of data ?? []) if (t.assignee_team_id) loads.set(t.assignee_team_id, (loads.get(t.assignee_team_id) ?? 0) + 1)
  return loads
}

/** Best-fit team by campus, gifts and room under their weekly limit. */
export async function suggestTeam(db: Db, opts: { campusId?: string | null; tags?: string[]; exclude?: string[] }) {
  const { data: teams } = await db.from('care_teams').select('id, name, campus_id, gifted_for, weekly_capacity, slug').eq('active', true)
  if (!teams?.length) return null
  const loads = await teamLoads(db)
  const tags = (opts.tags ?? []).map((t) => t.toLowerCase())
  let best: { id: string; name: string; score: number; load: number } | null = null
  for (const t of teams) {
    if (opts.exclude?.includes(t.id) || t.slug === 'pastoral-office' || t.slug === 'counseling-services') continue
    const load = loads.get(t.id) ?? 0
    let score = 0
    if (opts.campusId && t.campus_id === opts.campusId) score += 3
    else if (!t.campus_id) score += 1
    else if (opts.campusId) score -= 4
    const gifts = t.gifted_for.map((g) => g.toLowerCase())
    for (const tag of tags) if (gifts.some((g) => g.includes(tag) || tag.includes(g))) score += 2
    score += load < t.weekly_capacity ? 2 : -5
    if (!best || score > best.score || (score === best.score && load < best.load)) best = { id: t.id, name: t.name, score, load }
  }
  return best
}

async function primaryTeam(db: Db, personId: string) {
  const { data } = await db.from('person_care').select('primary_team_id').eq('person_id', personId).maybeSingle()
  return data?.primary_team_id ?? null
}

export async function resolveTeam(db: Db, personId: string, campusId: string | null, slug?: string | null, tags: string[] = []) {
  if (slug) {
    const id = await teamBySlug(db, slug)
    if (id) return id
  }
  return (await primaryTeam(db, personId)) ?? (await suggestTeam(db, { campusId, tags }))?.id ?? (await teamBySlug(db, 'pastoral-office'))
}

// ─── Notifications ──────────────────────────────────────────────────────────

/** The leader gets a text with the task, never the member's file. */
export async function notifyTaskAssigned(db: Db, taskId: string) {
  const { data: task } = await db
    .from('tasks')
    .select('id, title, due_on, assignee_team_id, notified_at, person:people!tasks_person_id_fkey(first_name)')
    .eq('id', taskId)
    .single()
  if (!task?.assignee_team_id || task.notified_at) return
  const { data: team } = await db.from('care_teams').select('kind, person_id').eq('id', task.assignee_team_id).single()
  const personIds: string[] = []
  if (team?.person_id) personIds.push(team.person_id)
  const { data: members } = await db.from('care_team_members').select('person_id').eq('team_id', task.assignee_team_id)
  for (const m of members ?? []) if (m.person_id) personIds.push(m.person_id)
  if (!personIds.length) return
  const { data: leaders } = await db.from('people').select('phone').in('id', personIds)
  const first = (task.person as { first_name: string } | null)?.first_name ?? 'a member'
  const body = `KAM Care: ${task.title} for ${first}, due ${dueLabel(task.due_on).toLowerCase()}. Open your tasks: ${env.siteUrl}/leader`
  await Promise.all((leaders ?? []).map((l) => sendSms(l.phone, body)))
  await db.from('tasks').update({ notified_at: new Date().toISOString() }).eq('id', taskId)
}

// ─── Cases ──────────────────────────────────────────────────────────────────

export type TaskInput = {
  title: string
  subtitle?: string | null
  instructions?: string | null
  task_type?: string
  team_id?: string | null
  due_on: string
  sensitive?: boolean
  escalation_level?: number
}

export type CaseInput = {
  personId: string
  householdLabel?: string | null
  whyFlagged: string
  urgency: Urgency
  sensitive?: boolean
  sensitiveReason?: string | null
  sensitiveVisibility?: 'pastors' | 'pastors_and_staff'
  channels: Channel[]
  actionTitle: string
  actionDetail?: string | null
  suggestedMessage?: string | null
  confidence?: 'high' | 'medium' | 'low'
  ownerTeamId?: string | null
  dueOn: string
  momentType?: MomentType | null
  dedupeKey?: string
  flaggedBy?: string | null
  tasks?: TaskInput[]
}

/**
 * Opens a care case, or returns the person's existing open case with the same dedupe key.
 * A repeat signal can raise urgency but never lowers it.
 */
export async function openCase(db: Db, input: CaseInput) {
  if (input.dedupeKey) {
    const { data: existing } = await db.from('care_cases').select('id, urgency, status').eq('dedupe_key', input.dedupeKey).maybeSingle()
    if (existing) {
      if (existing.status === 'open' && URGENCY_RANK[input.urgency] > URGENCY_RANK[existing.urgency]) {
        await db.from('care_cases').update({ urgency: input.urgency, why_flagged: input.whyFlagged, due_on: input.dueOn }).eq('id', existing.id)
      }
      return { id: existing.id, created: false }
    }
  }

  const { data: created, error } = await db
    .from('care_cases')
    .insert({
      person_id: input.personId,
      household_label: input.householdLabel ?? null,
      why_flagged: input.whyFlagged,
      urgency: input.urgency,
      sensitive: input.sensitive ?? false,
      sensitive_reason: input.sensitive ? input.sensitiveReason ?? null : null,
      sensitive_visibility: input.sensitive ? input.sensitiveVisibility ?? 'pastors' : null,
      action_channels: input.channels,
      action_title: input.actionTitle,
      action_detail: input.actionDetail ?? null,
      suggested_message: input.suggestedMessage ?? null,
      confidence: input.confidence ?? 'medium',
      owner_team_id: input.ownerTeamId ?? null,
      due_on: input.dueOn,
      moment_type: input.momentType ?? null,
      dedupe_key: input.dedupeKey ?? null,
      flagged_by: input.flaggedBy ?? null,
    })
    .select('id')
    .single()
  if (error) {
    // Another request created the same case a moment ago.
    if (error.code === '23505' && input.dedupeKey) {
      const { data } = await db.from('care_cases').select('id').eq('dedupe_key', input.dedupeKey).single()
      return { id: data!.id, created: false }
    }
    throw error
  }

  if (input.tasks?.length) await addTasks(db, created.id, input.personId, input.tasks, input.sensitive ?? false)
  await db.from('signals').insert({
    person_id: input.personId,
    kind: 'flagged',
    summary: `Flagged: ${input.urgency === 'urgent' ? 'urgent care need' : input.actionTitle.toLowerCase()}`,
    source: input.flaggedBy ? 'Flagged by a leader' : 'Care engine',
    severity: input.urgency,
    pastors_only: input.sensitiveVisibility === 'pastors' && !!input.sensitive,
  })
  return { id: created.id, created: true }
}

export async function addTasks(db: Db, caseId: string | null, personId: string, tasks: TaskInput[], sensitive = false, createdBy?: string) {
  const today = todayISO()
  const { data, error } = await db
    .from('tasks')
    .insert(
      tasks.map((t) => ({
        case_id: caseId,
        person_id: personId,
        title: t.title,
        subtitle: t.subtitle ?? null,
        instructions: t.instructions ?? null,
        task_type: t.task_type ?? 'call',
        assignee_team_id: t.team_id ?? null,
        due_on: t.due_on,
        status: (t.due_on <= today ? 'due' : 'scheduled') as 'due' | 'scheduled',
        sensitive: t.sensitive ?? sensitive,
        escalation_level: t.escalation_level ?? 1,
        created_by: createdBy ?? null,
      })),
    )
    .select('id, due_on, assignee_team_id')
  if (error) throw error
  // Text leaders about anything due in the next two days; later tasks notify when they come due.
  const soon = addDays(today, 2)
  await Promise.all((data ?? []).filter((t) => t.assignee_team_id && t.due_on <= soon).map((t) => notifyTaskAssigned(db, t.id)))
  return data ?? []
}

// ─── Playbooks ──────────────────────────────────────────────────────────────

export async function runPlaybook(
  db: Db,
  opts: { personId: string; moment: MomentType; momentDate: string; why: string; dedupeKey: string; householdLabel?: string | null; flaggedBy?: string | null },
) {
  const { data: pb } = await db.from('playbooks').select('*').eq('moment_type', opts.moment).maybeSingle()
  if (!pb) return null
  const { data: person } = await db.from('people').select('campus_id').eq('id', opts.personId).single()
  const today = todayISO()
  const steps = (pb.steps as PlaybookStep[]) ?? []
  const tasks: TaskInput[] = []
  for (const s of steps) {
    tasks.push({
      title: s.title,
      task_type: s.task_type,
      team_id: await resolveTeam(db, opts.personId, person?.campus_id ?? null, s.team_slug, [opts.moment]),
      // Steps anchored to the moment never land in the past; they start today at the earliest.
      due_on: [addDays(opts.momentDate, s.offset_days), today].sort().at(-1)!,
    })
  }
  return openCase(db, {
    personId: opts.personId,
    householdLabel: opts.householdLabel,
    whyFlagged: opts.why,
    urgency: pb.urgency,
    sensitive: pb.sensitive,
    sensitiveReason: pb.sensitive ? pb.label : null,
    sensitiveVisibility: 'pastors_and_staff',
    channels: pb.action_channels,
    actionTitle: pb.action_title,
    actionDetail: pb.summary,
    confidence: 'high',
    ownerTeamId: tasks[0]?.team_id ?? null,
    dueOn: tasks[0]?.due_on ?? today,
    momentType: opts.moment,
    dedupeKey: opts.dedupeKey,
    flaggedBy: opts.flaggedBy,
    tasks,
  })
}

// ─── Member portal triggers ─────────────────────────────────────────────────

async function suggestedText(db: Db, personId: string, teamId: string | null) {
  const [{ data: person }, { data: tpl }, { data: team }] = await Promise.all([
    db.from('people').select('first_name').eq('id', personId).single(),
    db.from('message_templates').select('body').eq('name', 'Gentle check-in').maybeSingle(),
    teamId ? db.from('care_teams').select('name, person:people!care_teams_person_id_fkey(title, last_name)').eq('id', teamId).maybeSingle() : Promise.resolve({ data: null }),
  ])
  const leader = team?.person as { title: string | null; last_name: string } | null
  const sender = leader ? `${leader.title === 'Dcn.' ? 'Deacon' : leader.title ?? ''} ${leader.last_name}`.trim() : 'your KAM care team'
  return fillTemplate(tpl?.body ?? 'Hi {first_name}, thinking of you this week.', { first_name: person?.first_name, sender })
}

export async function onCheckin(db: Db, checkinId: string) {
  const { data: c } = await db.from('checkins').select('*').eq('id', checkinId).single()
  if (!c) return
  const { data: prev } = await db
    .from('checkins')
    .select('score')
    .eq('person_id', c.person_id)
    .lt('created_at', c.created_at)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const labels = ['', 'Very hard', 'Hard', 'Okay', 'Good', 'Great']
  const drop = prev ? prev.score - c.score : 0
  const cls = classifyNote(c.note)
  const quoted = c.note ? ` "${c.note.slice(0, 120)}"` : ''

  await db.from('signals').insert({
    person_id: c.person_id,
    kind: drop >= 2 ? 'checkin_drop' : 'checkin_low',
    summary: `Weekly check-in: ${labels[c.score]}.${quoted}`,
    source: c.source === 'text' ? 'Text reply check-in' : 'Member portal check-in',
    severity: c.score <= 1 ? 'urgent' : c.score <= 2 ? 'high' : 'normal',
  })

  const today = todayISO()
  const { data: person } = await db.from('people').select('campus_id').eq('id', c.person_id).single()

  if (cls.safety) {
    // A safety concern goes straight to step 4 (senior pastor).
    const office = await teamBySlug(db, 'pastoral-office')
    await openCase(db, {
      personId: c.person_id,
      whyFlagged: `Safety concern in weekly check-in.${quoted}`,
      urgency: 'urgent',
      sensitive: true,
      sensitiveReason: 'Safety concern',
      sensitiveVisibility: 'pastors',
      channels: ['call'],
      actionTitle: 'Call now',
      actionDetail: 'Pastor calls today. If there is immediate danger, call 911 or the 988 Suicide & Crisis Lifeline.',
      confidence: 'high',
      ownerTeamId: office,
      dueOn: today,
      dedupeKey: `safety:${c.id}`,
      tasks: [{ title: 'Pastor call · safety concern', task_type: 'call', team_id: office, due_on: today, escalation_level: 4 }],
    })
    await db.from('signals').insert({ person_id: c.person_id, kind: 'safety', summary: 'Safety concern raised', source: 'Care engine', severity: 'urgent', pastors_only: true })
    return
  }

  const needsCare = c.score <= 2 || drop >= 2 || c.wants_contact
  if (!needsCare) return

  const urgency: Urgency = c.score <= 1 || (drop >= 3 && c.score <= 2) ? 'urgent' : c.score <= 2 ? 'high' : 'normal'
  const team = await resolveTeam(db, c.person_id, person?.campus_id ?? null, null, cls.reason === 'Employment and finances' ? ['employment', 'men'] : [])
  const why = prev && drop >= 2
    ? `Weekly check-in dropped from ${labels[prev.score]} to ${labels[c.score]}${cls.reason === 'Employment and finances' ? '; mentioned job loss' : ''}.`
    : c.wants_contact && c.score > 2
      ? `Asked for someone from their care team to reach out (check-in: ${labels[c.score]}).`
      : `Weekly check-in: ${labels[c.score]}.${quoted}`

  const tasks: TaskInput[] = [{ title: 'Pastoral text and call', subtitle: 'Check in; offer prayer', task_type: 'call', team_id: team, due_on: today,
    instructions: cls.reason === 'Employment and finances' ? 'Check in on them and the family. Offer prayer. No questions about finances.' : 'Check in. Offer prayer. Listen first.' }]
  if (cls.reason === 'Employment and finances') {
    tasks.push({ title: 'Benevolence intake', subtitle: 'Holiday Assistance and Food Pantry eligibility', task_type: 'intake', team_id: await teamBySlug(db, 'benevolence-team'), due_on: addDays(today, 4) })
  }

  await openCase(db, {
    personId: c.person_id,
    whyFlagged: why,
    urgency,
    sensitive: !!cls.reason,
    sensitiveReason: cls.reason ?? null,
    sensitiveVisibility: 'pastors',
    channels: ['text', 'call'],
    actionTitle: 'Text, then Call',
    actionDetail: cls.reason === 'Employment and finances'
      ? 'Pastoral text now; offer Counseling Services and Community Resources (211).'
      : 'Pastoral text now, then a call within 48 hours.',
    suggestedMessage: await suggestedText(db, c.person_id, team),
    confidence: drop >= 2 || c.score <= 1 ? 'high' : 'medium',
    ownerTeamId: team,
    dueOn: today,
    momentType: cls.moment ?? null,
    dedupeKey: `checkin:${c.person_id}:${today.slice(0, 7)}`,
    tasks,
  })
}

export async function onCareRequest(db: Db, requestId: string) {
  const { data: r } = await db.from('care_requests').select('*').eq('id', requestId).single()
  if (!r || r.case_id) return
  const today = todayISO()
  const { data: person } = await db.from('people').select('campus_id, first_name').eq('id', r.person_id).single()
  const cls = classifyNote(r.body)
  let result: { id: string } | null = null

  if (r.kind === 'prayer') {
    await db.from('signals').insert({ person_id: r.person_id, kind: 'prayer_request', summary: `Prayer request: ${r.topic ?? 'general'}`, source: r.source === 'onechurch_form' ? 'OneChurch website form' : 'Member portal', severity: 'normal', pastors_only: r.visibility === 'pastors' })
    const serious = cls.safety || !!cls.moment || r.wants_call || r.topic === 'Grief' || r.topic === 'Health'
    const team = await resolveTeam(db, r.person_id, person?.campus_id ?? null, r.topic === 'Health' ? 'care-team-east' : null, [r.topic ?? ''])
    result = await openCase(db, {
      personId: r.person_id,
      whyFlagged: `Prayer request via ${r.source === 'onechurch_form' ? 'website' : 'portal'}: ${(r.body ?? r.topic ?? '').slice(0, 140)}`,
      urgency: cls.safety ? 'urgent' : serious ? 'high' : 'normal',
      sensitive: r.visibility === 'pastors' || !!cls.reason,
      sensitiveReason: cls.reason ?? r.topic ?? 'Prayer request',
      sensitiveVisibility: r.visibility === 'pastors' ? 'pastors' : 'pastors_and_staff',
      channels: r.wants_call ? ['call'] : ['text'],
      actionTitle: r.wants_call ? 'Call' : 'Text',
      actionDetail: r.wants_call ? 'They asked for a pastor or minister to call. Pray together.' : 'Let them know the prayer team is praying.',
      ownerTeamId: team,
      dueOn: r.wants_call || serious ? today : addDays(today, 1),
      momentType: cls.moment ?? null,
      dedupeKey: `request:${r.id}`,
      tasks: [{ title: r.wants_call ? 'Prayer call' : 'Prayer follow-up text', task_type: r.wants_call ? 'call' : 'text', team_id: team, due_on: r.wants_call || serious ? today : addDays(today, 1) }],
    })
  } else if (r.kind === 'pastor_call') {
    const office = await teamBySlug(db, 'pastoral-office')
    result = await openCase(db, {
      personId: r.person_id, whyFlagged: 'Asked to talk to a pastor (call back within 24h).', urgency: 'urgent',
      sensitive: true, sensitiveReason: 'Pastoral conversation', sensitiveVisibility: 'pastors',
      channels: ['call'], actionTitle: 'Call', actionDetail: 'Pastor calls back within 24 hours.', ownerTeamId: office, dueOn: today,
      dedupeKey: `request:${r.id}`, tasks: [{ title: 'Pastor call back', task_type: 'call', team_id: office, due_on: today }],
    })
  } else if (r.kind === 'practical') {
    const benevolence = await teamBySlug(db, 'benevolence-team')
    await db.from('care_requests').update({ team_id: benevolence }).eq('id', r.id)
    result = await openCase(db, {
      personId: r.person_id, whyFlagged: `Practical help requested: ${r.items.join(', ')}.`, urgency: 'high',
      sensitive: true, sensitiveReason: 'Employment and finances', sensitiveVisibility: 'pastors_and_staff',
      channels: [r.contact_pref ?? 'text'], actionTitle: 'Benevolence intake',
      actionDetail: 'Check eligibility for Food Pantries, Free Holiday Assistance or Total Restoration. No judgment.',
      ownerTeamId: benevolence, dueOn: addDays(today, 1), dedupeKey: `request:${r.id}`,
      tasks: [{ title: 'Benevolence intake', subtitle: r.items.join(', '), instructions: r.body, task_type: 'intake', team_id: benevolence, due_on: addDays(today, 1) }],
    })
  } else if (r.kind === 'counseling') {
    const counseling = await teamBySlug(db, 'counseling-services')
    result = await openCase(db, {
      personId: r.person_id, whyFlagged: 'Asked for confidential counseling.', urgency: 'high',
      sensitive: true, sensitiveReason: 'Counseling', sensitiveVisibility: 'pastors',
      channels: ['call'], actionTitle: 'Counseling intake', actionDetail: 'Counseling Services reaches out to schedule.',
      ownerTeamId: counseling, dueOn: addDays(today, 1), dedupeKey: `request:${r.id}`,
      tasks: [{ title: 'Counseling intake call', task_type: 'call', team_id: counseling, due_on: addDays(today, 1) }],
    })
  }

  if (result) await db.from('care_requests').update({ case_id: result.id }).eq('id', r.id)
}

export async function onLifeMoment(db: Db, momentId: string) {
  const { data: m } = await db.from('life_moments').select('*, person:people!life_moments_person_id_fkey(first_name, last_name, household_id)').eq('id', momentId).single()
  if (!m || m.case_id) return
  const p = m.person as { first_name: string; last_name: string; household_id: string | null } | null
  const labels: Partial<Record<MomentType, string>> = {
    birth: 'new baby', wedding: 'wedding', promotion: 'promotion or new job', award: 'award or graduation',
    anniversary: 'anniversary', moved: 'new home', sickness: 'illness or surgery', bereavement: 'loss of a loved one',
    job_loss: 'job loss', work_anniversary: 'work anniversary', shut_in: 'shut-in visit', other: 'life moment',
  }
  const source = m.source === 'portal' ? 'Member portal' : m.source === 'leader' ? 'Noticed by a care leader' : 'OneChurch profile'
  await db.from('signals').insert({ person_id: m.person_id, kind: 'life_moment', summary: `Life moment: ${labels[m.type] ?? m.type}${m.who ? ` (${m.who})` : ''}`, source, severity: 'normal' })
  // Recurring dates (anniversaries, birthdays) may be stored with their original year.
  const recurring = ['anniversary', 'work_anniversary', 'birthday'].includes(m.type)
  const momentDate = recurring && m.moment_date < addDays(todayISO(), -7) ? nextAnniversary(m.moment_date).date : m.moment_date
  const res = await runPlaybook(db, {
    personId: m.person_id,
    moment: m.type,
    momentDate,
    why: `${m.source === 'leader' ? 'Noticed by a care leader' : m.source === 'portal' ? 'Life event shared in portal' : 'Life event'}: ${labels[m.type] ?? m.type}${m.note ? ` · ${m.note.slice(0, 100)}` : ''}${m.who && m.who !== 'Our family' ? ` (${m.who})` : ''}.`,
    dedupeKey: `moment:${m.id}`,
    householdLabel: p?.household_id && ['birth', 'bereavement', 'moved'].includes(m.type) ? `The ${p.last_name} family` : null,
  })
  if (res) await db.from('life_moments').update({ case_id: res.id }).eq('id', m.id)
  if (res?.created && m.type === 'bereavement') await addGriefFollowUps(db, res.id, m.person_id, m.moment_date)
}

// ─── Daily run ──────────────────────────────────────────────────────────────

export async function setting<T>(db: Db, key: string, fallback: T): Promise<T> {
  const { data } = await db.from('app_settings').select('value').eq('key', key).maybeSingle()
  return (data?.value as T) ?? fallback
}

/** Sundays (yyyy-mm-dd) going back from the most recent one. */
function recentSundays(today: string, count: number) {
  const d = new Date(today + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() - d.getUTCDay())
  const out: string[] = []
  for (let i = 0; i < count; i++) {
    out.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() - 7)
  }
  return out
}

export async function detectMissedAttendance(db: Db) {
  const today = todayISO()
  const threshold = await setting(db, 'attendance_missed_sundays_threshold', 3)
  const sundays = recentSundays(addDays(today, -1), 16) // most recent completed Sunday first
  const since = sundays.at(-1)!
  const { data: consented } = await db.from('consents').select('person_id').eq('use_attendance', true)
  const allowed = new Set((consented ?? []).map((c) => c.person_id))
  const { data: rows } = await db.from('attendance').select('person_id, meeting_date, via').eq('kind', 'sunday').gte('meeting_date', since)
  const byPerson = new Map<string, Set<string>>()
  for (const r of rows ?? []) {
    if (!byPerson.has(r.person_id)) byPerson.set(r.person_id, new Set())
    byPerson.get(r.person_id)!.add(r.meeting_date)
  }
  let flagged = 0
  for (const [personId, dates] of byPerson) {
    if (!allowed.has(personId)) continue
    let missed = 0
    for (const s of sundays) {
      if (dates.has(s)) break
      missed++
    }
    const before = sundays.slice(missed, missed + 12)
    const attendedBefore = before.filter((s) => dates.has(s)).length
    // Only flag people who had a steady pattern: 8 of the 12 Sundays before the gap.
    if (missed < threshold || attendedBefore < 8) continue
    const { data: person } = await db.from('people').select('campus_id, first_name, last_name, household_id').eq('id', personId).single()
    const team = await resolveTeam(db, personId, person?.campus_id ?? null, null, ['re-engagement'])
    const isGlobal = person?.campus_id === 'global'
    await db.from('signals').upsert({
      person_id: personId, kind: isGlobal ? 'livestream_absent' : 'missed_attendance',
      summary: isGlobal ? `Hasn't joined the livestream in ${missed} weeks` : `Missed ${missed} Sundays`,
      source: 'OneChurch attendance', severity: 'high', dedupe_key: `missed:${personId}:${sundays[missed - 1]}`,
    }, { onConflict: 'dedupe_key', ignoreDuplicates: true })
    const res = await openCase(db, {
      personId,
      whyFlagged: isGlobal
        ? `Hasn't joined the 10 AM livestream in ${missed} weeks.`
        : `Missed ${missed} Sundays after ${attendedBefore >= 11 ? 'steady' : 'regular'} attendance.`,
      urgency: missed >= threshold + 2 ? 'high' : 'normal',
      channels: ['call'], actionTitle: 'Call', actionDetail: 'Check-in call from their small group leader. No ask.',
      ownerTeamId: team, dueOn: addDays(today, 1), dedupeKey: `missed:${personId}:${sundays[missed - 1]}`,
      tasks: [{ title: 'Check-in call', instructions: 'No ask. Just checking in.', task_type: 'call', team_id: team, due_on: addDays(today, 1) }],
    })
    if (res.created) flagged++
  }
  return flagged
}

export async function detectShutInVisits(db: Db) {
  const today = todayISO()
  const interval = await setting(db, 'shut_in_visit_interval_days', 30)
  const { data } = await db.from('person_care').select('person_id, last_touch_at').eq('is_shut_in', true)
  const team = await teamBySlug(db, 'shut-in-team')
  let flagged = 0
  const { data: openVisits } = await db.from('care_cases').select('person_id').eq('status', 'open').eq('moment_type', 'shut_in')
  const hasOpen = new Set((openVisits ?? []).map((c) => c.person_id))
  for (const p of data ?? []) {
    if (hasOpen.has(p.person_id)) continue
    const days = p.last_touch_at ? daysBetween(p.last_touch_at.slice(0, 10), today) : 999
    if (days < interval) continue
    const res = await openCase(db, {
      personId: p.person_id,
      whyFlagged: `Shut-in. Monthly visit due; ${days === 999 ? 'no contact logged yet' : `no contact logged in ${days} days`}.`,
      urgency: days > interval + 7 ? 'high' : 'normal', channels: ['visit'], actionTitle: 'Visit',
      actionDetail: 'Home visit with Communion; check livestream setup.', ownerTeamId: team, dueOn: addDays(today, 3),
      momentType: 'shut_in', dedupeKey: `shutin:${p.person_id}:${today.slice(0, 7)}`,
      tasks: [{ title: 'Home visit with Communion', instructions: 'Check livestream setup.', task_type: 'visit', team_id: team, due_on: addDays(today, 3) }],
    })
    if (res.created) flagged++
  }
  return flagged
}

/** Puts upcoming birthdays and anniversaries from OneChurch profiles on the care calendar. */
export async function scheduleMilestones(db: Db) {
  const today = todayISO()
  const horizon = addDays(today, 7)
  const { data: consented } = await db.from('consents').select('person_id').eq('celebrate_milestones', true)
  const allowed = new Set((consented ?? []).map((c) => c.person_id))
  const { data: people } = await db.from('people').select('id, birthday, anniversary, family_position').eq('archived', false).eq('deceased', false).or('birthday.not.is.null,anniversary.not.is.null')
  let added = 0
  for (const p of people ?? []) {
    if (!allowed.has(p.id)) continue
    for (const [field, type] of [['anniversary', 'anniversary'], ['birthday', 'birthday']] as const) {
      const d = p[field]
      if (!d) continue
      const next = nextAnniversary(d, today)
      if (next.date > horizon) continue
      // Milestone birthdays only (18 for children, 50, 60, then every decade); every wedding anniversary.
      const yearKnown = Number(d.slice(0, 4)) !== 1904 // 1904 = year not recorded in OneChurch
      const milestone = (y: number) => (y === 18 && p.family_position === 'Child') || y === 50 || y === 60 || (y >= 70 && y % 10 === 0)
      if (type === 'birthday' && !(yearKnown && milestone(next.years))) continue
      const { error } = await db.from('life_moments').insert({
        person_id: p.id, type, moment_date: next.date, who: yearKnown ? `${next.years} years` : null, source: 'onechurch_profile',
      })
      if (!error) added++
    }
  }
  return added
}

/** Moves scheduled tasks to due when their day arrives, and texts the leader. */
export async function promoteDueTasks(db: Db) {
  const today = todayISO()
  const { data } = await db.from('tasks').update({ status: 'due' }).eq('status', 'scheduled').lte('due_on', today).select('id')
  await Promise.all((data ?? []).map((t) => notifyTaskAssigned(db, t.id)))
  return data?.length ?? 0
}

/** A task 48h overdue moves up one level: leader → campus pastor → associate pastor → senior pastor. */
export async function escalateOverdue(db: Db) {
  const hours = await setting(db, 'escalate_after_hours', 48)
  const cutoffDate = addDays(todayISO(), -Math.ceil(hours / 24))
  const cutoffTs = new Date(Date.now() - hours * 3_600_000).toISOString()
  const { data } = await db
    .from('tasks')
    .select('id, escalation_level, escalated_at')
    .in('status', ['scheduled', 'due'])
    .lt('due_on', cutoffDate)
    .lt('escalation_level', 4)
  let moved = 0
  for (const t of data ?? []) {
    if (t.escalated_at && t.escalated_at > cutoffTs) continue
    await db.from('tasks').update({ escalation_level: t.escalation_level + 1, escalated_at: new Date().toISOString() }).eq('id', t.id)
    moved++
  }
  return moved
}

/**
 * Care score, 0–100: how the person is doing as far as we can tell.
 *   55%  latest weekly check-in (Great=100 … Very hard=0)
 *   30%  Sunday attendance over the last 4 weeks
 *   15%  open urgent care need (none = full marks)
 */
export async function recomputeCareScores(db: Db) {
  const today = todayISO()
  const since28 = addDays(today, -28)
  const since14 = addDays(today, -14)
  const [{ data: checkins }, { data: att }, { data: cases }] = await Promise.all([
    db.from('checkins').select('person_id, score, created_at').gte('created_at', addDays(today, -60)).order('created_at', { ascending: false }),
    db.from('attendance').select('person_id, meeting_date').eq('kind', 'sunday').gte('meeting_date', addDays(today, -42)),
    db.from('care_cases').select('person_id, urgency').eq('status', 'open'),
  ])
  const latest = new Map<string, number>()
  const before = new Map<string, number>()
  for (const c of checkins ?? []) {
    if (!latest.has(c.person_id)) latest.set(c.person_id, c.score)
    if (c.created_at.slice(0, 10) <= since14 && !before.has(c.person_id)) before.set(c.person_id, c.score)
  }
  const recent = new Map<string, number>()
  const older = new Map<string, number>()
  for (const a of att ?? []) {
    const m = a.meeting_date >= since28 ? recent : a.meeting_date >= addDays(since14, -28) ? older : null
    m?.set(a.person_id, (m.get(a.person_id) ?? 0) + 1)
  }
  const urgent = new Set((cases ?? []).filter((c) => c.urgency === 'urgent').map((c) => c.person_id))
  const ids = new Set([...latest.keys(), ...recent.keys(), ...older.keys()])
  const score = (checkin: number | undefined, sundays: number, isUrgent: boolean) =>
    Math.round((checkin !== undefined ? ((checkin - 1) / 4) * 55 : 40) + Math.min(sundays, 4) / 4 * 30 + (isUrgent ? 0 : 15))
  const rows = [...ids].map((id) => {
    const now = score(latest.get(id), recent.get(id) ?? 0, urgent.has(id))
    const then = score(before.get(id) ?? latest.get(id), older.get(id) ?? recent.get(id) ?? 0, false)
    return { person_id: id, care_score: now, care_score_delta_14d: now - then, updated_at: new Date().toISOString() }
  })
  for (let i = 0; i < rows.length; i += 500) await db.from('person_care').upsert(rows.slice(i, i + 500), { onConflict: 'person_id' })
  return rows.length
}

export async function runDailyEngine(db: Db) {
  const milestones = await scheduleMilestones(db)
  // New milestone moments get their playbook now.
  const { data: fresh } = await db.from('life_moments').select('id').is('case_id', null).eq('status', 'open').lte('moment_date', addDays(todayISO(), 7))
  for (const m of fresh ?? []) await onLifeMoment(db, m.id)
  return {
    milestones,
    missedAttendance: await detectMissedAttendance(db),
    shutInVisits: await detectShutInVisits(db),
    tasksDue: await promoteDueTasks(db),
    escalated: await escalateOverdue(db),
    careScores: await recomputeCareScores(db),
    proactive: await runProactive(db),
  }
}
