'use client'
import { useActionState, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { buttonClass, inputClass } from '@/components/ui'
import { Turnstile } from '@/components/turnstile'
import { passwordSignIn, requestPasswordReset, signUp, updatePassword, type AuthState } from './actions'

function Notice({ state }: { state: AuthState }) {
  if (state?.error) return <p className="text-sm text-urgent" role="alert">{state.error}</p>
  if (state?.message) return <p className="text-sm text-ok" role="status">{state.message}</p>
  return null
}

function RememberMe() {
  return (
    <label className="flex items-center gap-2 text-[15px] text-ink">
      <input type="checkbox" name="remember" defaultChecked className="size-4" />
      Keep me signed in
    </label>
  )
}

/** Password box with an eye button to show or hide what's typed. */
export function PasswordInput({ className = '', ...props }: React.ComponentProps<'input'>) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <input name="password" required {...props} type={visible ? 'text' : 'password'} className={`${inputClass} pr-12 ${className}`} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-ink-muted hover:text-ink"
      >
        {visible ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
      </button>
    </div>
  )
}

const linkClass = 'text-sm font-semibold text-navy-800 underline-offset-2 hover:underline'

/** Email + password, with "Forgot password?" and (for members) "Email me a sign-in link instead". */
function SignInForm({ big, allowLink, onForgot }: { big: boolean; allowLink: boolean; onForgot: () => void }) {
  const [state, action, pending] = useActionState(passwordSignIn, undefined)
  const field = big ? ' py-3 text-base' : ''
  return (
    <form action={action} className="space-y-3">
      <input name="email" type="email" autoComplete="email" required placeholder="Email" aria-label="Email" className={inputClass + field} />
      <PasswordInput autoComplete="current-password" placeholder="Password" aria-label="Password" className={field} />
      <div className="flex items-center justify-between gap-3">
        <RememberMe />
        <button type="button" onClick={onForgot} className={linkClass}>Forgot password?</button>
      </div>
      <Turnstile resetKey={state} />
      <Notice state={state} />
      <button disabled={pending} className={buttonClass('primary', big ? 'lg' : 'md') + ' w-full rounded-xl'}>
        {pending ? 'Please wait…' : 'Sign in'}
      </button>
      {allowLink && (
        <button type="submit" name="intent" value="link" formNoValidate disabled={pending} className={linkClass + ' block w-full text-center'}>
          No password? Email me a sign-in link instead
        </button>
      )}
    </form>
  )
}

function ForgotPasswordForm({ big, onBack }: { big: boolean; onBack: () => void }) {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined)
  return (
    <form action={action} className="space-y-3">
      <h2 className="text-lg font-semibold">Reset your password</h2>
      <p className="text-[15px] text-ink-muted">Enter your email and we&apos;ll send you a link to choose a new password.</p>
      <input name="email" type="email" autoComplete="email" required placeholder="Email" aria-label="Email" className={inputClass + (big ? ' py-3 text-base' : '')} />
      <Turnstile resetKey={state} />
      <Notice state={state} />
      <button disabled={pending} className={buttonClass('primary', big ? 'lg' : 'md') + ' w-full rounded-xl'}>
        {pending ? 'Sending…' : 'Send reset link'}
      </button>
      <button type="button" onClick={onBack} className={linkClass + ' block w-full text-center'}>Back to sign in</button>
    </form>
  )
}

function SignUpForm({ onBack }: { onBack: () => void }) {
  const [state, action, pending] = useActionState(signUp, undefined)
  return (
    <form action={action} className="space-y-3">
      <h2 className="text-lg font-semibold">Create a KAM Care account</h2>
      <input name="email" type="email" autoComplete="email" required placeholder="Email" aria-label="Email" className={inputClass + ' py-3 text-base'} />
      <PasswordInput autoComplete="new-password" minLength={10} placeholder="Password (10+ characters)" aria-label="Password" className="py-3 text-base" />
      <Turnstile resetKey={state} />
      <Notice state={state} />
      <button disabled={pending} className={buttonClass('primary', 'lg') + ' w-full rounded-xl'}>{pending ? 'Creating…' : 'Create account'}</button>
      <button type="button" onClick={onBack} className={linkClass + ' block w-full text-center'}>I already have an account</button>
    </form>
  )
}

export function MemberEmailForms() {
  const [mode, setMode] = useState<'signin' | 'forgot' | 'signup'>('signin')
  if (mode === 'forgot') return <ForgotPasswordForm big onBack={() => setMode('signin')} />
  if (mode === 'signup') return <SignUpForm onBack={() => setMode('signin')} />
  return (
    <>
      <SignInForm big allowLink onForgot={() => setMode('forgot')} />
      <button type="button" onClick={() => setMode('signup')} className="mt-6 w-full border-t border-line pt-5 text-center text-[17px] font-semibold text-navy-800">
        New here? Create a KAM Care account
      </button>
    </>
  )
}

export function AdminPasswordForm() {
  const [forgot, setForgot] = useState(false)
  return (
    <div className="rounded-lg border border-line bg-white p-4">
      {forgot ? (
        <ForgotPasswordForm big={false} onBack={() => setForgot(false)} />
      ) : (
        <SignInForm big={false} allowLink={false} onForgot={() => setForgot(true)} />
      )}
    </div>
  )
}

/** Shown after following a password-reset email link. */
export function NewPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, undefined)
  return (
    <form action={action} className="space-y-3">
      <PasswordInput autoComplete="new-password" minLength={10} placeholder="New password (10+ characters)" aria-label="New password" className="py-3 text-base" />
      <Notice state={state} />
      <button disabled={pending} className={buttonClass('primary', 'lg') + ' w-full rounded-xl'}>{pending ? 'Saving…' : 'Save new password'}</button>
    </form>
  )
}
