'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { assertStaff } from '@/lib/auth'
import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isOneChurchConfigured } from '@/lib/onechurch/client'
import { syncMappedGroup } from '@/lib/onechurch/sync'

const MappingSchema = z.object({
  ocGroupId: z.coerce.number().int().positive(),
  groupName: z.string().trim().min(1).max(120),
  role: z.enum(['member', 'care_leader', 'staff', 'pastor']),
  grantsAdmin: z.literal('on').optional(),
  createTeam: z.literal('on').optional(),
  campus: z.string().optional(),
})

export async function saveRoleMapping(formData: FormData) {
  await assertStaff({ admin: true })
  const v = MappingSchema.parse(Object.fromEntries(formData))
  const supabase = await createClient()
  const { error } = await supabase.from('role_mappings').upsert({
    oc_group_id: v.ocGroupId,
    group_name: v.groupName,
    role: v.role,
    grants_admin: v.grantsAdmin === 'on',
  })
  if (error) throw error

  if (v.createTeam === 'on') {
    // A KAM Care team mirroring the group, so its members can be assigned tasks.
    const slug = v.groupName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `group-${v.ocGroupId}`
    const { error: teamError } = await supabase.from('care_teams').upsert(
      { slug, name: v.groupName, subtitle: 'From OneChurch', kind: 'team', oc_group_id: v.ocGroupId, weekly_capacity: 10 },
      { onConflict: 'slug' },
    )
    if (teamError) throw teamError
  }

  // Apply the new role to the group's members right away.
  if (isOneChurchConfigured()) {
    after(() => syncMappedGroup(createAdminClient(), v.ocGroupId).catch((e) => console.error('group sync failed', e)))
  }
  revalidatePath('/admin/signals')
  revalidatePath('/admin/teams')
}

export async function deleteRoleMapping(formData: FormData) {
  await assertStaff({ admin: true })
  const id = z.coerce.number().int().positive().parse(formData.get('ocGroupId'))
  const supabase = await createClient()
  const { error } = await supabase.from('role_mappings').delete().eq('oc_group_id', id)
  if (error) throw error
  revalidatePath('/admin/signals')
}
