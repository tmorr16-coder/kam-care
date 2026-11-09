import type { Metadata } from 'next'
import { requireMember } from '@/lib/auth'
import { submitPastorCall } from '../actions'
import { BackHeader, StickySubmit, submitClass, textareaClass } from '../parts'

export const metadata: Metadata = { title: 'Talk to a pastor' }

export default async function Pastor() {
  await requireMember()
  return (
    <div className="px-5 pt-8">
      <BackHeader title="Talk to a pastor" sub="A pastor will call you back within 24 hours. What you share stays with the pastoral team." />
      <form action={submitPastorCall}>
        <label className="block">
          <span className="mb-3 block text-[17px] font-semibold">Anything you&apos;d like them to know first? (optional)</span>
          <textarea name="body" rows={4} maxLength={2000} className={textareaClass} />
        </label>
        <p className="mt-4 text-[15px] text-ink-muted">
          If you or someone else is in danger right now, call 911. For a mental health crisis, call or text 988.
        </p>
        <StickySubmit>
          <button className={submitClass}>Request a call back</button>
        </StickySubmit>
      </form>
    </div>
  )
}
