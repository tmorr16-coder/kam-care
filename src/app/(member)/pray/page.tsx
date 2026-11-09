import type { Metadata } from 'next'
import { requireMember } from '@/lib/auth'
import { submitPrayer } from '../actions'
import { BackHeader, ErrorNote, StickySubmit, chipClass, optionCardClass, submitClass, textareaClass } from '../parts'

export const metadata: Metadata = { title: 'Prayer request' }

const TOPICS = ['Health', 'Family', 'Work & finances', 'Grief', 'Spiritual growth', 'Salvation of a loved one', 'Thanksgiving']
const WHO = [
  { value: 'pastors', title: 'Pastors only', sub: 'Private. Only the pastoral team sees it.' },
  { value: 'prayer_team', title: 'Prayer team', sub: 'Our intercessors pray by first name only.' },
  { value: 'church', title: 'Church family', sub: 'Shared on Tuesday Bible Study prayer list.' },
]

export default async function Pray({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireMember()
  return (
    <div className="px-5 pt-8">
      <BackHeader title="How can we pray with you?" sub="Your request goes to the KAM prayer team. You choose who sees it." />
      <ErrorNote searchParams={searchParams} messages={{ empty: 'Tell us what to pray about.' }} />
      <form action={submitPrayer}>
        <fieldset>
          <legend className="mb-3 text-[17px] font-semibold">It&apos;s about</legend>
          <div className="flex flex-wrap gap-2.5">
            {TOPICS.map((t) => (
              <label key={t} className={chipClass}>
                <input type="radio" name="topic" value={t} className="sr-only" />
                {t}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="mt-6 block">
          <span className="mb-3 block text-[17px] font-semibold">Your request</span>
          <textarea name="body" rows={4} required maxLength={2000} className={textareaClass} />
        </label>
        <fieldset className="mt-6">
          <legend className="mb-3 text-[17px] font-semibold">Who can see it</legend>
          <div className="space-y-3">
            {WHO.map((w, i) => (
              <label key={w.value} className={optionCardClass}>
                <input type="radio" name="visibility" value={w.value} defaultChecked={i === 0} className="sr-only" />
                <span className="block text-lg font-semibold">{w.title}</span>
                <span className="block text-[15px] text-ink-muted">{w.sub}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="mt-5 flex items-center gap-3 text-[17px]">
          <input type="checkbox" name="wants_call" className="size-6 accent-[#0b4373]" />
          I&apos;d like a pastor or minister to call me
        </label>
        <StickySubmit>
          <button className={submitClass}>Send prayer request</button>
        </StickySubmit>
      </form>
    </div>
  )
}
