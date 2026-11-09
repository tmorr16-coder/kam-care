import 'server-only'
import { cacheLife } from 'next/cache'
import { env } from '@/lib/env'

export type OAuthProvider = 'google' | 'facebook' | 'apple'
const ALL: OAuthProvider[] = ['google', 'facebook', 'apple']

/**
 * Sign-in providers switched on in Supabase (Authentication → Sign In / Providers), so the
 * login pages only show buttons that work. Re-checked every minute or so.
 */
export async function enabledProviders(): Promise<OAuthProvider[]> {
  'use cache'
  cacheLife('minutes')
  try {
    const res = await fetch(`${env.supabaseUrl}/auth/v1/settings`, { headers: { apikey: env.supabasePublishableKey } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const { external } = (await res.json()) as { external?: Record<string, boolean> }
    return ALL.filter((p) => external?.[p])
  } catch (e) {
    // Can't tell: show every button rather than none.
    console.error('auth settings unavailable', e)
    return ALL
  }
}
