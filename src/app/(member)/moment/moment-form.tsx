'use client'
import { useState } from 'react'
import { useFormStatus } from 'react-dom'
import clsx from 'clsx'
import { submitMoment } from '../actions'
import { StickySubmit, submitClass, textareaClass } from '../parts'

const TYPES = [
  { value: 'birth', label: 'New baby', happy: true },
  { value: 'wedding', label: 'Wedding or engagement', happy: true },
  { value: 'promotion', label: 'Promotion or new job', happy: true },
  { value: 'award', label: 'Award or graduation', happy: true },
  { value: 'anniversary', label: 'Anniversary', happy: true },
  { value: 'moved', label: 'Moved or new home', happy: true },
  { value: 'sickness', label: 'Illness or surgery', happy: false },
  { value: 'bereavement', label: 'Loss of a loved one', happy: false },
  { value: 'job_loss', label: 'Job loss', happy: false },
  { value: 'other', label: 'Something else', happy: null },
] as const

function Submit({ ready }: { ready: boolean }) {
  const { pending } = useFormStatus()
  return <button disabled={!ready || pending} className={submitClass}>{pending ? 'Sharing…' : 'Share with my care team'}</button>
}

export function MomentForm({ today }: { today: string }) {
  const [type, setType] = useState<string | null>(null)
  const picked = TYPES.find((t) => t.value === type)
  return (
    <form action={submitMoment}>
      <fieldset>
        <legend className="sr-only">What happened</legend>
        <div className="grid grid-cols-2 gap-3">
          {TYPES.map((t) => (
            <label
              key={t.value}
              className={clsx(
                'flex min-h-16 cursor-pointer items-center rounded-xl border-2 px-4 py-3 text-[17px] leading-snug font-semibold has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-navy-700',
                type === t.value ? 'border-ink bg-ink text-white' : 'border-[#e5e2dc] bg-white',
              )}
            >
              <input type="radio" name="type" value={t.value} className="sr-only" onChange={() => setType(t.value)} />
              {t.label}
            </label>
          ))}
        </div>
      </fieldset>

      {picked && (
        <p
          className={clsx('mt-5 rounded-xl px-5 py-4 text-[17px]', picked.happy ? 'bg-ok-bg text-ok' : 'bg-navy-100 text-navy-900')}
          aria-live="polite"
        >
          {picked.happy === true
            ? 'We’d love to celebrate with you!'
            : picked.happy === false
              ? 'We’re so sorry. Your care team will reach out gently.'
              : 'Thank you for telling us. Your care team will follow up.'}
        </p>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-2 block text-[17px] font-semibold">Date</span>
          <input type="date" name="date" required defaultValue={today} className={textareaClass + ' py-3'} />
        </label>
        <label className="block">
          <span className="mb-2 block text-[17px] font-semibold">Who</span>
          <input name="who" maxLength={200} placeholder="Our family" className={textareaClass + ' py-3'} />
        </label>
      </div>
      <label className="mt-5 block">
        <span className="mb-2 block text-[17px] font-semibold">Tell us more (optional)</span>
        <textarea name="note" rows={3} maxLength={2000} className={textareaClass} />
      </label>
      <label className="mt-5 flex items-center gap-3 text-[17px]">
        <input type="checkbox" name="share" className="size-6 accent-[#0b4373]" /> OK to share with the church family
      </label>
      <label className="mt-3 flex items-center gap-3 text-[17px]">
        <input type="checkbox" name="remind" className="size-6 accent-[#0b4373]" /> Remind my care team every year on this date
      </label>
      <StickySubmit>
        <Submit ready={!!type} />
      </StickySubmit>
    </form>
  )
}
