import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'
import type { Database } from '@/lib/database.types'

/**
 * Service-role client. Bypasses row-level security, so use it only for system work
 * (OneChurch sync, the care engine, cron) or after checking the caller's access yourself.
 */
export function createAdminClient() {
  return createClient<Database>(env.supabaseUrl, env.supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
