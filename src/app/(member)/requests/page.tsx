import type { Metadata } from 'next'
import clsx from 'clsx'
import { requireMember } from '@/lib/auth'
import { getMemberRequests, getRatingPrompt } from '@/lib/data/portal'
import { rateTouch } from '../actions'

export const metadata: Metadata = { title: 'My requests' }

const TONES = {
  warn: 'bg-high-bg text-high',
  ok: 'bg-ok-bg text-ok',
  navy: 'bg-navy-100 text-navy-900',
  neutral: 'bg-[#eef0f3] text-ink-muted',
}

const SENT: Record<string, string> = {
  prayer: 'Your prayer request is in. The prayer team is praying with you.',
  help: 'Your request went to the benevolence team. Someone will reach out the way you asked.',
  pastor: 'A pastor will call you back within 24 hours.',
  counseling: 'Counseling Services will reach out to set up a time.',
  moment: 'Thanks for sharing. Your care team has it.',
}

export default async function Requests({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const v = await requireMember()
  const { sent } = await searchParams
  const [cards, rating] = await Promise.all([getMemberRequests(v.personId), getRatingPrompt(v.personId)])

  return (
    <div className="px-5 pt-10">
      <h1 className="mb-6 font-serif text-[2rem] font-semibold">My requests</h1>
      {sent && SENT[sent] && (
        <p className="mb-5 rounded-xl bg-ok-bg px-5 py-4 text-[17px] text-ok" role="status">{SENT[sent]}</p>
      )}
      {!cards.length && (
        <p className="rounded-2xl border border-[#e5e2dc] bg-white p-6 text-[17px] text-ink-muted">
          Nothing here yet. When you send a prayer request, ask for help or share a life moment, you can follow it here.
        </p>
      )}
      <div className="space-y-5">
        {cards.map((c) => (
          <article key={c.id} className="rounded-2xl border border-[#e5e2dc] bg-white p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">{c.title}</h2>
                <p className="mt-0.5 text-[16px] text-ink-muted">{c.sub}</p>
              </div>
              <span className={clsx('shrink-0 rounded-full px-3 py-1 text-[15px] font-semibold', TONES[c.status.tone])}>{c.status.label}</span>
            </div>
            <ol className="mt-4 space-y-2.5">
              {c.steps.map((s, i) => (
                <li key={i} className={clsx('flex items-center gap-3 text-[17px]', !s.done && 'text-ink-muted')}>
                  <span
                    className={clsx('size-5 shrink-0 rounded-full', s.done ? 'bg-navy-800' : 'border-2 border-[#c9ccd6] bg-white')}
                    aria-hidden
                  />
                  <span>
                    <span className="sr-only">{s.done ? 'Done: ' : 'Coming up: '}</span>
                    {s.label}
                  </span>
                </li>
              ))}
            </ol>
          </article>
        ))}

        {rating && (
          <section className="rounded-2xl bg-navy-900 p-6 text-white">
            <h2 className="text-xl font-semibold">How did {rating.who}&apos;s {rating.what} go?</h2>
            <form action={rateTouch} className="mt-4 grid grid-cols-5 gap-2.5">
              <input type="hidden" name="touch_id" value={rating.touchId} />
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  name="rating"
                  value={n}
                  className="rounded-xl border border-navy-700 bg-navy-800 py-5 text-2xl font-semibold hover:bg-navy-700"
                  aria-label={`${n} out of 5`}
                >
                  {n}
                </button>
              ))}
            </form>
            <p className="mt-4 text-[16px] text-white/75">Your rating helps us care better. Only the pastoral team sees it.</p>
          </section>
        )}
      </div>
    </div>
  )
}
