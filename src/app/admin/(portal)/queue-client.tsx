'use client'

import Link from 'next/link'
import { useRef, useTransition } from 'react'
import { Check, Mail, MessageCircle, Phone } from 'lucide-react'
import { buttonClass, cx } from '@/components/ui'
import type { Channel } from '@/lib/types'
import { completeCase, logQuickTouch, reassignCase, runOutreach } from './actions'

export function RunOutreachButton() {
  const [pending, start] = useTransition()
  return (
    <button className={buttonClass('primary')} disabled={pending} onClick={() => start(() => runOutreach())}>
      {pending ? 'Running…' : "Run today's outreach"}
    </button>
  )
}

export function CampusSelect({ value, campuses }: { value: string; campuses: { id: string; name: string }[] }) {
  const ref = useRef<HTMLFormElement>(null)
  return (
    <form ref={ref} method="get">
      <label className="block text-xs text-ink-muted">
        Campus
        <select
          name="campus"
          defaultValue={value}
          onChange={() => ref.current?.requestSubmit()}
          className="mt-1 block rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink"
        >
          <option value="">All campuses</option>
          {campuses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
    </form>
  )
}

export function OwnerSelect({ caseId, value, teams }: { caseId: string; value: string | null; teams: { id: string; name: string }[] }) {
  const ref = useRef<HTMLFormElement>(null)
  const [pending, start] = useTransition()
  return (
    <form ref={ref} action={(fd) => start(() => reassignCase(fd))}>
      <input type="hidden" name="caseId" value={caseId} />
      <label className="block text-[11px] text-ink-muted">
        Assigned to
        <select
          name="teamId"
          defaultValue={value ?? ''}
          disabled={pending}
          onChange={() => ref.current?.requestSubmit()}
          className="mt-0.5 block w-full max-w-[11rem] rounded-lg border border-line bg-white px-2 py-1.5 text-sm text-ink"
        >
          {!value && <option value="" disabled>Unassigned</option>}
          {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </label>
    </form>
  )
}

const iconBtn = 'inline-flex size-9 items-center justify-center rounded-lg border border-line bg-white text-ink hover:bg-canvas'

export function DoItButtons(props: { caseId: string; personId: string; phone: string | null; email: string | null; channel: Channel }) {
  const { caseId, personId, phone, email, channel } = props
  const [pending, start] = useTransition()
  const log = (c: Channel) => start(() => logQuickTouch({ caseId, personId, channel: c }))
  return (
    <div className="grid w-[5.25rem] grid-cols-2 gap-1.5">
      {phone ? (
        <a href={`tel:${phone}`} onClick={() => log('call')} className={iconBtn} aria-label="Call" title="Call">
          <Phone className="size-4" />
        </a>
      ) : (
        <span className={cx(iconBtn, 'opacity-40')} aria-label="No phone on file" title="No phone on file"><Phone className="size-4" /></span>
      )}
      <Link href={`/admin/members/${personId}#compose`} className={iconBtn} aria-label="Text" title="Text">
        <MessageCircle className="size-4" />
      </Link>
      {email ? (
        <a href={`mailto:${email}`} onClick={() => log('email')} className={iconBtn} aria-label="Email" title="Email">
          <Mail className="size-4" />
        </a>
      ) : (
        <span className={cx(iconBtn, 'opacity-40')} aria-label="No email on file" title="No email on file"><Mail className="size-4" /></span>
      )}
      <form action={(fd) => start(() => completeCase(fd))}>
        <input type="hidden" name="caseId" value={caseId} />
        <input type="hidden" name="personId" value={personId} />
        <input type="hidden" name="channel" value={channel} />
        <button disabled={pending} className={cx(iconBtn, 'border-navy-100 bg-navy-100 text-navy-900 hover:bg-navy-50')} aria-label="Mark done" title="Mark done">
          <Check className="size-4" />
        </button>
      </form>
    </div>
  )
}
