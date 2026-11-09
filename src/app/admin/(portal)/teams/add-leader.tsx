'use client'
import { useActionState, useState } from 'react'
import { Button, Field, inputClass } from '@/components/ui'
import { createTeam, type FormState } from './actions'

export function AddLeader() {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState<FormState, FormData>(createTeam, {})

  if (!open) return <Button onClick={() => setOpen(true)}>Add leader from OneChurch</Button>

  return (
    <div className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="add-leader-title">
      <form action={action} className="w-full max-w-lg space-y-4 rounded-xl bg-white p-6 shadow-xl">
        <div>
          <h2 id="add-leader-title" className="font-serif text-xl font-semibold">Add a leader or team</h2>
          <p className="mt-1 text-sm text-ink-muted">Leaders must be a named person in OneChurch. Their sign-in role comes from their OneChurch groups.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" className="sm:col-span-2"><input name="name" required className={inputClass} placeholder="Sis. A. Jordan or Care Team West" /></Field>
          <Field label="Role line"><input name="subtitle" className={inputClass} placeholder="Care minister" /></Field>
          <Field label="Kind">
            <select name="kind" className={inputClass} defaultValue="person">
              <option value="person">One leader</option>
              <option value="team">A team</option>
            </select>
          </Field>
          <Field label="OneChurch email" hint="Links the leader to their OneChurch record." className="sm:col-span-2">
            <input name="email" type="email" className={inputClass} placeholder="name@kam.church" />
          </Field>
          <Field label="Campus">
            <select name="campus" className={inputClass} defaultValue="all">
              <option value="all">All campuses</option>
              <option value="indianapolis">Indianapolis</option>
              <option value="detroit">Detroit</option>
              <option value="atlanta">Atlanta</option>
              <option value="global">Global</option>
            </select>
          </Field>
          <Field label="Weekly limit"><input name="capacity" type="number" min={1} max={200} defaultValue={6} required className={inputClass} /></Field>
          <Field label="Gifted for" hint="Comma separated, e.g. hospital, seniors, men" className="sm:col-span-2"><input name="gifted" className={inputClass} /></Field>
          <Field label="OneChurch group id (optional)" hint="Mirror this team's members from a OneChurch group." className="sm:col-span-2">
            <input name="ocGroupId" inputMode="numeric" className={inputClass} />
          </Field>
        </div>
        {state.error && <p className="rounded-lg bg-urgent-bg px-3 py-2 text-sm text-urgent" role="alert">{state.error}</p>}
        {state.ok && <p className="rounded-lg bg-ok-bg px-3 py-2 text-sm text-ok" role="status">{state.message}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>{state.ok ? 'Done' : 'Cancel'}</Button>
          <Button type="submit" disabled={pending}>{pending ? 'Adding…' : 'Add leader'}</Button>
        </div>
      </form>
    </div>
  )
}
