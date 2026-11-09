import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { AppRole } from '@/lib/types'

export type Viewer = {
  userId: string
  email: string | null
  role: AppRole
  isAdmin: boolean
  personId: string | null
  campusId: string | null
  campusName: string | null
  firstName: string | null
  displayName: string | null
  title: string | null
  matchStatus: string
  aal: 'aal1' | 'aal2'
  needsMfa: boolean
  hasMfaFactor: boolean
  teamIds: string[]
}

/**
 * The signed-in user, their KAM Care role and whether they still owe a second factor.
 * Deduplicated per request.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  // Session checks read the clock (token expiry), so they must run per request.
  await connection()
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const claims = claimsData?.claims
  if (!claims?.sub) return null

  const [{ data: profile }, { data: aal }, { data: teamIds }] = await Promise.all([
    supabase
      .from('profiles')
      .select('role, is_admin, person_id, campus_id, match_status, campus:campuses(name), person:people(first_name, title, display_name)')
      .eq('user_id', claims.sub)
      .maybeSingle(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.rpc('my_team_ids'),
  ])

  const role = (profile?.role ?? 'member') as AppRole
  // Two-step verification is turned off for everyone (decided Nov 2026). To bring it back, set
  // this to e.g. `role === 'pastor' || role === 'staff'`; the /admin/mfa setup page still works.
  const mfaRequired = false
  const person = profile?.person as { first_name: string; title: string | null; display_name: string } | null

  return {
    userId: claims.sub,
    email: (claims.email as string | undefined) ?? null,
    role,
    isAdmin: profile?.is_admin ?? false,
    personId: profile?.person_id ?? null,
    campusId: profile?.campus_id ?? null,
    campusName: (profile?.campus as { name: string } | null)?.name ?? null,
    firstName: person?.first_name ?? null,
    displayName: person?.display_name ?? null,
    title: person?.title ?? null,
    matchStatus: profile?.match_status ?? 'pending',
    aal: (aal?.currentLevel ?? 'aal1') as 'aal1' | 'aal2',
    needsMfa: mfaRequired && aal?.currentLevel !== 'aal2',
    hasMfaFactor: aal?.nextLevel === 'aal2',
    teamIds: ((teamIds as string[] | null) ?? []).filter(Boolean),
  }
})

const ADMIN_ROLES: AppRole[] = ['staff', 'pastor']

/** Sends people to the right home for their role. */
export function homeFor(v: Viewer) {
  if (v.matchStatus !== 'matched') return '/unmatched'
  if (ADMIN_ROLES.includes(v.role)) return '/admin'
  if (v.role === 'care_leader') return '/leader'
  return '/home'
}

export async function requireViewer(): Promise<Viewer> {
  const v = await getViewer()
  if (!v) redirect('/login')
  if (v.matchStatus !== 'matched') redirect('/unmatched')
  return v
}

export async function requireMember(): Promise<Viewer & { personId: string }> {
  const v = await requireViewer()
  if (!v.personId) redirect('/unmatched')
  return v as Viewer & { personId: string }
}

export async function requireLeader(): Promise<Viewer> {
  const v = await requireViewer()
  if (v.role === 'member') redirect('/home')
  if (v.needsMfa) redirect('/admin/mfa')
  return v
}

/** Admin portal: staff and pastors, with two-step verification done. */
export async function requireStaff(opts: { pastor?: boolean; admin?: boolean } = {}): Promise<Viewer> {
  const v = await getViewer()
  if (!v) redirect('/admin/login')
  if (v.matchStatus !== 'matched') redirect('/unmatched')
  if (!ADMIN_ROLES.includes(v.role)) redirect(homeFor(v))
  if (v.needsMfa) redirect('/admin/mfa')
  if (opts.pastor && v.role !== 'pastor') redirect('/admin')
  if (opts.admin && !v.isAdmin) redirect('/admin')
  return v
}

/** For server actions: same checks, but throws instead of redirecting. */
export async function assertStaff(opts: { pastor?: boolean; admin?: boolean } = {}) {
  const v = await getViewer()
  if (!v || v.matchStatus !== 'matched' || !ADMIN_ROLES.includes(v.role) || v.needsMfa) throw new Error('Not allowed')
  if (opts.pastor && v.role !== 'pastor') throw new Error('Pastors only')
  if (opts.admin && !v.isAdmin) throw new Error('Admins only')
  return v
}
