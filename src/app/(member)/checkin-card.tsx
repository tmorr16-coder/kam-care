'use client'
import { useState } from 'react'
import { useFormStatus } from 'react-dom'
import clsx from 'clsx'
import { submitCheckin } from './actions'

const OPTIONS = [
  { score: 5, label: 'Great' },
  { score: 4, label: 'Good' },
  { score: 3, label: 'Okay' },
  { score: 2, label: 'Hard' },
  { score: 1, label: 'Very hard' },
]

function Submit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus()
  return (
    <button disabled={disabled || pending} className="w-full rounded-xl bg-navy-800 py-4 text-lg font-semibold text-white hover:bg-navy-700 disabled:opacity-60">
      {pending ? 'Sending…' : 'Send check-in'}
    </button>
  )
}

export function CheckinCard() {
  const [score, setScore] = useState<number | null>(null)
  return (
    <form action={submitCheckin} className="rounded-3xl bg-navy-900 p-6 text-white">
      <p className="text-sm font-semibold tracking-[0.12em] text-gold-500 uppercase">Weekly check-in</p>
      <h2 className="mt-2 text-2xl font-semibold">How&apos;s your week going?</h2>
      <fieldset className="mt-5">
        <legend className="sr-only">How&apos;s your week going?</legend>
        <div className="grid grid-cols-5 gap-2">
          {OPTIONS.map((o) => (
            <label
              key={o.score}
              className={clsx(
                'flex min-h-20 cursor-pointer items-center justify-center rounded-xl border-2 px-1 text-center text-[15px] leading-tight font-semibold transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-white',
                score === o.score ? 'border-white bg-white text-navy-900' : 'border-navy-700 bg-navy-800 text-white hover:bg-navy-700',
              )}
            >
              <input type="radio" name="score" value={o.score} className="sr-only" checked={score === o.score} onChange={() => setScore(o.score)} />
              {o.label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="mt-5 block">
        <span className="text-[17px] text-white/85">Want to share more? Only your care team will see it.</span>
        <textarea name="note" rows={3} maxLength={1000} className="mt-3 w-full rounded-xl border border-navy-700 bg-navy-800 p-3 text-white placeholder:text-white/40 focus:border-white focus:outline-none" />
      </label>
      <label className="mt-4 flex items-center gap-3 text-[17px]">
        <input type="checkbox" name="wants_contact" defaultChecked={false} className="size-6 accent-[#4a90d9]" />
        Have someone from my care team reach out
      </label>
      <div className="mt-6">
        <Submit disabled={score === null} />
      </div>
    </form>
  )
}
