import type { Metadata } from 'next'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getViewer, homeFor } from '@/lib/auth'
import { Logo } from '@/components/ui'
import { MfaClient } from './mfa-client'

export const metadata: Metadata = { title: 'Two-step verification' }

async function Gate() {
  const v = await getViewer()
  if (!v) redirect('/admin/login')
  if (!v.needsMfa) redirect(homeFor(v))
  return (
    <>
      <p className="mb-5 text-sm text-ink-muted">
        Signed in as {v.email}. {v.hasMfaFactor ? '' : 'Pastors, staff and volunteer leaders with a KAM Care password set this up once.'}
      </p>
      <MfaClient />
    </>
  )
}

export default function MfaPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-6 py-12">
      <div className="w-full max-w-md rounded-xl border border-line bg-white p-7">
        <div className="mb-5 flex items-center gap-3">
          <Logo size={44} />
          <h1 className="font-serif text-2xl font-semibold">Two-step verification</h1>
        </div>
        <Suspense fallback={<p className="text-ink-muted">Loading…</p>}>
          <Gate />
        </Suspense>
        <form action="/auth/signout" method="post" className="mt-6 border-t border-line pt-4">
          <button className="text-sm text-ink-muted hover:text-ink">Sign out</button>
        </form>
      </div>
    </div>
  )
}
