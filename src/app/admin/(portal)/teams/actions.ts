'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { assertStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyTaskAssigned } from '@/lib/care/engine'

export type FormState = { ok?: boolean; error?: string; message?: string }

const uuid = z.guid()

export async function assignTask(formData: FormData) {
  await assertStaff()
  const taskId = uuid.parse(formData.get('taskId'))
  const teamId = uuid.parse(formData.get('teamId'))
  // User-scoped client: RLS decides whether this person may touch the task.
  const supabase = await createClient()
  const { data, error } = await supabase.from('tasks').update({ assignee_team_id: teamId, notified_at: null }).eq('id', taskId).select('id').maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Task not found or not visible to you')
  await notifyTaskAssigned(createAdminClient(), taskId)
  revalidatePath('/admin/teams')
  revalidatePath('/admin')
}

export async function updateCapacity(formData: FormData) {
  await assertStaff()
  const id = uuid.parse(formData.get('teamId'))
  const capacity = z.coerce.number().int().min(1).max(200).parse(formData.get('capacity'))
  const supabase = await createClient()
  const { error } = await supabase.from('care_teams').update({ weekly_capacity: capacity }).eq('id', id)
  if (error) throw error
  revalidatePath('/admin/teams')
}

const TeamSchema = z.object({
  name: z.string().trim().min(2).max(80),
  subtitle: z.string().trim().max(80).optional(),
  kind: z.enum(['person', 'team']),
  campus: z.enum(['indianapolis', 'detroit', 'atlanta', 'global', 'all']),
  capacity: z.coerce.number().int().min(1).max(200),
  gifted: z.string().trim().max(200).optional(),
  ocGroupId: z.union([z.literal(''), z.coerce.number().int().positive()]).optional(),
  email: z.union([z.literal(''), z.string().trim().email()]).optional(),
})

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
}

export async function createTeam(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    await assertStaff()
  } catch {
    return { error: 'You need staff access to add leaders.' }
  }
  const parsed = TeamSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') }
  const v = parsed.data
  const supabase = await createClient()

  let personId: string | null = null
  if (v.email) {
    const { data: people } = await supabase.from('people').select('id').ilike('email', v.email).eq('archived', false).limit(2)
    if (!people?.length) return { error: `No one in OneChurch has the email ${v.email}. Check their OneChurch record first.` }
    if (people.length > 1) return { error: `${v.email} is shared by more than one person. Use a personal email.` }
    personId = people[0].id
  }

  const { data: team, error } = await supabase.from('care_teams').insert({
    slug: `${slugify(v.name)}-${Math.random().toString(36).slice(2, 6)}`,
    name: v.name,
    subtitle: v.subtitle || null,
    kind: v.kind,
    person_id: v.kind === 'person' ? personId : null,
    campus_id: v.campus === 'all' ? null : v.campus,
    weekly_capacity: v.capacity,
    gifted_for: (v.gifted ?? '').split(',').map((g) => g.trim()).filter(Boolean),
    oc_group_id: typeof v.ocGroupId === 'number' ? v.ocGroupId : null,
  }).select('id').single()
  if (error) return { error: error.message }

  // For a team, the person looked up by email becomes its first member.
  if (v.kind === 'team' && personId) await supabase.from('care_team_members').insert({ team_id: team.id, person_id: personId })
  revalidatePath('/admin/teams')
  return { ok: true, message: `${v.name} added.` }
}
