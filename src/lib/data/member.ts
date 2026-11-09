import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { addDays, todayISO } from '@/lib/dates'

type Sb = Awaited<ReturnType<typeof createClient>>

/** Everything the member page needs. Reads go through the viewer's client so RLS applies. */
export async function loadMember(sb: Sb, personId: string, isPastor: boolean) {
  const { data: person } = await sb
    .from('people')
    .select('*, campus:campuses(name)')
    .eq('id', personId)
    .maybeSingle()
  if (!person) return null

  const today = todayISO()
  const since12w = addDays(today, -84)
  const [
    { data: care }, { data: consent }, { data: cases }, { data: signals }, { data: touches }, { data: attendance },
    { data: checkins }, { data: household }, { data: teams }, { data: notes },
  ] = await Promise.all([
    sb.from('person_care').select('*, team:care_teams!person_care_primary_team_fk(id, name)').eq('person_id', personId).maybeSingle(),
    sb.from('consents').select('*').eq('person_id', personId).maybeSingle(),
    sb.from('care_cases').select('*').eq('person_id', personId).eq('status', 'open').order('opened_at', { ascending: false }),
    sb.from('signals').select('id, kind, summary, source, severity, occurred_at').eq('person_id', personId).order('occurred_at', { ascending: false }).limit(25),
    sb.from('touches').select('id, channel, summary, occurred_at, outcome').eq('person_id', personId).order('occurred_at', { ascending: false }).limit(25),
    sb.from('attendance').select('kind, meeting_date').eq('person_id', personId).gte('meeting_date', since12w),
    sb.from('checkins').select('score, created_at').eq('person_id', personId).order('created_at', { ascending: false }).limit(8),
    person.household_id
      ? sb.from('people').select('id, display_name, family_position, member_since, birthday').eq('household_id', person.household_id).neq('id', personId)
      : Promise.resolve({ data: [] as { id: string; display_name: string; family_position: string | null; member_since: string | null; birthday: string | null }[] }),
    sb.from('care_teams').select('id, name, slug, subtitle').eq('active', true).order('name'),
    isPastor
      ? sb.from('pastoral_notes').select('id, body, created_at').eq('person_id', personId).order('created_at', { ascending: false }).limit(20)
      : Promise.resolve({ data: [] as { id: string; body: string; created_at: string }[] }),
  ])

  const openCase = cases?.[0] ?? null
  const { data: tasks } = await sb
    .from('tasks')
    .select('id, case_id, title, subtitle, instructions, due_on, status, outcome, sensitive, assignee_team_id, escalation_level, team:care_teams!tasks_assignee_team_id_fkey(name)')
    .eq('person_id', personId)
    .in('status', ['scheduled', 'due'])
    .order('due_on')

  // Staff can't read a "Pastors only" case. Say that one exists (without details) so nobody
  // opens a duplicate.
  let hiddenCase = false
  if (!openCase) {
    const { count } = await createAdminClient().from('care_cases').select('id', { count: 'exact', head: true }).eq('person_id', personId).eq('status', 'open')
    hiddenCase = (count ?? 0) > 0
  }

  const leadersOnOpenTasks = new Set((tasks ?? []).map((t) => t.assignee_team_id).filter(Boolean)).size

  return {
    person: { ...person, campusName: (person.campus as { name: string } | null)?.name ?? null },
    care,
    primaryTeam: (care?.team as { id: string; name: string } | null) ?? null,
    consent,
    openCase,
    hiddenCase,
    tasks: tasks ?? [],
    signals: signals ?? [],
    touches: touches ?? [],
    attendance: attendance ?? [],
    checkins: (checkins ?? []).reverse(),
    household: household ?? [],
    teams: teams ?? [],
    notes: notes ?? [],
    leadersOnOpenTasks,
  }
}

/** The 12 most recent Sundays and Tuesdays, oldest first. */
export function recentWeekdays(dow: number, count = 12, today = todayISO()) {
  const d = new Date(today + 'T12:00:00Z')
  // Most recent day with that weekday on or before today.
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() - dow + 7) % 7))
  const out: string[] = []
  for (let i = 0; i < count; i++) {
    out.unshift(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() - 7)
  }
  return out
}
