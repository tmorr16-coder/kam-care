import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

export type LoginStatus =
  | { state: 'none'; email: string | null }
  | { state: 'invited'; email: string; userId: string; invitedAt: string | null }
  | { state: 'active'; email: string; userId: string; lastSignInAt: string | null }

/**
 * Whether a person can sign in to KAM Care. Looks first for a sign-in already linked to them
 * (which may use a different email, e.g. Google), then for one under their OneChurch email.
 */
export async function getLoginStatus(personId: string, personEmail: string | null): Promise<LoginStatus> {
  const db = createAdminClient()

  const { data: profile } = await db.from('profiles').select('user_id').eq('person_id', personId).maybeSingle()
  if (profile) {
    const { data } = await db.auth.admin.getUserById(profile.user_id)
    if (data.user?.email) return { state: 'active', email: data.user.email, userId: data.user.id, lastSignInAt: data.user.last_sign_in_at ?? null }
  }

  if (!personEmail) return { state: 'none', email: null }
  const { data: rows } = await db.rpc('login_for_email', { p_email: personEmail })
  const u = rows?.[0]
  if (!u) return { state: 'none', email: personEmail }
  if (!u.last_sign_in_at) return { state: 'invited', email: u.email, userId: u.user_id, invitedAt: u.invited_at }
  return { state: 'active', email: u.email, userId: u.user_id, lastSignInAt: u.last_sign_in_at }
}
