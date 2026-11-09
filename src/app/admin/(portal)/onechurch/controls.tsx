'use client'
import { useActionState, useState } from 'react'
import { Button, buttonClass, cx, inputClass } from '@/components/ui'
import {
  registerWebhooksAction, rejectMatch, resolveMatch, runReconcile, searchPeople, setWriteBack, testConnection,
  type ActionResult, type PersonHit,
} from './actions'

const ACTIONS = { test: testConnection, reconcile: runReconcile, webhooks: registerWebhooksAction }

export function ActionButton({ kind, label, pendingLabel, variant = 'secondary' }: { kind: keyof typeof ACTIONS; label: string; pendingLabel: string; variant?: 'primary' | 'secondary' }) {
  const [state, action, pending] = useActionState<ActionResult>(ACTIONS[kind], {})
  return (
    <form action={action} className="relative">
      <Button variant={variant} disabled={pending}>{pending ? pendingLabel : label}</Button>
      {(state.message || state.error) && (
        <p
          key={state.at}
          role={state.error ? 'alert' : 'status'}
          className={cx('absolute right-0 z-10 mt-2 w-72 rounded-lg px-3 py-2 text-xs shadow-md', state.error ? 'bg-urgent-bg text-urgent' : 'bg-ok-bg text-ok')}
        >
          {state.error ?? state.message}
        </p>
      )}
    </form>
  )
}

export function WriteBackToggle({ on }: { on: boolean }) {
  return (
    <form action={setWriteBack}>
      <label className="flex cursor-pointer items-center gap-3 text-sm">
        <input
          type="checkbox"
          name="writeBack"
          defaultChecked={on}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className="size-5 accent-gold-500"
        />
        Write care touches back to OneChurch
      </label>
    </form>
  )
}

export function MatchReview({ reviewId, label, reason, candidates }: { reviewId: string; label: string; reason: string; candidates: PersonHit[] }) {
  const [open, setOpen] = useState(false)
  const [search, searchAction, searching] = useActionState(searchPeople, { results: [] as PersonHit[], q: '' })
  const options = [...candidates, ...search.results.filter((r) => !candidates.some((c) => c.id === r.id))]

  return (
    <li className="border-t border-line py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{label}</p>
          <p className="text-xs text-ink-muted">{reason}</p>
        </div>
        <button className={buttonClass('secondary', 'sm')} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? 'Close' : 'Review'}
        </button>
      </div>
      {open && (
        <div className="mt-3 space-y-3 rounded-lg bg-canvas p-3">
          <form action={searchAction} className="flex gap-2">
            <label className="sr-only" htmlFor={`q-${reviewId}`}>Search OneChurch people</label>
            <input id={`q-${reviewId}`} name="q" defaultValue={search.q} placeholder="Search by name, email or phone" className={inputClass} />
            <Button size="sm" variant="secondary" disabled={searching}>{searching ? '…' : 'Search'}</Button>
          </form>
          {options.length > 0 ? (
            <ul className="space-y-2">
              {options.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2">
                  <span className="text-sm">
                    <span className="font-medium">{p.name}</span>
                    <span className="block text-xs text-ink-muted">{p.detail}</span>
                  </span>
                  <form action={resolveMatch}>
                    <input type="hidden" name="reviewId" value={reviewId} />
                    <input type="hidden" name="personId" value={p.id} />
                    <button className={buttonClass('primary', 'sm')}>This is them</button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-ink-muted">{search.q ? 'No one matched. Ask Member Services to add or update their OneChurch record.' : 'Search for the right OneChurch person.'}</p>
          )}
          <form action={rejectMatch}>
            <input type="hidden" name="reviewId" value={reviewId} />
            <button className="text-xs text-urgent hover:underline">Not a KAM member · reject sign-in</button>
          </form>
        </div>
      )}
    </li>
  )
}
