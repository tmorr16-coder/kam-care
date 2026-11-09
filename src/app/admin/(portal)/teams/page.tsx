import type { Metadata } from 'next'
import Link from 'next/link'
import { requireStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { suggestTeam } from '@/lib/care/engine'
import { fmtShort, todayISO } from '@/lib/dates'
import { Bar, buttonClass, Card, CardHeader, cx, inputClass } from '@/components/ui'
import { AddLeader } from './add-leader'
import { assignTask, updateCapacity } from './actions'

export const metadata: Metadata = { title: 'Care teams' }

const CAMPUS: Record<string, string> = { indianapolis: 'Indianapolis', detroit: 'Detroit', atlanta: 'Atlanta', global: 'Global' }

// Words in a task that hint at which gifts fit it.
function tagsFor(title: string, type: string) {
  const t = `${title} ${type}`.toLowerCase()
  const tags: string[] = []
  if (/hospital|surgery|visit/.test(t)) tags.push('hospital')
  if (/communion|shut-in|home visit/.test(t)) tags.push('communion', 'home visits')
  if (/job|coffee|employment/.test(t)) tags.push('jobs', 'men', 'employment')
  if (/guest|welcome|member class/.test(t)) tags.push('new guests')
  if (/intake|groceries|holiday/.test(t)) tags.push('food', 'holiday')
  if (/check-in call|re-engage/.test(t)) tags.push('re-engagement')
  if (/senior|wellness/.test(t)) tags.push('seniors')
  return tags
}

export default async function TeamsPage() {
  await requireStaff()
  const supabase = await createClient()
  const admin = createAdminClient()
  const today = todayISO()

  const [{ data: teams }, { data: workload }, { data: unassigned }] = await Promise.all([
    supabase.from('care_teams').select('id, name, subtitle, kind, campus_id, weekly_capacity, gifted_for').eq('active', true).order('name'),
    // Counts only, across every task (including pastors-only ones), so capacity is accurate.
    admin.from('tasks').select('assignee_team_id, due_on').in('status', ['scheduled', 'due']).not('assignee_team_id', 'is', null),
    supabase
      .from('tasks')
      .select('id, title, subtitle, task_type, due_on, person_id, person:people!tasks_person_id_fkey(display_name, campus_id)')
      .is('assignee_team_id', null)
      .in('status', ['scheduled', 'due'])
      .order('due_on')
      .limit(10),
  ])

  const open = new Map<string, number>()
  const overdue = new Map<string, number>()
  for (const t of workload ?? []) {
    open.set(t.assignee_team_id!, (open.get(t.assignee_team_id!) ?? 0) + 1)
    if (t.due_on < today) overdue.set(t.assignee_team_id!, (overdue.get(t.assignee_team_id!) ?? 0) + 1)
  }
  const teamName = new Map((teams ?? []).map((t) => [t.id, t]))

  const suggestions = await Promise.all(
    (unassigned ?? []).map(async (task) => {
      const person = task.person as { display_name: string; campus_id: string | null } | null
      const { data: pc } = await admin.from('person_care').select('primary_team_id').eq('person_id', task.person_id).maybeSingle()
      const primary = pc?.primary_team_id ? teamName.get(pc.primary_team_id) : undefined
      const primaryOver = primary ? (open.get(primary.id) ?? 0) >= primary.weekly_capacity : false
      const tags = tagsFor(task.title, task.task_type)
      const best = primary && !primaryOver ? { id: primary.id, name: primary.name } : await suggestTeam(admin, { campusId: person?.campus_id, tags })
      const team = best ? teamName.get(best.id) : undefined
      const why = [
        person?.campus_id ? CAMPUS[person.campus_id] : null,
        tags[0] ?? null,
        primaryOver && primary ? `${primary.name} is over capacity` : team ? `${team.name} has room` : null,
      ].filter(Boolean).join(' · ')
      return { task, person, best: team, why }
    }),
  )

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/admin" className="text-sm text-navy-800 hover:underline">← Care queue</Link>
      <header className="mt-3 mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Care teams</h1>
          <p className="mt-1 text-[15px] text-ink-muted">Who&apos;s carrying what, and where to send the next task</p>
        </div>
        <AddLeader />
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <Card className="overflow-hidden">
          <CardHeader title="Leaders & workload" right={<p className="text-xs text-ink-muted">Capacity = open tasks vs. the weekly limit each leader set</p>} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-canvas text-left text-xs tracking-wider text-ink-muted uppercase">
                <tr>
                  {['Leader', 'Campus', 'Open', 'Overdue', 'Capacity', 'Gifted for'].map((h) => <th key={h} scope="col" className="px-5 py-3 font-medium">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {(teams ?? []).map((t) => {
                  const n = open.get(t.id) ?? 0
                  const late = overdue.get(t.id) ?? 0
                  const over = n >= t.weekly_capacity && n > 0
                  const ratio = n / t.weekly_capacity
                  return (
                    <tr key={t.id} className="border-t border-line align-top">
                      <th scope="row" className="px-5 py-3.5 text-left">
                        <span className="block font-semibold">{t.name}</span>
                        <span className="text-xs font-normal text-ink-muted">{t.subtitle ?? (t.kind === 'team' ? 'Team' : 'Leader')}</span>
                      </th>
                      <td className="px-5 py-3.5">{t.campus_id ? CAMPUS[t.campus_id] : 'All'}</td>
                      <td className="px-5 py-3.5 tabular-nums">{n}</td>
                      <td className={cx('px-5 py-3.5 tabular-nums', late > 0 && 'font-semibold text-urgent')}>{late}</td>
                      <td className="w-48 px-5 py-3.5">
                        <Bar value={n} max={t.weekly_capacity} tone={over ? 'red' : ratio >= 0.8 ? 'gold' : 'navy'} />
                        <form action={updateCapacity} className="mt-1 flex items-center gap-1 text-xs text-ink-muted">
                          <input type="hidden" name="teamId" value={t.id} />
                          <span>{n} of</span>
                          <label className="sr-only" htmlFor={`cap-${t.id}`}>Weekly limit for {t.name}</label>
                          <input id={`cap-${t.id}`} name="capacity" type="number" min={1} max={200} defaultValue={t.weekly_capacity} className="w-12 rounded border border-transparent px-1 py-0.5 hover:border-line focus:border-navy-700" />
                          {over && <span>· over capacity</span>}
                          <button className="ml-auto rounded px-1 text-navy-800 hover:underline">Save</button>
                        </form>
                      </td>
                      <td className="px-5 py-3.5 text-ink-muted">{t.gifted_for.join(', ')}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="pb-2">
            <CardHeader title="Unassigned · suggested match" />
            {suggestions.length === 0 && <p className="px-5 pb-4 text-sm text-ink-muted">Every open task has a leader.</p>}
            <ul>
              {suggestions.map(({ task, person, best, why }) => (
                <li key={task.id} className="border-t border-line px-5 py-4">
                  <p className="text-sm font-semibold">{task.title} · {person?.display_name ?? 'Member'} ({fmtShort(task.due_on)})</p>
                  {why && <p className="mt-1 text-xs text-ink-muted">{why}</p>}
                  {best && (
                    <form action={assignTask} className="mt-3">
                      <input type="hidden" name="taskId" value={task.id} />
                      <input type="hidden" name="teamId" value={best.id} />
                      <button className={buttonClass('primary', 'sm')}>Assign {best.name}</button>
                    </form>
                  )}
                  <details className="mt-2">
                    <summary className={cx(buttonClass('secondary', 'sm'), 'cursor-pointer list-none')}>Choose someone else</summary>
                    <form action={assignTask} className="mt-2 flex gap-2">
                      <input type="hidden" name="taskId" value={task.id} />
                      <label className="sr-only" htmlFor={`pick-${task.id}`}>Leader</label>
                      <select id={`pick-${task.id}`} name="teamId" className={inputClass} required defaultValue="">
                        <option value="" disabled>Pick a leader</option>
                        {(teams ?? []).map((t) => (
                          <option key={t.id} value={t.id}>{t.name} · {open.get(t.id) ?? 0}/{t.weekly_capacity}</option>
                        ))}
                      </select>
                      <button className={buttonClass('primary', 'sm')}>Assign</button>
                    </form>
                  </details>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-5">
            <h2 className="font-serif text-xl font-semibold">Escalation path</h2>
            <ol className="mt-4 space-y-3">
              {['Care leader / deacon', 'Campus pastor', 'Associate pastor, Member Care', 'Senior pastor'].map((s, i) => (
                <li key={s} className="flex items-center gap-3 text-sm">
                  <span className={cx('flex size-7 items-center justify-center rounded-full text-xs font-semibold', i === 3 ? 'bg-navy-800 text-white' : 'bg-navy-100 text-navy-900')}>{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
            <p className="mt-4 rounded-lg bg-urgent-bg p-3 text-sm text-[#7a1a12]">
              <strong>Auto-escalate:</strong> a task 48h overdue moves up one level. A safety concern goes straight to step 4.
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}
