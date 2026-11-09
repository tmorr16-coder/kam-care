import 'server-only'
import { cookies } from 'next/headers'
import { connection } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@/lib/database.types'
import { env } from '@/lib/env'
import { SESSION_ONLY_COOKIE, withRemember } from './remember'

/**
 * Supabase client that acts as the signed-in user. Row-level security applies.
 * `sessionOnly` overrides the "Keep me signed in" marker (used at password sign-in).
 */
export async function createClient(opts: { sessionOnly?: boolean } = {}) {
  // Supabase checks token expiry against the clock, so this must run per request.
  await connection()
  const cookieStore = await cookies()
  const sessionOnly = opts.sessionOnly ?? cookieStore.get(SESSION_ONLY_COOKIE)?.value === '1'
  return createServerClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, withRemember(options, sessionOnly)))
        } catch {
          // Called from a Server Component; the proxy refreshes the session instead.
        }
      },
    },
  })
}
