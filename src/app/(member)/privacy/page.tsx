import type { Metadata } from 'next'
import Link from 'next/link'
import { requireMember } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { BackHeader } from '../parts'
import { ConsentToggle } from './consent-toggle'
import type { ConsentField } from '../actions'

export const metadata: Metadata = { title: 'How we care for you' }

const ROWS: { field: ConsentField; title: string; sub: string }[] = [
  { field: 'weekly_checkin', title: 'Weekly check-in', sub: 'A one-tap question each week by text or app.' },
  { field: 'texts', title: 'Texts from my care team', sub: 'Preferred for quick, personal check-ins.' },
  { field: 'emails', title: 'Emails', sub: 'Announcements and follow-ups.' },
  { field: 'use_attendance', title: 'Use my attendance to check on me', sub: 'If I miss a few Sundays, someone reaches out.' },
  { field: 'celebrate_milestones', title: 'Celebrate my milestones', sub: 'Birthday, wedding and work anniversaries from my profile.' },
  { field: 'use_giving', title: 'Use giving changes to check on me', sub: 'Pastors see a change, never amounts. It never leads to an ask.' },
]

export default async function Privacy() {
  const v = await requireMember()
  const supabase = await createClient()
  const { data: c } = await supabase.from('consents').select('*').eq('person_id', v.personId).maybeSingle()
  const defaults: Record<ConsentField, boolean> = {
    weekly_checkin: false, texts: true, emails: true, use_attendance: true, celebrate_milestones: true, use_giving: false,
  }

  return (
    <div className="px-5 pt-8">
      <BackHeader title="How we care for you" sub="You choose what your care team can see and how they reach you. Change these anytime." />
      <div className="overflow-hidden rounded-2xl border border-[#e5e2dc] bg-white">
        {ROWS.map((r) => (
          <ConsentToggle key={r.field} {...r} initial={c ? Boolean(c[r.field]) : defaults[r.field]} />
        ))}
      </div>

      <section className="mt-6 rounded-2xl bg-navy-100 p-6">
        <h2 className="text-xl font-semibold">How your care team notices when life changes</h2>
        <p className="mt-2 text-[17px]">So no one in the KAM family goes unseen, KAM Care lets your care team know when:</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[17px]">
          <li>Your household changes in your church record, like a new baby or a loss</li>
          <li>You come on Sundays less often than usual (only if attendance is on above)</li>
          <li>Our texts or emails stop reaching you</li>
          <li>A care leader sees something you shared, like a new job or a hospital stay</li>
        </ul>
        <p className="mt-3 text-[17px]">
          We never read your private messages or log in to your social media. A person always decides how to reach out.
        </p>
        <Link href="/moment" className="mt-5 block w-full rounded-xl border border-navy-700/30 bg-white py-3 text-center text-[17px] font-semibold text-navy-800 hover:bg-canvas">
          Tell us about a life moment
        </Link>
      </section>
    </div>
  )
}
