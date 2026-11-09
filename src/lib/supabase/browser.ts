'use client'
import { createBrowserClient, parseCookieHeader, serializeCookieHeader } from '@supabase/ssr'
import type { Database } from '@/lib/database.types'
import { SESSION_ONLY_COOKIE, withRemember } from './remember'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
    {
      cookies: {
        getAll() {
          return parseCookieHeader(document.cookie).map(({ name, value }) => ({ name, value: value ?? '' }))
        },
        setAll(cookiesToSet) {
          const sessionOnly = parseCookieHeader(document.cookie).some((c) => c.name === SESSION_ONLY_COOKIE)
          for (const { name, value, options } of cookiesToSet) {
            document.cookie = serializeCookieHeader(name, value, withRemember(options, sessionOnly))
          }
        },
      },
    },
  )
}
