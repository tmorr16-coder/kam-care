import type { Metadata } from 'next'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getViewer, homeFor } from '@/lib/auth'
import { Logo } from '@/components/ui'

export const metadata: Metadata = { title: 'Almost there' }

async function Status() {
  const v = await getViewer()
  if (!v) redirect('/login')
  // Staff can be matched with no OneChurch person (e.g. a hand-granted first admin). Stay here
  // rather than bounce back to /admin, so it's clear why the member view isn't available.
  if (v.matchStatus === 'matched' && v.personId) redirect(homeFor(v))
  return <p className="text-sm text-ink-muted">Signed in as {v.email ?? 'your account'}.</p>
}

export default function Unmatched() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <Logo size={72} />
      <h1 className="mt-6 font-serif text-3xl font-semibold">We&apos;re finding your church record</h1>
      <p className="mt-3 text-lg text-ink">
        Every KAM Care account is matched to your record in OneChurch. We couldn&apos;t match yours automatically, so
        Member Services is reviewing it. This usually happens when a family shares one email, or the email or mobile
        number on your account isn&apos;t in your OneChurch profile yet.
      </p>
      <div className="mt-6 rounded-xl border border-line bg-white p-5">
        <h2 className="font-semibold">What happens next</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px]">
          <li>Member Services will match your account, usually within a day or two.</li>
          <li>You can speed it up by updating your email or mobile in OneChurch at kam.onechurchsoftware.com.</li>
          <li>Need prayer or help right now? Call the church office or speak to any pastor.</li>
        </ul>
      </div>
      <div className="mt-6">
        <Suspense fallback={null}>
          <Status />
        </Suspense>
      </div>
      <form action="/auth/signout" method="post" className="mt-4">
        <button className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold hover:bg-canvas">Sign out</button>
      </form>
    </div>
  )
}
