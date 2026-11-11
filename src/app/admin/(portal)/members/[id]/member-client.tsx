'use client'

import { useActionState, useState } from 'react'
import { buttonClass, cx, inputClass } from '@/components/ui'
import { SENSITIVE_REASONS } from '@/lib/types'
import { addDays, fmtShort } from '@/lib/dates'
import {
  addPastoralNote, assignFollowUp, changeAccess, checkInNextWeek, flagForCare, inviteToKamCare, referCounseling, scheduleCall, sendPasswordReset, sendText, snoozeCase, type ActionState,
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
  const [weekState, weekAction, weekPending] = useActionState(checkInNextWeek, null)
  const last = [textState, callState, referState, snoozeState, weekState].find(Boolean) ?? null
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
          <button formAction={weekAction} className={buttonClass('onDark')} disabled={weekPending}>Check in again in 1 week</button>
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

const DUE_PRESETS = [['3 days', 3], ['1 week', 7], ['2 weeks', 14]] as const

export function AssignFollowUp({ personId, caseId, teams, defaultTeam, today, defaultDue, isPastor }: {
  personId: string; caseId: string | null; teams: Team[]; defaultTeam: string | null; today: string; defaultDue: string; isPastor: boolean
}) {
  const [state, action, pending] = useActionState(assignFollowUp, null)
  const [sensitive, setSensitive] = useState(false)
  const [due, setDue] = useState(defaultDue)
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
          <input type="date" name="due" value={due} onChange={(e) => setDue(e.target.value)} className={inputClass} required />
          <span className="mt-1.5 flex gap-1.5">
            {DUE_PRESETS.map(([label, days]) => {
              const d = addDays(today, days)
              return (
                <button key={label} type="button" onClick={() => setDue(d)} aria-pressed={due === d}
                  className={cx('rounded-full border px-2.5 py-0.5 text-xs', due === d ? 'border-navy-800 bg-navy-800 text-white' : 'border-line bg-white text-ink hover:bg-canvas')}>
                  {label}
                </button>
              )
            })}
          </span>
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

/** Standalone "check in again in a week" for members with no open care need. */
export function CheckInNextWeek({ personId, teams, defaultTeam }: { personId: string; teams: Team[]; defaultTeam: string | null }) {
  const [state, action, pending] = useActionState(checkInNextWeek, null)
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="personId" value={personId} />
      <select name="teamId" defaultValue={defaultTeam ?? ''} required className={cx(inputClass, 'w-auto')} aria-label="Care leader for the check-in">
        <option value="" disabled>Choose a leader</option>
        {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      <button className={buttonClass('secondary', 'sm')} disabled={pending}>{pending ? 'Setting…' : 'Check in again in 1 week'}</button>
      <Status state={state} />
    </form>
  )
}

export type ActivityItem = {
  id: string; at: string; title: string; source: string; dot: string; kind: 'signal' | 'touch'; group: 'This week' | 'Last week' | 'Earlier'
}

const FILTERS = [['all', 'All'], ['signal', 'Signals'], ['touch', 'Outreach']] as const
const GROUPS = ['This week', 'Last week', 'Earlier'] as const

/** Signals and outreach in one list: filter by type, grouped by week, older items folded away. */
export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  const [filter, setFilter] = useState<'all' | 'signal' | 'touch'>('all')
  const [showAll, setShowAll] = useState(false)
  const shown = items.filter((i) => filter === 'all' || i.kind === filter)
  const visible = showAll ? shown : shown.slice(0, 8)
  const count = (k: 'all' | 'signal' | 'touch') => (k === 'all' ? items.length : items.filter((i) => i.kind === k).length)
  return (
    <>
      <div className="flex gap-1.5 px-5 pb-3" role="group" aria-label="Show">
        {FILTERS.map(([k, label]) => (
          <button key={k} type="button" onClick={() => setFilter(k)} aria-pressed={filter === k}
            className={cx('rounded-full px-3 py-1 text-sm', filter === k ? 'bg-navy-800 text-white' : 'bg-canvas text-ink hover:bg-navy-50')}>
            {label} <span className={filter === k ? 'text-white/70' : 'text-ink-muted'}>{count(k)}</span>
          </button>
        ))}
      </div>
      {GROUPS.map((g) => {
        const rows = visible.filter((i) => i.group === g)
        if (!rows.length) return null
        return (
          <section key={g}>
            <h3 className="bg-canvas/70 px-5 py-1.5 text-xs font-semibold tracking-wider text-ink-muted uppercase">{g}</h3>
            <ol className="divide-y divide-line px-5">
              {rows.map((e) => (
                <li key={e.id} className="flex gap-4 py-3 text-sm">
                  <span className="w-14 shrink-0 text-ink-muted">{fmtShort(e.at)}</span>
                  <span className={cx('mt-1.5 size-2.5 shrink-0 rounded-full', e.dot)} aria-hidden />
                  <span>
                    <span className="font-semibold">{e.title}</span>
                    <span className="block text-xs text-ink-muted">{e.source}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )
      })}
      {!shown.length && <p className="px-5 py-8 text-center text-sm text-ink-muted">{filter === 'touch' ? 'No outreach logged yet.' : 'No signals yet.'}</p>}
      {shown.length > visible.length && (
        <button type="button" onClick={() => setShowAll(true)} className="w-full border-t border-line py-3 text-sm font-semibold text-navy-800 hover:bg-canvas">
          Show {shown.length - visible.length} older
        </button>
      )}
    </>
  )
}

export type SignInStatus =
  | { state: 'none'; email: string | null }
  | { state: 'invited'; email: string; invitedAt: string | null }
  | { state: 'active'; email: string; lastSignInAt: string | null }

/** Shows whether the person can sign in, with one-click invite and password reset. */
export function SignInAccess({ personId, firstName, status }: { personId: string; firstName: string; status: SignInStatus }) {
  const [inviteState, inviteAction, invitePending] = useActionState(inviteToKamCare, null)
  const [resetState, resetAction, resetPending] = useActionState(sendPasswordReset, null)
  const last = inviteState ?? resetState

  const summary =
    status.state === 'active' ? <>Has a sign-in{status.lastSignInAt ? ` · last signed in ${fmtShort(status.lastSignInAt)}` : ''}</>
      : status.state === 'invited' ? <>Invited{status.invitedAt ? ` ${fmtShort(status.invitedAt)}` : ''}, hasn’t set a password yet</>
        : <>No sign-in yet</>

  return (
    <form className="space-y-3">
      <input type="hidden" name="personId" value={personId} />
      <p className="text-sm">
        <span className={cx('mr-2 inline-block size-2 rounded-full', status.state === 'active' ? 'bg-ok' : status.state === 'invited' ? 'bg-warn' : 'bg-[#c9c4ba]')} aria-hidden />
        {summary}
        {status.email && <span className="block truncate pl-4 text-xs text-ink-muted">{status.email}</span>}
      </p>
      {status.state === 'none' && !status.email ? (
        <p className="text-xs text-ink-muted">Add an email for {firstName} in OneChurch to invite them.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {status.state !== 'active' && (
            <button formAction={inviteAction} className={buttonClass('primary', 'sm')} disabled={invitePending}>
              {invitePending ? 'Sending…' : status.state === 'invited' ? 'Resend invite' : 'Invite to KAM Care'}
            </button>
          )}
          {status.state !== 'none' && (
            <button formAction={resetAction} className={buttonClass(status.state === 'active' ? 'primary' : 'secondary', 'sm')} disabled={resetPending}>
              {resetPending ? 'Sending…' : 'Send password reset'}
            </button>
          )}
        </div>
      )}
      <Status state={last} />
      <p className="text-xs text-ink-muted">
        {firstName} gets an email with a link to choose a password. If it doesn’t arrive, ask them to check junk mail.
      </p>
    </form>
  )
}
