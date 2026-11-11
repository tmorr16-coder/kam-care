'use client'
import { useEffect, useState } from 'react'
import { Logo } from '@/components/ui'
import { createClient } from '@/lib/supabase/browser'
import { RESET_PATH } from '@/app/login/paths'

/** Returns a problem to show, or null once it has sent the person on. */
async function accept(): Promise<string | null> {
  const params = new URLSearchParams(window.location.hash.slice(1))
  // Drop the tokens from the address bar and history right away.
  history.replaceState(null, '', window.location.pathname)

  const accessToken = params.get('access_token')
  const refreshToken = params.get('refresh_token')
  if (!accessToken || !refreshToken) {
    return params.get('error_code') === 'otp_expired' || !params.get('error_description') ? 'expired' : params.get('error_description')
  }
  const { error } = await createClient().auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
  if (error) return error.message
  window.location.replace(params.get('type') === 'invite' ? `${RESET_PATH}?welcome=1` : RESET_PATH)
  return null
}

/**
 * Landing page for invite and staff-sent password reset emails. Those links carry the sign-in
 * in the URL fragment (#access_token=…), which only the browser can read, so this page saves
 * the session and then sends the person to choose a password.
 */
export default function AcceptInvite() {
  const [problem, setProblem] = useState<string | null>(null)

  useEffect(() => {
    accept().then((p) => p && setProblem(p))
  }, [])

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <Logo size={72} />
      {problem ? (
        <>
          <h1 className="mt-6 mb-2 font-serif text-3xl font-semibold">This link has expired</h1>
          <p className="text-[15px] text-ink">
            {problem === 'expired' ? 'It may have been used already, or it’s more than a day old.' : problem}{' '}
            Ask your care team to send a new one, or <a href="/login" className="font-semibold text-navy-800 underline">go to sign in</a> and choose &ldquo;Forgot password?&rdquo;.
          </p>
        </>
      ) : (
        <p className="mt-6 text-[15px] text-ink-muted" role="status">Signing you in…</p>
      )}
    </div>
  )
}
