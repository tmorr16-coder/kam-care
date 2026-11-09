import type { Metadata } from 'next'
import clsx from 'clsx'
import { Lock } from 'lucide-react'
import { requireLeader } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Logo } from '@/components/ui'
import { dueLabel, todayISO } from '@/lib/dates'
import { logOutcome } from './actions'
import { NoticedForm } from './noticed-form'

export const metadata: Metadata = { title: 'My tasks' }

function leaderTitle(title: string | null, displayName: string | null, first: string | null) {
  const last = displayName?.split(' ').at(-1)
  const word = title === 'Dcn.' ? 'Deacon' : title === 'Bro.' ? 'Brother' : title === 'Sis.' ? 'Sister' : title
  return word && last ? `${word} ${last}` : first ?? 'Welcome'
}

const OUTCOME_BUTTONS = [
  { value: 'reached', label: 'Reached', cls: 'bg-ok-bg text-ok' },
  { value: 'left_message', label: 'Left message', cls: 'bg-high-bg text-high' },
  { value: 'needs_pastor', label: 'Needs a pastor', cls: 'bg-urgent-bg text-urgent' },
]

export default async function LeaderHome() {
  const v = await requireLeader()
  const supabase = await createClient()
  const today = todayISO()

  const [{ data: tasks }, { count: loggedToday }] = await Promise.all([
    v.teamIds.length
      ? supabase
          .from('tasks')
          .select('id, title, subtitle, instructions, task_type, due_on, sensitive, outcome, person:people!tasks_person_id_fkey(display_name, phone)')
          .in('assignee_team_id', v.teamIds)
          .in('status', ['scheduled', 'due'])
          .order('due_on')
          .limit(50)
      : Promise.resolve({ data: [] as never[] }),
    supabase.from('touches').select('id', { count: 'exact', head: true }).eq('by_user', v.userId).gte('occurred_at', today + 'T00:00:00'),
  ])
  const list = tasks ?? []

  return (
    <>
      <header className="gold-rule bg-navy-900 px-6 pt-10 pb-16 text-white">
        <div className="flex items-center gap-3">
          <Logo size={52} />
          <span className="text-lg text-white/85">KAM Care · Leader</span>
        </div>
        <h1 className="mt-5 font-serif text-[2rem] leading-tight font-semibold">
          {leaderTitle(v.title, v.displayName, v.firstName)}, you have {list.length} task{list.length === 1 ? '' : 's'}
        </h1>
        <p className="mt-1 text-lg text-white/80">
          {loggedToday ?? 0} logged today{v.campusName ? ` · ${v.campusName}` : ''}
        </p>
      </header>

      <main className="-mt-8 space-y-5 rounded-t-3xl bg-canvas px-4 pt-6">
        {!list.length && (
          <p className="rounded-2xl border border-[#e5e2dc] bg-white p-6 text-[17px] text-ink-muted">
            No open tasks right now. New tasks will arrive here and by text.
          </p>
        )}
        {list.map((t) => {
          const person = t.person as { display_name: string; phone: string | null } | null
          const label = dueLabel(t.due_on, today)
          const isToday = t.due_on <= today
          return (
            <article key={t.id} className="rounded-2xl border border-[#e5e2dc] bg-white p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-semibold">{person?.display_name ?? 'Member'}</h2>
                  <p className="mt-0.5 text-lg text-ink-muted">{t.title}{t.subtitle ? ` · ${t.subtitle}` : ''}</p>
                </div>
                <span className={clsx('shrink-0 rounded-full px-3 py-1 text-[15px] font-semibold', isToday ? 'bg-urgent-bg text-urgent' : 'bg-[#e8ecf2] text-navy-900')}>
                  {label}
                </span>
              </div>
              {t.sensitive && (
                <p className="mt-4 flex items-center gap-2 rounded-lg bg-navy-100 px-4 py-3 text-[17px] text-navy-900">
                  <Lock className="size-5" aria-hidden /> Sensitive · you see your task only
                </p>
              )}
              {t.instructions && <p className="mt-4 text-lg">{t.instructions}</p>}
              {t.outcome === 'left_message' && <p className="mt-2 text-[15px] text-ink-muted">Last attempt: left a message.</p>}
              {t.outcome === 'needs_pastor' && <p className="mt-2 text-[15px] text-ink-muted">Handed to the campus pastor.</p>}
              <div className="mt-5 grid grid-cols-2 gap-3">
                {person?.phone ? (
                  <>
                    <a href={`tel:${person.phone}`} className="rounded-xl border border-[#d9d6cf] py-3.5 text-center text-lg font-semibold hover:bg-canvas">Call</a>
                    <a href={`sms:${person.phone}`} className="rounded-xl border border-[#d9d6cf] py-3.5 text-center text-lg font-semibold hover:bg-canvas">Text</a>
                  </>
                ) : (
                  <p className="col-span-2 text-[15px] text-ink-muted">No phone number on file. Ask the church office.</p>
                )}
              </div>
              <form action={logOutcome} className="mt-5">
                <input type="hidden" name="task_id" value={t.id} />
                <input type="hidden" name="task_type" value={t.task_type} />
                <p className="mb-2 text-[15px] font-semibold text-ink-muted">Log outcome</p>
                <div className="flex flex-wrap gap-2.5">
                  {OUTCOME_BUTTONS.map((o) => (
                    <button key={o.value} name="outcome" value={o.value} className={clsx('rounded-full px-5 py-3 text-[17px] font-semibold hover:opacity-85', o.cls)}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </form>
            </article>
          )
        })}
        <NoticedForm />
        <form action="/auth/signout" method="post" className="pt-2 text-center">
          <button className="text-sm text-ink-muted hover:text-ink">Sign out</button>
        </form>
      </main>
    </>
  )
}
