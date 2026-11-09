'use client'
import { useOptimistic, useState, useTransition } from 'react'
import { saveConsent, type ConsentField } from '../actions'

export function ConsentToggle({ field, title, sub, initial }: { field: ConsentField; title: string; sub: string; initial: boolean }) {
  const [saved, setSaved] = useState(initial)
  const [value, setOptimistic] = useOptimistic(saved)
  const [, startTransition] = useTransition()
  const [error, setError] = useState(false)

  function toggle(next: boolean) {
    setError(false)
    startTransition(async () => {
      setOptimistic(next)
      try {
        await saveConsent(field, next)
        setSaved(next)
      } catch {
        setError(true)
      }
    })
  }

  const id = `consent-${field}`
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[#eeebe5] p-6 last:border-b-0">
      <label htmlFor={id} className="cursor-pointer">
        <span className="block text-xl font-semibold">{title}</span>
        <span className="mt-1 block text-[16px] text-ink-muted">{sub}</span>
        {error && <span className="mt-1 block text-sm text-urgent">Couldn&apos;t save. Try again.</span>}
      </label>
      <input
        id={id}
        type="checkbox"
        checked={value}
        onChange={(e) => toggle(e.target.checked)}
        className="mt-1 size-8 shrink-0 cursor-pointer accent-[#0b4373]"
      />
    </div>
  )
}
