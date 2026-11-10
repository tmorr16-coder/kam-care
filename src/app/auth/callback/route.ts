import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { matchUserToPerson } from '@/lib/matching'
import { RESET_PATH } from '@/app/login/paths'

/** OAuth / magic-link / password-reset return. Exchanges the code, matches the user to OneChurch, routes by role. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next')
  const supabase = await createClient()

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin))
  }
  const { data } = await supabase.auth.getUser()
  if (!data.user) return NextResponse.redirect(new URL('/login', url.origin))

  // Password reset: choose the new password first; matching happens when it's saved.
  if (next === RESET_PATH) return NextResponse.redirect(new URL(RESET_PATH, url.origin))

  const status = await matchUserToPerson(data.user)
  if (status !== 'matched') return NextResponse.redirect(new URL('/unmatched', url.origin))
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
  return NextResponse.redirect(new URL(safeNext, url.origin))
}
