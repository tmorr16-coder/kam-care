import type { Metadata } from 'next'
import { ExternalLink } from 'lucide-react'
import { requireMember } from '@/lib/auth'

export const metadata: Metadata = { title: 'Give' }

export default async function Give() {
  await requireMember()
  return (
    <div className="px-5 pt-10">
      <h1 className="font-serif text-[2rem] font-semibold">Give</h1>
      <p className="mt-2 text-[17px] text-ink-muted">Giving happens in KAM&apos;s OneChurch giving portal.</p>
      <a
        href="https://kam.onechurchsoftware.com"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-navy-800 py-4 text-lg font-semibold text-white hover:bg-navy-700"
      >
        Open the giving portal <ExternalLink className="size-5" aria-hidden />
      </a>
      <section className="mt-6 rounded-2xl border border-[#e5e2dc] bg-white p-6 text-[17px]">
        <h2 className="text-xl font-semibold">Your care never depends on giving</h2>
        <p className="mt-2 text-ink-muted">
          Care teams never see what you give. If you allow it under Privacy, a pastor may notice a change in your
          giving pattern and check on you, but it never leads to an ask.
        </p>
      </section>
    </div>
  )
}
