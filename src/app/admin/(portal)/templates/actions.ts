'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { assertStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

const MOMENTS = ['birth', 'wedding', 'promotion', 'award', 'anniversary', 'work_anniversary', 'moved', 'sickness', 'bereavement', 'job_loss', 'shut_in', 'birthday', 'other'] as const

const TemplateSchema = z.object({
  id: z.union([z.literal(''), z.guid()]).optional(),
  name: z.string().trim().min(2).max(80),
  channel: z.enum(['text', 'call', 'visit', 'email', 'app', 'card']),
  momentType: z.union([z.literal(''), z.enum(MOMENTS)]).optional(),
  body: z.string().trim().min(2).max(1600),
})

export async function saveTemplate(formData: FormData) {
  await assertStaff()
  const v = TemplateSchema.parse(Object.fromEntries(formData))
  const supabase = await createClient()
  const row = { name: v.name, channel: v.channel, moment_type: v.momentType || null, body: v.body, updated_at: new Date().toISOString() }
  const { error } = v.id
    ? await supabase.from('message_templates').update(row).eq('id', v.id)
    : await supabase.from('message_templates').insert(row)
  if (error) throw error
  revalidatePath('/admin/templates')
}

export async function deleteTemplate(formData: FormData) {
  await assertStaff()
  const id = z.guid().parse(formData.get('id'))
  const supabase = await createClient()
  const { error } = await supabase.from('message_templates').delete().eq('id', id)
  if (error) throw error
  revalidatePath('/admin/templates')
}
