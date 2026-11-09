import 'server-only'
import type { User } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { isOneChurchConfigured, ocRequest } from '@/lib/onechurch/client'
import type { OcPerson, Paged } from '@/lib/onechurch/types'
import { syncRolesForPerson, upsertPerson } from '@/lib/onechurch/sync'

/**
 * Matches a sign-in to one OneChurch person:
 *   1. verified email matches exactly one person
 *   2. otherwise verified mobile matches exactly one person
 *   3. shared family email, several matches or no match → Member Services reviews
 */
export async function matchUserToPerson(user: User) {
  const db = createAdminClient()
  const { data: profile } = await db.from('profiles').select('person_id, match_status').eq('user_id', user.id).maybeSingle()
  if (!profile) await db.from('profiles').insert({ user_id: user.id })

  if (profile?.match_status === 'matched' && profile.person_id) {
    await refreshRole(profile.person_id)
    return 'matched' as const
  }

  const email = user.email_confirmed_at || user.app_metadata?.provider !== 'email' ? user.email?.toLowerCase() : undefined
  const phone = user.phone_confirmed_at ? `+${user.phone?.replace(/\D/g, '')}` : undefined

  let candidates = email ? await findBy('email', email) : []
  let via = 'email'
  if (candidates.length !== 1 && phone) {
    const byPhone = await findBy('phone', phone)
    if (byPhone.length === 1 || !candidates.length) {
      candidates = byPhone
      via = 'mobile'
    }
  }

  if (candidates.length === 1) {
    const personId = candidates[0]
    const { data: taken } = await db.from('profiles').select('user_id').eq('person_id', personId).neq('user_id', user.id).maybeSingle()
    if (!taken) {
      const { data: person } = await db.from('people').select('campus_id').eq('id', personId).single()
      await db.from('profiles').update({ person_id: personId, match_status: 'matched', campus_id: person?.campus_id }).eq('user_id', user.id)
      await refreshRole(personId)
      return 'matched' as const
    }
  }

  const name = (user.user_metadata?.full_name as string | undefined) ?? user.email ?? user.phone ?? 'Unknown'
  const provider = user.app_metadata?.provider ?? 'email'
  const reason =
    candidates.length > 1
      ? via === 'email' ? `Shared family email matches ${candidates.length} people` : `Mobile number matches ${candidates.length} records`
      : candidates.length === 1 ? 'That OneChurch person already has a KAM Care login'
        : `Signed in with ${provider[0].toUpperCase() + provider.slice(1)}; no email or mobile match`
  const { data: open } = await db.from('match_reviews').select('id').eq('user_id', user.id).eq('status', 'open').maybeSingle()
  if (!open) await db.from('match_reviews').insert({ user_id: user.id, label: name, reason, candidate_person_ids: candidates })
  await db.from('profiles').update({ match_status: 'review' }).eq('user_id', user.id)
  return 'review' as const
}

async function findBy(field: 'email' | 'phone', value: string): Promise<string[]> {
  const db = createAdminClient()
  const q = db.from('people').select('id').eq('archived', false).eq('deceased', false)
  const { data } = field === 'email' ? await q.ilike('email', value) : await q.eq('phone', value)
  if (data?.length) return data.map((d) => d.id)
  // Not synced yet (e.g. created in OneChurch minutes ago): ask OneChurch directly.
  if (!isOneChurchConfigured()) return []
  const page = await ocRequest<Paged<OcPerson>>('/people', { query: { [field]: value, archived: false, limit: 5 } })
  const ids: string[] = []
  for (const p of page.data ?? []) ids.push(await upsertPerson(db, p))
  return ids
}

async function refreshRole(personId: string) {
  if (!isOneChurchConfigured()) return
  const db = createAdminClient()
  const { data } = await db.from('people').select('oc_person_id').eq('id', personId).single()
  if (data?.oc_person_id) await syncRolesForPerson(db, personId, data.oc_person_id).catch((e) => console.error('role sync failed', e))
}
