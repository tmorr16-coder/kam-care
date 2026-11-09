import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { matchUserToPerson } from '@/lib/matching'

/** OAuth / magic-link return. Exchanges the code, matches the user to OneChurch, routes by role. */
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

  const status = await matchUserToPerson(data.user)
  if (status !== 'matched') return NextResponse.redirect(new URL('/unmatched', url.origin))
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
  return NextResponse.redirect(new URL(safeNext, url.origin))
}
