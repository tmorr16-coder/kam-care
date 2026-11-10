'use client'
import { useActionState, useEffect, useState, useTransition } from 'react'
import { Eye } from 'lucide-react'
import { buttonClass, inputClass } from '@/components/ui'
import { findPeople, reportNoticed, type FoundPerson } from './actions'

const WHAT = [
  { value: 'birth', label: 'New baby' },
  { value: 'wedding', label: 'Engaged or married' },
  { value: 'promotion', label: 'New job or promotion' },
  { value: 'award', label: 'Graduation or award' },
  { value: 'moved', label: 'Moved' },
  { value: 'sickness', label: 'Illness or hospital' },
  { value: 'bereavement', label: 'Loss of a loved one' },
  { value: 'job_loss', label: 'Lost a job' },
  { value: 'other', label: 'Something else' },
]
const WHERE = [
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'social', label: 'Other social media' },
  { value: 'person', label: 'In person' },
  { value: 'told', label: 'Someone told me' },
]

/** Leaders share a life event they noticed, often on social media, so it isn't lost. */
export function NoticedForm() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [results, setResults] = useState<FoundPerson[]>([])
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searchedFor, setSearchedFor] = useState('')
  const [picked, setPicked] = useState<FoundPerson | null>(null)
  const [searching, startSearch] = useTransition()
  const [state, action, saving] = useActionState(async (prev: Awaited<ReturnType<typeof reportNoticed>>, fd: FormData) => {
    const res = await reportNoticed(prev, fd)
    // Fresh form after a successful report.
    if (res?.ok) {
      setPicked(null)
      setQ('')
      setResults([])
    }
    return res
  }, undefined)

  useEffect(() => {
    if (picked || q.trim().length < 2) return
    const t = setTimeout(() => startSearch(async () => {
      const res = await findPeople(q)
      setResults(res.people)
      setSearchError(res.error ?? null)
      setSearchedFor(q)
    }), 250)
    return () => clearTimeout(t)
  }, [q, picked])

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex w-full items-center gap-3 rounded-2xl border border-[#e5e2dc] bg-white p-5 text-left hover:bg-canvas">
        <Eye className="size-6 shrink-0 text-navy-800" aria-hidden />
        <span>
          <span className="block text-lg font-semibold">Noticed something?</span>
          <span className="block text-[15px] text-ink-muted">A new baby, a hospital stay, a new job… on social media or anywhere.</span>
        </span>
      </button>
    )
  }

  return (
    <form action={action} className="space-y-4 rounded-2xl border border-[#e5e2dc] bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-xl font-semibold">Noticed something?</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-ink-muted hover:text-ink">Close</button>
      </div>
      {state?.ok && <p className="rounded-lg bg-ok-bg px-3 py-2 text-[15px] text-ok" role="status">Thank you. It&apos;s with the care team now.</p>}

      <div>
        <label htmlFor="noticed-person" className="mb-1 block text-[15px] font-semibold">Who</label>
        {picked ? (
          <div className="flex items-center justify-between rounded-lg border border-line bg-canvas px-3 py-2.5">
            <span className="text-[17px]">{picked.display_name}{picked.campus ? <span className="text-ink-muted"> · {picked.campus}</span> : null}</span>
            <button type="button" onClick={() => setPicked(null)} className="text-sm font-semibold text-navy-800">Change</button>
          </div>
        ) : (
          <>
            <input id="noticed-person" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Start typing a name" autoComplete="off" className={inputClass + ' py-3 text-base'} />
            {q.trim().length >= 2 && (
              <ul className="mt-1 divide-y divide-line rounded-lg border border-line">
                {results.map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => setPicked(p)} className="w-full px-3 py-2.5 text-left text-[16px] hover:bg-canvas">
                      {p.display_name}{p.campus ? <span className="text-ink-muted"> · {p.campus}</span> : null}
                    </button>
                  </li>
                ))}
                {!results.length && (
                  <li className={'px-3 py-2.5 text-[15px] ' + (searchError ? 'text-urgent' : 'text-ink-muted')}>
                    {searching || searchedFor !== q ? 'Searching…' : searchError ?? 'No one found by that name.'}
                  </li>
                )}
              </ul>
            )}
          </>
        )}
        <input type="hidden" name="person_id" value={picked?.id ?? ''} />
        <input type="hidden" name="person_name" value={picked?.display_name ?? ''} />
      </div>

      <label className="block">
        <span className="mb-1 block text-[15px] font-semibold">What happened</span>
        <select name="type" required defaultValue="" className={inputClass + ' py-3 text-base'}>
          <option value="" disabled>Choose one</option>
          {WHAT.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
        </select>
      </label>

      <label className="block">
        <span className="mb-1 block text-[15px] font-semibold">Where you saw it</span>
        <select name="where" defaultValue="facebook" className={inputClass + ' py-3 text-base'}>
          {WHERE.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
        </select>
      </label>

      <label className="block">
        <span className="mb-1 block text-[15px] font-semibold">Anything to add <span className="font-normal text-ink-muted">(optional)</span></span>
        <textarea name="note" rows={2} maxLength={500} placeholder="e.g. Her mother is at Methodist Hospital" className={inputClass + ' text-base'} />
      </label>

      {state?.error && <p className="text-[15px] text-urgent" role="alert">{state.error}</p>}
      <button disabled={saving || !picked} className={buttonClass('primary', 'lg') + ' w-full rounded-xl'}>{saving ? 'Sending…' : 'Send to the care team'}</button>
      <p className="text-sm text-ink-muted">Only share what the person shared themselves. Pastors decide who follows up.</p>
    </form>
  )
}
