import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

export type LoginStatus =
  | { state: 'none'; email: string | null }
  | { state: 'invited'; email: string; userId: string; invitedAt: string | null }
  | { state: 'active'; email: string; userId: string; lastSignInAt: string | null }

/**
 * Whether a person can sign in to KAM Care. Looks first for a sign-in already linked to them
 * (which may use a different email, e.g. Google), then for one under their OneChurch email.
 *
 * "Active" means they've set a password or use Google etc. A sign-in without either is still
 * "invited", even if the link was opened (mail scanners open links without anyone finishing setup).
 */
export async function getLoginStatus(personId: string, personEmail: string | null): Promise<LoginStatus> {
  const db = createAdminClient()

  let email = personEmail
  const { data: profile } = await db.from('profiles').select('user_id').eq('person_id', personId).maybeSingle()
  if (profile) {
    const { data } = await db.auth.admin.getUserById(profile.user_id)
    if (data.user?.email) email = data.user.email
  }

  if (!email) return { state: 'none', email: null }
  const { data: rows } = await db.rpc('login_for_email', { p_email: email })
  const u = rows?.[0]
  if (!u) return { state: 'none', email }
  if (u.has_password || u.other_providers) return { state: 'active', email: u.email, userId: u.user_id, lastSignInAt: u.last_sign_in_at }
  return { state: 'invited', email: u.email, userId: u.user_id, invitedAt: u.invited_at }
}
