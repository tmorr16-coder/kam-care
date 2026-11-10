'use server'

import { after } from 'next/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { assertStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { addTasks, openCase, teamBySlug } from '@/lib/care/engine'
import { writeTouchToOneChurch } from '@/lib/onechurch/sync'
import { sendSms } from '@/lib/messaging'
import { addDays, todayISO } from '@/lib/dates'
import { SENSITIVE_REASONS } from '@/lib/types'

const uuid = z.guid()
const optionalUuid = z.preprocess((v) => (v === '' || v === null ? undefined : v), uuid.optional())

export type ActionState = { ok?: string; error?: string } | null

const done = (personId: string, ok: string): ActionState => {
  revalidatePath(`/admin/members/${personId}`)
  revalidatePath('/admin')
  return { ok }
}
const fail = (e: unknown): ActionState => ({ error: e instanceof z.ZodError ? 'Please check the form.' : e instanceof Error ? e.message : 'Something went wrong' })

/** Confirms through RLS that the viewer can see this person (and case, when given). */
async function verify(personId: string, caseId?: string) {
  const v = await assertStaff()
  const sb = await createClient()
  const { data: person } = await sb.from('people').select('id, phone, first_name, campus_id').eq('id', personId).maybeSingle()
  if (!person) throw new Error('Member not found')
  if (caseId) {
    const { data: c } = await sb.from('care_cases').select('id').eq('id', caseId).eq('person_id', personId).maybeSingle()
    if (!c) throw new Error('You do not have access to this care matter')
  }
  return { v, sb, person }
}

export async function sendText(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const personId = uuid.parse(fd.get('personId'))
    const caseId = optionalUuid.parse(fd.get('caseId'))
    const body = z.string().trim().min(1).max(1200).parse(fd.get('body'))
    const { v, sb, person } = await verify(personId, caseId)
    const { data: consent } = await sb.from('consents').select('texts').eq('person_id', personId).maybeSingle()
    if (consent && !consent.texts) return { error: 'This member has turned off texts from their care team.' }
    if (!person.phone) return { error: 'No mobile number on file.' }

    const status = await sendSms(person.phone, body)
    const { data: touch, error } = await sb
      .from('touches')
      .insert({ person_id: personId, case_id: caseId ?? null, channel: 'text', summary: `Text from ${v.displayName ?? 'care team'}`, body, delivery_status: status, by_user: v.userId })
      .select('id')
      .single()
    if (error) throw error
    after(() => writeTouchToOneChurch(createAdminClient(), touch.id).catch((e) => console.error('write-back failed', e)))
    return done(personId, status === 'sent' ? 'Text sent.' : status === 'not_configured' ? 'Logged. Texting is not set up yet, so nothing was sent.' : 'Text failed to send; it was logged.')
  } catch (e) {
    return fail(e)
  }
}

export async function scheduleCall(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const personId = uuid.parse(fd.get('personId'))
    const caseId = uuid.parse(fd.get('caseId'))
    const { v, sb } = await verify(personId, caseId)
    const { data: c } = await sb.from('care_cases').select('owner_team_id, sensitive').eq('id', caseId).single()
    await addTasks(createAdminClient(), caseId, personId, [{ title: 'Follow-up call', task_type: 'call', team_id: c?.owner_team_id, due_on: addDays(todayISO(), 2) }], c?.sensitive ?? false, v.userId)
    return done(personId, 'Call scheduled for 2 days from now.')
  } catch (e) {
    return fail(e)
  }
}

export async function referCounseling(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const personId = uuid.parse(fd.get('personId'))
    const caseId = uuid.parse(fd.get('caseId'))
    const { v } = await verify(personId, caseId)
    const db = createAdminClient()
    const team = await teamBySlug(db, 'counseling-services')
    await addTasks(db, caseId, personId, [{ title: 'Counseling referral', subtitle: 'Only if they agree', task_type: 'referral', team_id: team, due_on: addDays(todayISO(), 3) }], true, v.userId)
    return done(personId, 'Referred to Counseling Services.')
  } catch (e) {
    return fail(e)
  }
}

export async function snoozeCase(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const personId = uuid.parse(fd.get('personId'))
    const caseId = uuid.parse(fd.get('caseId'))
    const { sb } = await verify(personId, caseId)
    await sb.from('care_cases').update({ snoozed_until: addDays(todayISO(), 3) }).eq('id', caseId)
    return done(personId, 'Snoozed for 3 days.')
  } catch (e) {
    return fail(e)
  }
}

/** One-click "check in again in a week": a check-in call for the member's leader, due in 7 days. */
export async function checkInNextWeek(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const personId = uuid.parse(fd.get('personId'))
    const caseId = optionalUuid.parse(fd.get('caseId'))
    const teamId = optionalUuid.parse(fd.get('teamId'))
    const { v, sb } = await verify(personId, caseId)
    const due = addDays(todayISO(), 7)
    const db = createAdminClient()
    const task = {
      title: '1-week check-in', instructions: 'See how they are doing since last week. Listen first.', task_type: 'call', due_on: due,
    }
    if (caseId) {
      const { data: c } = await sb.from('care_cases').select('owner_team_id, sensitive').eq('id', caseId).single()
      const team = c?.owner_team_id ?? teamId
      if (!team) return { error: 'Choose a care leader first.' }
      await addTasks(db, caseId, personId, [{ ...task, team_id: team }], c?.sensitive ?? false, v.userId)
    } else {
      if (!teamId) return { error: 'Choose a care leader first.' }
      await openCase(db, {
        personId, whyFlagged: `1-week check-in set by ${v.displayName ?? 'staff'}.`, urgency: 'normal', sensitive: false,
        sensitiveReason: null, sensitiveVisibility: 'pastors_and_staff', channels: ['call'], actionTitle: '1-week check-in',
        ownerTeamId: teamId, dueOn: due, flaggedBy: v.userId, tasks: [{ ...task, team_id: teamId }],
      })
    }
    return done(personId, 'Check-in set for one week from today.')
  } catch (e) {
    return fail(e)
  }
}

const followUpSchema = z.object({
  personId: uuid,
  caseId: optionalUuid,
  taskType: z.enum(['call', 'text', 'visit', 'card', 'coffee', 'intake', 'referral']),
  teamId: uuid,
  due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  instructions: z.string().trim().max(1000).optional(),
  sensitive: z.literal('on').optional(),
  visibility: z.enum(['pastors', 'pastors_and_staff']).optional(),
  reason: z.enum(SENSITIVE_REASONS).optional(),
})

const TASK_TITLES: Record<string, string> = {
  call: 'Phone call', text: 'Text', visit: 'Home visit', card: 'Card', coffee: 'Coffee', intake: 'Benevolence intake', referral: 'Referral',
}

export async function assignFollowUp(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const input = followUpSchema.parse(Object.fromEntries(fd))
    const { v, sb } = await verify(input.personId, input.caseId)
    const sensitive = input.sensitive === 'on'
    if (sensitive && input.visibility === 'pastors' && v.role !== 'pastor' && input.caseId) {
      return { error: 'Only pastors can limit a matter to pastors only.' }
    }
    let caseId = input.caseId ?? null
    if (caseId && sensitive) {
      await sb.from('care_cases').update({ sensitive: true, sensitive_visibility: input.visibility ?? 'pastors', sensitive_reason: input.reason ?? null }).eq('id', caseId)
    }
    const db = createAdminClient()
    const task = {
      title: TASK_TITLES[input.taskType], instructions: input.instructions || null, task_type: input.taskType,
      team_id: input.teamId, due_on: input.due, sensitive,
    }
    if (!caseId) {
      const res = await openCase(db, {
        personId: input.personId, whyFlagged: input.instructions || `${TASK_TITLES[input.taskType]} assigned by ${v.displayName ?? 'staff'}.`,
        urgency: 'normal', sensitive, sensitiveReason: input.reason ?? null, sensitiveVisibility: input.visibility ?? 'pastors',
        channels: [input.taskType === 'text' ? 'text' : input.taskType === 'visit' || input.taskType === 'coffee' ? 'visit' : input.taskType === 'card' ? 'card' : 'call'],
        actionTitle: TASK_TITLES[input.taskType], ownerTeamId: input.teamId, dueOn: input.due, flaggedBy: v.userId, tasks: [task],
      })
      caseId = res.id
    } else {
      await addTasks(db, caseId, input.personId, [task], sensitive, v.userId)
    }
    return done(input.personId, 'Assigned. The leader gets a text with the task, not the member’s file.')
  } catch (e) {
    return fail(e)
  }
}

export async function changeAccess(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const personId = uuid.parse(fd.get('personId'))
    const caseId = uuid.parse(fd.get('caseId'))
    const visibility = z.enum(['pastors', 'pastors_and_staff', 'none']).parse(fd.get('visibility'))
    const { v, sb } = await verify(personId, caseId)
    if (v.role !== 'pastor') return { error: 'Only pastors can change who sees a sensitive matter.' }
    await sb
      .from('care_cases')
      .update(visibility === 'none' ? { sensitive: false, sensitive_visibility: null } : { sensitive: true, sensitive_visibility: visibility })
      .eq('id', caseId)
    await sb.from('access_log').insert({ user_id: v.userId, person_id: personId, case_id: caseId, action: `change_access:${visibility}` })
    return done(personId, 'Access updated.')
  } catch (e) {
    return fail(e)
  }
}

export async function addPastoralNote(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const personId = uuid.parse(fd.get('personId'))
    const body = z.string().trim().min(1).max(4000).parse(fd.get('body'))
    const { v, sb } = await verify(personId)
    if (v.role !== 'pastor') return { error: 'Pastors only.' }
    const { error } = await sb.from('pastoral_notes').insert({ person_id: personId, body, author: v.userId })
    if (error) throw error
    return done(personId, 'Note saved. Pastoral notes stay in KAM Care.')
  } catch (e) {
    return fail(e)
  }
}

const flagSchema = z.object({
  personId: uuid,
  why: z.string().trim().min(3).max(500),
  urgency: z.enum(['urgent', 'high', 'normal']),
  teamId: uuid,
  sensitive: z.literal('on').optional(),
  reason: z.enum(SENSITIVE_REASONS).optional(),
})

export async function flagForCare(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const input = flagSchema.parse(Object.fromEntries(fd))
    const { v } = await verify(input.personId)
    const due = input.urgency === 'normal' ? addDays(todayISO(), 2) : todayISO()
    const sensitive = input.sensitive === 'on'
    await openCase(createAdminClient(), {
      personId: input.personId, whyFlagged: input.why, urgency: input.urgency, sensitive, sensitiveReason: input.reason ?? null,
      sensitiveVisibility: v.role === 'pastor' ? 'pastors' : 'pastors_and_staff',
      channels: ['call'], actionTitle: 'Call', actionDetail: 'Check in. Listen first.', ownerTeamId: input.teamId, dueOn: due, flaggedBy: v.userId,
      tasks: [{ title: 'Check-in call', task_type: 'call', team_id: input.teamId, due_on: due }],
    })
    return done(input.personId, 'Flagged for care.')
  } catch (e) {
    return fail(e)
  }
}
