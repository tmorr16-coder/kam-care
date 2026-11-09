import type { Metadata } from 'next'
import { requireMember } from '@/lib/auth'
import { submitCounseling } from '../actions'
import { BackHeader, StickySubmit, submitClass, textareaClass } from '../parts'

export const metadata: Metadata = { title: 'Counseling' }

export default async function Counseling() {
  await requireMember()
  return (
    <div className="px-5 pt-8">
      <BackHeader
        title="Confidential counseling"
        sub="KAM Counseling Services will reach out to set up a time. Only the counseling team and pastors know you asked."
      />
      <form action={submitCounseling}>
        <label className="block">
          <span className="mb-3 block text-[17px] font-semibold">What would you like help with? (optional)</span>
          <textarea name="body" rows={4} maxLength={2000} className={textareaClass} />
        </label>
        <p className="mt-4 text-[15px] text-ink-muted">
          If you or someone else is in danger right now, call 911. For a mental health crisis, call or text 988.
        </p>
        <StickySubmit>
          <button className={submitClass}>Ask for counseling</button>
        </StickySubmit>
      </form>
    </div>
  )
}
