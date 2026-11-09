import type { Database } from '@/lib/database.types'

type T = Database['public']['Tables']
export type Enums = Database['public']['Enums']

export type Row<K extends keyof T> = T[K]['Row']
export type Insert<K extends keyof T> = T[K]['Insert']

export type AppRole = Enums['app_role']
export type Urgency = Enums['urgency']
export type Channel = Enums['channel']
export type MomentType = Enums['moment_type']
export type SignalKind = Enums['signal_kind']
export type TaskOutcome = Enums['task_outcome']

export type Person = Row<'people'>
export type CareCase = Row<'care_cases'>
export type Task = Row<'tasks'>
export type CareTeam = Row<'care_teams'>
export type Playbook = Row<'playbooks'>

export type PlaybookStep = { offset_days: number; title: string; task_type: string; team_slug?: string }

export const CHECKIN_LABELS: Record<number, string> = { 5: 'Great', 4: 'Good', 3: 'Okay', 2: 'Hard', 1: 'Very hard' }

export const CHANNEL_LABELS: Record<Channel, string> = {
  text: 'Text', call: 'Call', visit: 'Visit', email: 'Email', app: 'App message', card: 'Card',
}

export const SENSITIVE_REASONS = [
  'Health', 'Employment and finances', 'Family conflict', 'Addiction', 'Legal', 'Abuse', 'Bereavement', 'Giving pattern',
] as const
