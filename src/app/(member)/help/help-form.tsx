'use client'
import { useState } from 'react'
import { useFormStatus } from 'react-dom'
import { submitPractical } from '../actions'
import { StickySubmit, optionCardClass, submitClass, textareaClass } from '../parts'

const ITEMS = [
  { value: 'groceries', title: 'Groceries', sub: 'KAM Food Pantries' },
  { value: 'holiday', title: 'Holiday help', sub: 'Free Holiday Assistance' },
  { value: 'bills', title: 'Bills & rent', sub: 'Total Restoration' },
  { value: 'ride', title: 'A ride', sub: 'Church, doctor, errands' },
  { value: 'counseling', title: 'Counseling', sub: 'Confidential sessions' },
  { value: 'other', title: 'Other resources', sub: 'Community partners, 211' },
]

function Submit({ count }: { count: number }) {
  const { pending } = useFormStatus()
  return (
    <button disabled={!count || pending} className={submitClass}>
      {pending ? 'Sending…' : `Send to benevolence team${count ? ` · ${count} item${count > 1 ? 's' : ''}` : ''}`}
    </button>
  )
}

export function HelpForm() {
  const [picked, setPicked] = useState<string[]>([])
  return (
    <form action={submitPractical}>
      <fieldset>
        <legend className="sr-only">What would help</legend>
        <div className="grid grid-cols-2 gap-3">
          {ITEMS.map((i) => (
            <label key={i.value} className={optionCardClass + ' min-h-28 p-5'}>
              <input
                type="checkbox"
                name="items"
                value={i.value}
                className="sr-only"
                onChange={(e) => setPicked((p) => (e.target.checked ? [...p, i.value] : p.filter((x) => x !== i.value)))}
              />
              <span className="block text-xl font-semibold">{i.title}</span>
              <span className="mt-1 block text-[16px] text-ink-muted">{i.sub}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="mt-6 block">
        <span className="mb-3 block text-[17px] font-semibold">Anything we should know?</span>
        <textarea name="body" rows={3} maxLength={2000} className={textareaClass} />
      </label>
      <label className="mt-6 block">
        <span className="mb-3 block text-[17px] font-semibold">Best way to reach you</span>
        <select name="contact_pref" defaultValue="text" className={textareaClass + ' py-3'}>
          <option value="text">Text</option>
          <option value="call">Phone call</option>
          <option value="email">Email</option>
        </select>
      </label>
      <StickySubmit>
        <Submit count={picked.length} />
      </StickySubmit>
    </form>
  )
}
