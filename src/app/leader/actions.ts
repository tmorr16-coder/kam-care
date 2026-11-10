'use server'
import { after } from 'next/server'
import { refresh } from 'next/cache'
import { requireLeader } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeTouchToOneChurch } from '@/lib/onechurch/sync'
import type { Channel, MomentType, TaskOutcome } from '@/lib/types'
import { onLifeMoment } from '@/lib/care/engine'
import { todayISO } from '@/lib/dates'

const OUTCOMES: TaskOutcome[] = ['reached', 'left_message', 'needs_pastor']
const CHANNEL_FOR: Record<string, Channel> = { text: 'text', visit: 'visit', card: 'card', email: 'email' }

export async function logOutcome(formData: FormData) {
  const v = await requireLeader()
  const taskId = String(formData.get('task_id') ?? '')
  const outcome = String(formData.get('outcome') ?? '') as TaskOutcome
  const taskType = String(formData.get('task_type') ?? 'call')
  if (!taskId || !OUTCOMES.includes(outcome)) return
  const supabase = await createClient()
  // The database function checks the leader holds this task.
  const { error } = await supabase.rpc('log_task_outcome', { p_task: taskId, p_outcome: outcome, p_channel: CHANNEL_FOR[taskType] ?? 'call' })
  if (error) throw new Error(error.message)

  const { data: touch } = await supabase
    .from('touches')
    .select('id')
    .eq('task_id', taskId)
    .eq('by_user', v.userId)
    .order('occurred_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  // Non-sensitive touches are copied to OneChurch Notes (if write-back is on).
  if (touch) after(() => writeTouchToOneChurch(createAdminClient(), touch.id).catch((e) => console.error('[write-back]', e)))
  refresh()
}

// ─── "Noticed something?" ───────────────────────────────────────────────────

export type FoundPerson = { id: string; display_name: string; campus: string | null }

/**
 * Name search for the form: name and campus only. requireLeader() has already checked the
 * caller is a care leader, staff or pastor, so this reads with the service client and
 * doesn't depend on a database function being installed.
 */
async function searchPeople(q: string): Promise<FoundPerson[]> {
  // Keep only letters, spaces, dots, apostrophes and hyphens so the text is safe in the filter.
  const term = q.replace(/[^\p{L}\p{N} .'-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 60)
  if (term.length < 2) return []
  const words = term.split(' ')
  let query = createAdminClient()
    .from('people')
    .select('id, display_name, first_name, last_name, campus:campuses(name)')
    .eq('archived', false)
    .eq('deceased', false)
  // Every word must match the display name, first name or last name ("john sm" finds John Smith).
  for (const w of words) query = query.or(`display_name.ilike.%${w}%,first_name.ilike.%${w}%,last_name.ilike.%${w}%`)
  const { data, error } = await query.order('last_name').order('first_name').limit(8)
  if (error) throw new Error(error.message)
  return (data ?? []).map((p) => ({
    id: p.id,
    display_name: p.display_name ?? [p.first_name, p.last_name].filter(Boolean).join(' '),
    campus: (p.campus as { name: string } | null)?.name ?? null,
  }))
}

export async function findPeople(q: string): Promise<{ people: FoundPerson[]; error?: string }> {
  await requireLeader()
  try {
    return { people: await searchPeople(q) }
  } catch (e) {
    console.error('[find people]', e)
    return { people: [], error: 'Search isn\'t working right now. Please try again.' }
  }
}

const NOTICED: MomentType[] = ['birth', 'wedding', 'promotion', 'award', 'moved', 'sickness', 'bereavement', 'job_loss', 'other']
const WHERE: Record<string, string> = {
  facebook: 'Facebook', instagram: 'Instagram', social: 'Social media', person: 'In person', told: 'Someone told me',
}

export type NoticedState = { ok?: boolean; error?: string } | undefined

/** A leader saw a life event (often on social media). It goes through the same playbooks as any other. */
export async function reportNoticed(_prev: NoticedState, formData: FormData): Promise<NoticedState> {
  const v = await requireLeader()
  const personId = String(formData.get('person_id') ?? '')
  const type = String(formData.get('type') ?? '') as MomentType
  const where = WHERE[String(formData.get('where') ?? '')] ?? 'Other'
  const note = String(formData.get('note') ?? '').trim().slice(0, 500) || null
  if (!personId) return { error: 'Pick the person first.' }
  if (!NOTICED.includes(type)) return { error: 'Pick what happened.' }

  // Only someone the leader could find through the search.
  const found = await searchPeople(String(formData.get('person_name') ?? '')).catch(() => [])
  if (!found.some((p) => p.id === personId)) return { error: 'Pick the person from the list.' }

  const db = createAdminClient()
  const by = v.displayName ?? v.email ?? 'a care leader'
  const { data, error } = await db
    .from('life_moments')
    .insert({ person_id: personId, type, moment_date: todayISO(), note: `${where}, noted by ${by}${note ? `: ${note}` : ''}`, source: 'leader' })
    .select('id')
    .single()
  if (error) return { error: 'Could not save that. Please try again.' }
  after(() => onLifeMoment(createAdminClient(), data.id).catch((e) => console.error('[care-engine]', e)))
  return { ok: true }
}
