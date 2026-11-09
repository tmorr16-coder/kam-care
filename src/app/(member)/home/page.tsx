import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight, User } from 'lucide-react'
import { requireMember } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Logo } from '@/components/ui'
import { CHURCH_TZ, addDays, todayISO } from '@/lib/dates'
import { CHECKIN_LABELS } from '@/lib/types'
import { CheckinCard } from '../checkin-card'

export const metadata: Metadata = { title: 'Home' }

function greeting() {
  const hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: CHURCH_TZ }).format(new Date()))
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
}

const HELP = [
  { href: '/pray', title: 'Prayer request', sub: 'Private or shared' },
  { href: '/pastor', title: 'Talk to a pastor', sub: 'Call back in 24h' },
  { href: '/help', title: 'Practical help', sub: 'Food, holiday, 211' },
  { href: '/counseling', title: 'Counseling', sub: 'Confidential' },
]

export default async function Home({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const v = await requireMember()
  const { sent } = await searchParams
  const supabase = await createClient()
  const weekAgo = addDays(todayISO(), -6)
  const { data: recent } = await supabase
    .from('checkins')
    .select('score, created_at')
    .eq('person_id', v.personId)
    .gte('created_at', weekAgo)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <div className="px-5 pt-8">
      <header className="mb-6 flex items-center gap-3">
        <Logo size={64} />
        <div className="min-w-0 flex-1">
          {v.campusName && <p className="text-[15px] text-ink-muted">{v.campusName === 'Global' ? 'Global Campus' : `${v.campusName} campus`}</p>}
          <h1 className="font-serif text-[1.7rem] leading-tight font-semibold text-balance">{greeting()}, {v.firstName ?? 'friend'}</h1>
        </div>
        <form action="/auth/signout" method="post">
          <button className="flex size-14 items-center justify-center rounded-full border border-line bg-white" aria-label="Sign out" title="Sign out">
            <User className="size-6" />
          </button>
        </form>
      </header>


      {sent === 'checkin' || recent ? (
        <section className="rounded-3xl bg-navy-900 p-6 text-white" aria-live="polite">
          <p className="text-sm font-semibold tracking-[0.12em] text-gold-500 uppercase">Weekly check-in</p>
          <h2 className="mt-2 text-2xl font-semibold">Thanks for checking in.</h2>
          <p className="mt-2 text-[17px] text-white/85">
            {recent ? `You said this week was ${CHECKIN_LABELS[recent.score].toLowerCase()}. ` : ''}
            Your care team sees your check-in. If you asked someone to reach out, they will.
          </p>
        </section>
      ) : (
        <CheckinCard />
      )}

      <h2 className="mt-8 mb-4 text-2xl font-semibold">How can we help?</h2>
      <div className="grid grid-cols-2 gap-3">
        {HELP.map((h) => (
          <Link key={h.href} href={h.href} className="min-h-32 rounded-2xl border border-[#e5e2dc] bg-white p-5 hover:border-navy-700">
            <span className="block text-xl font-semibold">{h.title}</span>
            <span className="mt-1 block text-[17px] text-ink-muted">{h.sub}</span>
          </Link>
        ))}
      </div>
      <Link href="/moment" className="mt-3 flex items-center justify-between rounded-2xl border border-[#e5e2dc] bg-white p-5 hover:border-navy-700">
        <span>
          <span className="block text-xl font-semibold">Share a life moment</span>
          <span className="mt-1 block text-[15px] text-ink-muted">Baby, wedding, promotion, loss</span>
        </span>
        <ChevronRight className="size-5 text-ink-muted" />
      </Link>
    </div>
  )
}
