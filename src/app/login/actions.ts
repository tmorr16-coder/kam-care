'use server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { matchUserToPerson } from '@/lib/matching'
import { env } from '@/lib/env'

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
export async function passwordSignIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const { email, password, captchaToken } = creds(formData)
  if (!email || !password) return { error: 'Enter your email and password.' }
  const supabase = await createClient()
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
