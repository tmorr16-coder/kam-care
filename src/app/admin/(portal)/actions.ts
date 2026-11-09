'use server'

import { after } from 'next/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { assertStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyTaskAssigned, runDailyEngine } from '@/lib/care/engine'
import { writeTouchToOneChurch } from '@/lib/onechurch/sync'
import type { Channel } from '@/lib/types'

const uuid = z.guid()

/** "Run today's outreach": the same daily pass the cron runs, on demand. */
export async function runOutreach() {
  await assertStaff()
  const db = createAdminClient()
  const { data: run } = await db.from('sync_runs').insert({ kind: 'engine' }).select('id').single()
  try {
    const stats = await runDailyEngine(db)
    if (run) await db.from('sync_runs').update({ finished_at: new Date().toISOString(), ok: true, stats }).eq('id', run.id)
  } catch (e) {
    if (run) await db.from('sync_runs').update({ finished_at: new Date().toISOString(), ok: false, error: String(e) }).eq('id', run.id)
    throw e
  }
  revalidatePath('/admin')
}

/** Changes a case's owner and hands its open tasks (unassigned or held by the old owner) to the new one. */
export async function reassignCase(formData: FormData) {
  await assertStaff()
  const caseId = uuid.parse(formData.get('caseId'))
  const teamId = uuid.parse(formData.get('teamId'))
  const sb = await createClient()
  const { data: c, error } = await sb.from('care_cases').select('id, owner_team_id').eq('id', caseId).single()
  if (error || !c) throw new Error('Case not found')

  await sb.from('care_cases').update({ owner_team_id: teamId }).eq('id', caseId)
  let q = sb.from('tasks').update({ assignee_team_id: teamId, notified_at: null }).eq('case_id', caseId).in('status', ['scheduled', 'due'])
  q = c.owner_team_id ? q.or(`assignee_team_id.is.null,assignee_team_id.eq.${c.owner_team_id}`) : q.is('assignee_team_id', null)
  const { data: moved } = await q.select('id')

  after(async () => {
    const db = createAdminClient()
    for (const t of moved ?? []) await notifyTaskAssigned(db, t.id)
  })
  revalidatePath('/admin')
}

async function logTouch(caseId: string, personId: string, channel: Channel, summary: string) {
  const v = await assertStaff()
  const sb = await createClient()
  const { data: c } = await sb.from('care_cases').select('id').eq('id', caseId).eq('person_id', personId).single()
  if (!c) throw new Error('Case not found')
  const { data: touch, error } = await sb
    .from('touches')
    .insert({ person_id: personId, case_id: caseId, channel, summary, by_user: v.userId })
    .select('id')
    .single()
  if (error) throw error
  after(() => writeTouchToOneChurch(createAdminClient(), touch.id).catch((e) => console.error('write-back failed', e)))
  return sb
}

const touchSchema = z.object({ caseId: uuid, personId: uuid, channel: z.enum(['text', 'call', 'visit', 'email', 'app', 'card']) })

/** Logged when a leader taps Call or Email from the queue. */
export async function logQuickTouch(input: z.input<typeof touchSchema>) {
  const { caseId, personId, channel } = touchSchema.parse(input)
  await logTouch(caseId, personId, channel, channel === 'call' ? 'Call from care queue' : 'Email from care queue')
  revalidatePath('/admin')
}

/** The check button: logs the touch, closes the case and its open tasks. */
export async function completeCase(formData: FormData) {
  const caseId = uuid.parse(formData.get('caseId'))
  const personId = uuid.parse(formData.get('personId'))
  const channel = touchSchema.shape.channel.catch('call').parse(formData.get('channel'))
  const sb = await logTouch(caseId, personId, channel, 'Care completed from care queue')
  const now = new Date().toISOString()
  await sb.from('tasks').update({ status: 'done', outcome: 'reached', completed_at: now }).eq('case_id', caseId).in('status', ['scheduled', 'due'])
  await sb.from('care_cases').update({ status: 'closed', closed_at: now }).eq('id', caseId)
  revalidatePath('/admin')
}
