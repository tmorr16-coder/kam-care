import 'server-only'
import { cookies } from 'next/headers'
import { connection } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@/lib/database.types'
import { env } from '@/lib/env'

/** Supabase client that acts as the signed-in user. Row-level security applies. */
export async function createClient() {
  // Supabase checks token expiry against the clock, so this must run per request.
  await connection()
  const cookieStore = await cookies()
  return createServerClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Called from a Server Component; the proxy refreshes the session instead.
        }
      },
    },
  })
}
