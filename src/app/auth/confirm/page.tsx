import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Logo } from '@/components/ui'
import { ConfirmForm, Expired } from './confirm-form'
import { LINK_TYPES, type LinkType } from './types'

export const metadata: Metadata = { title: 'KAM Care' }

const COPY: Record<LinkType, { title: string; body: string; button: string }> = {
  invite: { title: 'Welcome to KAM Care', body: 'You’ve been invited to KAM Care. Tap below to choose your password.', button: 'Set my password' },
  recovery: { title: 'Reset your password', body: 'Tap below to choose a new password.', button: 'Choose a new password' },
  magiclink: { title: 'Sign in to KAM Care', body: 'Tap below to finish signing in.', button: 'Sign me in' },
  signup: { title: 'Confirm your email', body: 'Tap below to finish creating your account.', button: 'Confirm and sign in' },
  email: { title: 'Sign in to KAM Care', body: 'Tap below to finish signing in.', button: 'Continue' },
}

type Search = Promise<{ token_hash?: string; type?: string }>

async function Body({ searchParams }: { searchParams: Search }) {
  const { token_hash: tokenHash, type } = await searchParams
  if (!tokenHash || !type || !LINK_TYPES.includes(type as LinkType)) {
    return (
      <>
        <h1 className="mt-6 mb-2 font-serif text-3xl font-semibold">This link isn’t working</h1>
        <Expired />
      </>
    )
  }
  const copy = COPY[type as LinkType]
  return (
    <>
      <h1 className="mt-6 mb-2 font-serif text-3xl font-semibold">{copy.title}</h1>
      <p className="mb-6 text-[15px] text-ink">{copy.body}</p>
      <ConfirmForm tokenHash={tokenHash} type={type} label={copy.button} />
    </>
  )
}

/**
 * Where invite, password reset and sign-in link emails land (see the Supabase email templates).
 * The link is only used when the person presses the button: Microsoft 365 and other mail
 * scanners open every link in an email, and would otherwise use it up before the person can.
 */
export default function Confirm({ searchParams }: { searchParams: Search }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <Logo size={72} />
      <Suspense fallback={null}>
        <Body searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
