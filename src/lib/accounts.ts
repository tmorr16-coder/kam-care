import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

export type LoginStatus =
  | { state: 'none'; email: string | null }
  | { state: 'invited'; email: string; userId: string; invitedAt: string | null }
  | { state: 'active'; email: string; userId: string; lastSignInAt: string | null }

/**
 * Whether a person can sign in to KAM Care.
 *
 * "Active" means they finished setting up: saving a password or signing in runs OneChurch
 * matching, which moves their profile out of "pending". Opening an invite link isn't enough,
 * because Microsoft 365 and other mail scanners open links without anyone finishing setup.
 * (Supabase also gives invited users a random password, so "has a password" doesn't tell us.)
 */
export async function getLoginStatus(personId: string, personEmail: string | null): Promise<LoginStatus> {
  const db = createAdminClient()

  // Already linked to this person: they finished setup, possibly under a different email (e.g. Google).
  const { data: linked } = await db.from('profiles').select('user_id').eq('person_id', personId).maybeSingle()
  if (linked) {
    const { data } = await db.auth.admin.getUserById(linked.user_id)
    if (data.user?.email) return { state: 'active', email: data.user.email, userId: data.user.id, lastSignInAt: data.user.last_sign_in_at ?? null }
  }

  if (!personEmail) return { state: 'none', email: null }
  const { data: rows } = await db.rpc('login_for_email', { p_email: personEmail })
  const u = rows?.[0]
  if (!u) return { state: 'none', email: personEmail }

  const { data: profile } = await db.from('profiles').select('match_status').eq('user_id', u.user_id).maybeSingle()
  const finished = profile && profile.match_status !== 'pending'
  if (finished || u.other_providers) return { state: 'active', email: u.email, userId: u.user_id, lastSignInAt: u.last_sign_in_at }
  return { state: 'invited', email: u.email, userId: u.user_id, invitedAt: u.invited_at }
}
