'use server'
import { after } from 'next/server'
import { refresh } from 'next/cache'
import { requireLeader } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeTouchToOneChurch } from '@/lib/onechurch/sync'
import type { Channel, TaskOutcome } from '@/lib/types'

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
