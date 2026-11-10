'use server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { matchUserToPerson } from '@/lib/matching'
import { env } from '@/lib/env'
import { SESSION_ONLY_COOKIE } from '@/lib/supabase/remember'
import { RESET_PATH } from './paths'

export type AuthState = { error?: string; message?: string } | undefined

function creds(formData: FormData) {
  return {
    email: String(formData.get('email') ?? '').trim().toLowerCase(),
    password: String(formData.get('password') ?? ''),
    // From the Cloudflare Turnstile box; Supabase verifies it when CAPTCHA protection is on.
    captchaToken: String(formData.get('cf-turnstile-response') ?? '') || undefined,
  }
}

function friendly(message: string) {
  return /captcha/i.test(message) ? 'Please complete the "I am human" check and try again.' : message
}

/** Email + password sign-in, used by both the member and admin sign-in pages. */
export async function passwordSignIn(prev: AuthState, formData: FormData): Promise<AuthState> {
  // The "Email me a sign-in link instead" button submits the same form.
  if (formData.get('intent') === 'link') return emailLink(prev, formData)
  const { email, password, captchaToken } = creds(formData)
  if (!email || !password) return { error: 'Enter your email and password.' }
  // "Keep me signed in" unticked: sign-in lasts until the browser closes.
  const sessionOnly = formData.get('remember') !== 'on'
  const cookieStore = await cookies()
  if (sessionOnly) cookieStore.set(SESSION_ONLY_COOKIE, '1', { path: '/', sameSite: 'lax', secure: true, httpOnly: false })
  else cookieStore.delete(SESSION_ONLY_COOKIE)
  const supabase = await createClient({ sessionOnly })
  const { data, error } = await supabase.auth.signInWithPassword({ email, password, options: { captchaToken } })
  if (error || !data.user) return { error: friendly(error?.message ?? 'Could not sign in.') }
  const status = await matchUserToPerson(data.user)
  if (status !== 'matched') redirect('/unmatched')
  redirect('/')
}

export async function emailLink(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const { email, captchaToken } = creds(formData)
  if (!email) return { error: 'Enter your email first.' }
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${env.siteUrl}/auth/callback`, shouldCreateUser: false, captchaToken },
  })
  if (error) return { error: friendly(error.message) }
  return { message: `Check ${email} for a sign-in link.` }
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const { email, password, captchaToken } = creds(formData)
  if (!email || password.length < 10) return { error: 'Use your email and a password of at least 10 characters.' }
  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${env.siteUrl}/auth/callback`, captchaToken },
  })
  if (error) return { error: friendly(error.message) }
  return { message: `We sent a confirmation link to ${email}. Open it to finish creating your account.` }
}

/** "Forgot password?": emails a link that opens the set-a-new-password page. */
export async function requestPasswordReset(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const { email, captchaToken } = creds(formData)
  if (!email) return { error: 'Enter your email first.' }
  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${env.siteUrl}/auth/callback?next=${encodeURIComponent(RESET_PATH)}`,
    captchaToken,
  })
  if (error) return { error: friendly(error.message) }
  // Same answer whether or not the account exists, so this can't be used to probe emails.
  return { message: `If ${email} has a KAM Care account, we sent it a link to reset your password.` }
}

/** Saves the new password chosen after following a reset link. */
export async function updatePassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const password = String(formData.get('password') ?? '')
  if (password.length < 10) return { error: 'Use a password of at least 10 characters.' }
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return { error: 'This reset link has expired. Ask for a new one from the sign-in page.' }
  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: error.message }
  const status = await matchUserToPerson(userData.user)
  if (status !== 'matched') redirect('/unmatched')
  redirect('/')
}
