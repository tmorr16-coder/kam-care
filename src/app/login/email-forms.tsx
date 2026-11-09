'use client'
import { useActionState, useState } from 'react'
import { Mail } from 'lucide-react'
import { buttonClass, inputClass } from '@/components/ui'
import { Turnstile } from '@/components/turnstile'
import { emailLink, passwordSignIn, signUp } from './actions'

function Notice({ state }: { state: { error?: string; message?: string } | undefined }) {
  if (state?.error) return <p className="text-sm text-urgent" role="alert">{state.error}</p>
  if (state?.message) return <p className="text-sm text-ok" role="status">{state.message}</p>
  return null
}

export function MemberEmailForms() {
  const [mode, setMode] = useState<'closed' | 'signin' | 'signup'>('closed')
  const [signInState, signInAction, signingIn] = useActionState(passwordSignIn, undefined)
  const [linkState, linkAction, linking] = useActionState(emailLink, undefined)
  const [signUpState, signUpAction, signingUp] = useActionState(signUp, undefined)

  if (mode === 'closed') {
    return (
      <>
        <button type="button" onClick={() => setMode('signin')} className={buttonClass('primary', 'lg') + ' w-full rounded-xl py-4 text-lg'}>
          <Mail className="size-5" /> Sign in with email
        </button>
        <button type="button" onClick={() => setMode('signup')} className="mt-5 w-full text-center text-[17px] font-semibold text-navy-800">
          Create a KAM Care account
        </button>
      </>
    )
  }

  if (mode === 'signup') {
    return (
      <form action={signUpAction} className="space-y-3">
        <h2 className="text-lg font-semibold">Create a KAM Care account</h2>
        <input name="email" type="email" autoComplete="email" required placeholder="Email" className={inputClass + ' py-3 text-base'} />
        <input name="password" type="password" autoComplete="new-password" required minLength={10} placeholder="Password (10+ characters)" className={inputClass + ' py-3 text-base'} />
        <Turnstile resetKey={signUpState} />
        <Notice state={signUpState} />
        <button disabled={signingUp} className={buttonClass('primary', 'lg') + ' w-full rounded-xl'}>{signingUp ? 'Creating…' : 'Create account'}</button>
        <button type="button" onClick={() => setMode('signin')} className="w-full text-center text-sm font-semibold text-navy-800">I already have an account</button>
      </form>
    )
  }

  return (
    <div className="space-y-3">
      <form action={signInAction} className="space-y-3">
        <h2 className="text-lg font-semibold">Sign in with email</h2>
        <input name="email" type="email" autoComplete="email" required placeholder="Email" className={inputClass + ' py-3 text-base'} />
        <input name="password" type="password" autoComplete="current-password" required placeholder="Password" className={inputClass + ' py-3 text-base'} />
        <Turnstile resetKey={signInState} />
        <Notice state={signInState} />
        <button disabled={signingIn} className={buttonClass('primary', 'lg') + ' w-full rounded-xl'}>{signingIn ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <form action={linkAction} className="space-y-2 border-t border-line pt-3">
        <p className="text-sm text-ink-muted">No password? We can email you a sign-in link.</p>
        <input name="email" type="email" autoComplete="email" required placeholder="Email" className={inputClass + ' py-3 text-base'} />
        <Turnstile resetKey={linkState} />
        <Notice state={linkState} />
        <button disabled={linking} className={buttonClass('secondary', 'md') + ' w-full rounded-xl'}>{linking ? 'Sending…' : 'Email me a sign-in link'}</button>
      </form>
      <button type="button" onClick={() => setMode('signup')} className="w-full text-center text-sm font-semibold text-navy-800">Create a KAM Care account</button>
    </div>
  )
}

export function AdminPasswordForm() {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState(passwordSignIn, undefined)
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={buttonClass('primary', 'lg') + ' w-full rounded-lg'}>
        <LockIcon /> Sign in with a KAM Care account
      </button>
    )
  }
  return (
    <form action={action} className="space-y-3 rounded-lg border border-line bg-white p-4">
      <input type="hidden" name="portal" value="admin" />
      <input name="email" type="email" autoComplete="email" required placeholder="Email" className={inputClass} />
      <input name="password" type="password" autoComplete="current-password" required placeholder="Password" className={inputClass} />
      <Turnstile resetKey={state} />
      <Notice state={state} />
      <button disabled={pending} className={buttonClass('primary', 'md') + ' w-full'}>{pending ? 'Signing in…' : 'Continue'}</button>
    </form>
  )
}

function LockIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-4" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="4" y="9" width="12" height="9" rx="2" />
      <path d="M7 9V6.5a3 3 0 0 1 6 0V9" />
    </svg>
  )
}
