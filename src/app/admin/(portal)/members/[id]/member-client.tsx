'use client'

import { useActionState, useState } from 'react'
import { buttonClass, cx, inputClass } from '@/components/ui'
import { SENSITIVE_REASONS } from '@/lib/types'
import {
  addPastoralNote, assignFollowUp, changeAccess, flagForCare, referCounseling, scheduleCall, sendText, snoozeCase, type ActionState,
} from './actions'

function Status({ state, dark }: { state: ActionState; dark?: boolean }) {
  if (!state) return null
  return (
    <p role="status" className={cx('text-sm', state.error ? (dark ? 'text-[#ffb4ab]' : 'text-urgent') : dark ? 'text-white/80' : 'text-ok')}>
      {state.error ?? state.ok}
    </p>
  )
}

type Team = { id: string; name: string; subtitle: string | null }

export function NextActionComposer({ personId, caseId, suggested }: { personId: string; caseId: string; suggested: string }) {
  const [textState, textAction, textPending] = useActionState(sendText, null)
  const [callState, callAction, callPending] = useActionState(scheduleCall, null)
  const [referState, referAction, referPending] = useActionState(referCounseling, null)
  const [snoozeState, snoozeAction, snoozePending] = useActionState(snoozeCase, null)
  const last = [textState, callState, referState, snoozeState].find(Boolean) ?? null
  return (
    <div id="compose">
      <form action={textAction}>
        <input type="hidden" name="personId" value={personId} />
        <input type="hidden" name="caseId" value={caseId} />
        <label className="mb-1 block text-sm font-medium text-white/90" htmlFor="sms-body">Suggested text (edit before sending)</label>
        <textarea
          id="sms-body"
          name="body"
          defaultValue={suggested}
          rows={4}
          className="w-full rounded-lg border border-white/15 bg-navy-800/60 p-3 text-[15px] leading-relaxed text-white placeholder:text-white/50 focus:border-white/40 focus:outline-none"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button className={cx(buttonClass('primary'), 'bg-navy-800 ring-1 ring-white/10')} disabled={textPending}>{textPending ? 'Sending…' : 'Send text'}</button>
          <button formAction={callAction} className={buttonClass('onDark')} disabled={callPending}>Schedule call</button>
          <button formAction={referAction} className={buttonClass('onDark')} disabled={referPending}>Refer to Counseling Services</button>
          <button formAction={snoozeAction} className={buttonClass('onDark')} disabled={snoozePending}>Snooze 3 days</button>
        </div>
      </form>
      <div className="mt-2"><Status state={last} dark /></div>
    </div>
  )
}

export function TextComposer({ personId }: { personId: string }) {
  const [state, action, pending] = useActionState(sendText, null)
  return (
    <form action={action} id="compose" className="space-y-2">
      <input type="hidden" name="personId" value={personId} />
      <textarea name="body" rows={3} placeholder="Write a text…" className={inputClass} aria-label="Text message" />
      <div className="flex items-center gap-3">
        <button className={buttonClass('primary', 'sm')} disabled={pending}>Send text</button>
        <Status state={state} />
      </div>
    </form>
  )
}

export function AssignFollowUp({ personId, caseId, teams, defaultTeam, defaultDue, isPastor }: {
  personId: string; caseId: string | null; teams: Team[]; defaultTeam: string | null; defaultDue: string; isPastor: boolean
}) {
  const [state, action, pending] = useActionState(assignFollowUp, null)
  const [sensitive, setSensitive] = useState(false)
  return (
    <form action={action} className="rounded-lg border border-line bg-canvas/60 p-4">
      <h3 className="mb-3 text-[15px] font-semibold">Assign a new follow-up</h3>
      <input type="hidden" name="personId" value={personId} />
      {caseId && <input type="hidden" name="caseId" value={caseId} />}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm">
          <span className="mb-1 block font-medium">Task</span>
          <select name="taskType" className={inputClass} defaultValue="call">
            <option value="call">Phone call</option>
            <option value="text">Text</option>
            <option value="visit">Home visit</option>
            <option value="coffee">Coffee</option>
            <option value="card">Card</option>
            <option value="intake">Benevolence intake</option>
            <option value="referral">Referral</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Assign to leader</span>
          <select name="teamId" className={inputClass} defaultValue={defaultTeam ?? ''} required>
            <option value="" disabled>Choose a leader or team</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}{t.subtitle ? ` · ${t.subtitle}` : ''}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Due</span>
          <input type="date" name="due" defaultValue={defaultDue} className={inputClass} required />
        </label>
      </div>
      <label className="mt-3 block text-sm">
        <span className="mb-1 block font-medium">Instructions for the leader</span>
        <textarea name="instructions" rows={2} className={inputClass} placeholder="What to do, and what not to ask about." />
      </label>
      <div className="mt-3 border-t border-line pt-3">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="sensitive" checked={sensitive} onChange={(e) => setSensitive(e.target.checked)} className="mt-1 size-4 accent-navy-800" />
          <span>
            <span className="font-semibold">Flag this as a sensitive matter</span>
            <span className="block text-xs text-ink-muted">
              Use for health, finances, family conflict, addiction, legal or abuse concerns. Details are hidden from anyone outside the access you choose; leaders see only their task.
            </span>
          </span>
        </label>
        {sensitive && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block font-medium">Who can see the details</span>
              <select name="visibility" className={inputClass} defaultValue={isPastor ? 'pastors' : 'pastors_and_staff'}>
                <option value="pastors">Pastors only</option>
                <option value="pastors_and_staff">Pastors and care staff</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Reason</span>
              <select name="reason" className={inputClass} defaultValue="Employment and finances">
                {SENSITIVE_REASONS.map((r) => <option key={r}>{r}</option>)}
              </select>
            </label>
          </div>
        )}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button className={buttonClass('primary')} disabled={pending}>{pending ? 'Assigning…' : 'Assign and notify leader'}</button>
        <span className="text-xs text-ink-muted">The leader gets a text with the task, not the member’s file.</span>
      </div>
      <div className="mt-2"><Status state={state} /></div>
    </form>
  )
}

export function ChangeAccess({ personId, caseId, current }: { personId: string; caseId: string; current: string | null }) {
  const [state, action, pending] = useActionState(changeAccess, null)
  const [open, setOpen] = useState(false)
  if (!open) {
    return <button onClick={() => setOpen(true)} className="text-sm font-semibold text-gold-500 underline underline-offset-2">Change access</button>
  }
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="personId" value={personId} />
      <input type="hidden" name="caseId" value={caseId} />
      <select name="visibility" defaultValue={current ?? 'pastors'} className="rounded-md border border-white/20 bg-navy-900 px-2 py-1 text-sm text-white" aria-label="Who can see the details">
        <option value="pastors">Pastors only</option>
        <option value="pastors_and_staff">Pastors and care staff</option>
        <option value="none">Not sensitive</option>
      </select>
      <button className={buttonClass('onDark', 'sm')} disabled={pending}>Save</button>
      <Status state={state} dark />
    </form>
  )
}

export function PastoralNoteForm({ personId }: { personId: string }) {
  const [state, action, pending] = useActionState(addPastoralNote, null)
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="personId" value={personId} />
      <label className="block text-xs text-high" htmlFor="pastoral-note">Add a confidential note</label>
      <textarea id="pastoral-note" name="body" rows={3} className={cx(inputClass, 'bg-white')} />
      <div className="flex items-center gap-3">
        <button className={buttonClass('secondary', 'sm')} disabled={pending}>Save note</button>
        <Status state={state} />
      </div>
    </form>
  )
}

export function FlagForCare({ personId, teams, defaultTeam }: { personId: string; teams: Team[]; defaultTeam: string | null }) {
  const [state, action, pending] = useActionState(flagForCare, null)
  const [sensitive, setSensitive] = useState(false)
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="personId" value={personId} />
      <label className="block text-sm">
        <span className="mb-1 block font-medium">What&rsquo;s going on?</span>
        <textarea name="why" rows={2} required minLength={3} className={inputClass} placeholder="e.g. Mentioned a hospital stay after service" />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-medium">Urgency</span>
          <select name="urgency" defaultValue="high" className={inputClass}>
            <option value="urgent">Urgent · today</option>
            <option value="high">High · today</option>
            <option value="normal">Normal · in 2 days</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Assign to</span>
          <select name="teamId" defaultValue={defaultTeam ?? ''} required className={inputClass}>
            <option value="" disabled>Choose a leader or team</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="sensitive" checked={sensitive} onChange={(e) => setSensitive(e.target.checked)} className="size-4 accent-navy-800" />
        Sensitive matter
      </label>
      {sensitive && (
        <select name="reason" className={inputClass} aria-label="Reason" defaultValue="Health">
          {SENSITIVE_REASONS.map((r) => <option key={r}>{r}</option>)}
        </select>
      )}
      <div className="flex items-center gap-3">
        <button className={buttonClass('primary')} disabled={pending}>Flag for care</button>
        <Status state={state} />
      </div>
    </form>
  )
}
