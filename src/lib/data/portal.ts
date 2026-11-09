import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { fmtShort, todayISO } from '@/lib/dates'

/**
 * Member-facing timeline for "My requests".
 *
 * Members can't read touches or tasks directly (RLS), so this reads them with the service
 * client, but only for the member's own person_id, and turns each into friendly text.
 * Internal outcomes ("needs a pastor"), sensitive reasons, notes and instructions never leave here.
 */

export type Step = { label: string; done: boolean }
export type MemberCard = {
  id: string
  title: string
  sub: string
  status: { label: string; tone: 'warn' | 'ok' | 'navy' | 'neutral' }
  steps: Step[]
  sortAt: string
}

type TeamRef = { name: string; kind: string; person: { title: string | null; first_name: string; last_name: string } | null } | null

/** "Deacon Hayes", "Sis. Carter", or a team name. */
export function leaderName(team: TeamRef) {
  if (!team) return 'Your care team'
  const p = team.person
  if (team.kind === 'person' && p) {
    const title = p.title === 'Dcn.' ? 'Deacon' : p.title === 'Bro.' ? 'Brother' : p.title === 'Sis.' ? 'Sister' : p.title
    return title ? `${title} ${p.last_name}` : `${p.first_name} ${p.last_name}`
  }
  return team.name
}

const ITEM_LABELS: Record<string, string> = {
  groceries: 'groceries', holiday: 'holiday help', bills: 'bills & rent', ride: 'a ride', counseling: 'counseling', other: 'other resources',
}
const VIS_LABELS: Record<string, string> = { pastors: 'Pastors only', prayer_team: 'Prayer team', church: 'Church family' }
const MOMENT_LABELS: Record<string, string> = {
  birth: 'New baby', wedding: 'Wedding', promotion: 'Promotion', award: 'Award or graduation', anniversary: 'Anniversary',
  moved: 'New home', sickness: 'Illness or surgery', bereavement: 'Loss of a loved one', job_loss: 'Job loss', other: 'Life moment',
  work_anniversary: 'Work anniversary', shut_in: 'Visit', birthday: 'Birthday',
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function touchText(channel: string, outcome: string | null, who: string, date: string) {
  const d = fmtShort(date)
  if (outcome === 'left_message') return `${who} left you a message · ${d}`
  switch (channel) {
    case 'call': return `${who} called you · ${d}`
    case 'text': return `${who} texted you · ${d}`
    case 'visit': return `Visit from ${who} · ${d}`
    case 'card': return `Card from ${who}`
    case 'email': return `Email from ${who} · ${d}`
    default: return `${who} reached out · ${d}`
  }
}

const UPCOMING: Record<string, string> = { coffee: 'Follow-up coffee', visit: 'Visit', call: 'Follow-up call' }

export async function getMemberRequests(personId: string) {
  const supabase = await createClient()
  const [{ data: requests }, { data: moments }] = await Promise.all([
    supabase.from('care_requests').select('id, kind, topic, items, visibility, status, case_id, created_at').eq('person_id', personId).order('created_at', { ascending: false }).limit(20),
    supabase.from('life_moments').select('id, type, who, status, case_id, created_at, source').eq('person_id', personId).eq('source', 'portal').order('created_at', { ascending: false }).limit(20),
  ])

  const caseIds = [...new Set([...(requests ?? []), ...(moments ?? [])].map((r) => r.case_id).filter((x): x is string => !!x))]
  const admin = createAdminClient()
  const teamSel = 'name, kind, person:people!care_teams_person_id_fkey(title, first_name, last_name)'
  const [{ data: touches }, { data: tasks }] = caseIds.length
    ? await Promise.all([
        admin.from('touches').select(`case_id, channel, outcome, occurred_at, team:care_teams(${teamSel})`).eq('person_id', personId).in('case_id', caseIds).order('occurred_at'),
        admin.from('tasks').select(`case_id, task_type, due_on, status, team:care_teams(${teamSel})`).eq('person_id', personId).in('case_id', caseIds).in('status', ['scheduled', 'due']).order('due_on'),
      ])
    : [{ data: [] }, { data: [] }]

  const stepsFor = (caseId: string | null): Step[] => {
    if (!caseId) return []
    const out: Step[] = []
    for (const t of touches ?? []) {
      if (t.case_id !== caseId || t.outcome === 'needs_pastor') continue
      out.push({ label: touchText(t.channel, t.outcome, leaderName(t.team as TeamRef), t.occurred_at), done: true })
    }
    for (const t of tasks ?? []) {
      const label = UPCOMING[t.task_type]
      const team = t.team as TeamRef
      if (t.case_id !== caseId || !label || !team) continue
      out.push({ label: `${label} with ${leaderName(team)} · ${fmtShort(t.due_on)}`, done: false })
    }
    return out
  }

  const cards: MemberCard[] = []
  for (const r of requests ?? []) {
    const status =
      r.status === 'approved' ? { label: 'Approved', tone: 'ok' as const }
        : r.status === 'closed' ? { label: 'Closed', tone: 'neutral' as const }
          : r.status === 'in_progress' || r.case_id ? { label: 'In progress', tone: 'warn' as const }
            : { label: 'Received', tone: 'neutral' as const }
    const base: Record<string, { title: string; who: string; first: string }> = {
      prayer: { title: 'Prayer request', who: VIS_LABELS[r.visibility] ?? 'Pastors only', first: 'Received by the prayer team' },
      pastor_call: { title: 'Talk to a pastor', who: 'Pastoral team', first: 'Received by the pastoral team' },
      practical: { title: r.items.length ? cap(r.items.map((i) => ITEM_LABELS[i] ?? i).join(' & ')) : 'Practical help', who: 'Benevolence team', first: 'Received' },
      counseling: { title: 'Counseling', who: 'Confidential', first: 'Received by Counseling Services' },
    }
    const b = base[r.kind]
    const steps: Step[] = [{ label: b.first, done: true }, ...stepsFor(r.case_id)]
    if (r.kind === 'practical' && r.status === 'approved') steps.splice(1, 0, { label: 'Approved by the benevolence team', done: true })
    cards.push({ id: r.id, title: b.title, sub: `Sent ${fmtShort(r.created_at)} · ${b.who}`, status, steps, sortAt: r.created_at })
  }
  for (const m of moments ?? []) {
    const label = MOMENT_LABELS[m.type] ?? 'Life moment'
    const steps = stepsFor(m.case_id)
    cards.push({
      id: m.id,
      title: m.who && m.who !== 'Our family' ? `${label}: ${m.who}` : label,
      sub: `Shared ${fmtShort(m.created_at)}`,
      status: m.status === 'celebrated' ? { label: 'Celebrated', tone: 'navy' } : { label: 'Shared', tone: 'navy' },
      steps: steps.length ? steps : [{ label: 'Your care team has it', done: true }],
      sortAt: m.created_at,
    })
  }
  cards.sort((a, b) => b.sortAt.localeCompare(a.sortAt))
  return cards
}

/** The most recent call or visit in the last 30 days that the member hasn't rated yet. */
export async function getRatingPrompt(personId: string) {
  const admin = createAdminClient()
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const { data: touch } = await admin
    .from('touches')
    .select('id, channel, team:care_teams(name, kind, person:people!care_teams_person_id_fkey(title, first_name, last_name))')
    .eq('person_id', personId)
    .eq('outcome', 'reached')
    .in('channel', ['call', 'visit'])
    .gte('occurred_at', since)
    .lte('occurred_at', new Date(todayISO() + 'T23:59:59Z').toISOString())
    .order('occurred_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!touch) return null
  const supabase = await createClient()
  const { data: rated } = await supabase.from('care_ratings').select('id').eq('touch_id', touch.id).maybeSingle()
  if (rated) return null
  return { touchId: touch.id, who: leaderName(touch.team as TeamRef), what: touch.channel === 'visit' ? 'visit' : 'call' }
}
