'use client'
import { useActionState } from 'react'
import { buttonClass } from '@/components/ui'
import { confirmLink } from './actions'

export function ConfirmForm({ tokenHash, type, label }: { tokenHash: string; type: string; label: string }) {
  const [state, action, pending] = useActionState(confirmLink, undefined)
  if (state?.error) return <Expired />
  return (
    <form action={action}>
      <input type="hidden" name="token_hash" value={tokenHash} />
      <input type="hidden" name="type" value={type} />
      <button disabled={pending} className={buttonClass('primary', 'lg') + ' w-full rounded-xl'}>{pending ? 'One moment…' : label}</button>
    </form>
  )
}

export function Expired() {
  return (
    <p className="text-[15px] text-ink" role="alert">
      This link has expired or was already used. Ask your care team to send a new one, or{' '}
      <a href="/login" className="font-semibold text-navy-800 underline">go to sign in</a> and choose &ldquo;Forgot password?&rdquo;.
    </p>
  )
}
