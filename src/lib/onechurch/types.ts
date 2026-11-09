// Subset of the OneChurch API schema that KAM Care reads.
// Reference: https://developers.onechurchsoftware.com

export type KeyPair = { id: number; name?: string | null }
export type StringKeyPair = { id?: number; code?: string | null; name?: string | null }

export type Paged<T> = { total: number; limit: number; skip: number; max: number; data: T[] }

export type OcBirthday = { month?: number | null; day?: number | null; year?: number | null; date?: string | null } | null

export type OcPerson = {
  id: number
  title?: string | null
  first?: string | null
  last?: string | null
  nickname?: string | null
  email?: string | null
  phone?: string | null
  location?: KeyPair | null          // primary campus (PersonDetails)
  campus?: KeyPair | null            // primary campus (ListedPersonReport)
  family?: { id?: number; name?: string | null } | number | null
  familyId?: number | null
  familyPosition?: StringKeyPair | null
  birthday?: OcBirthday
  anniversary?: OcBirthday
  archived?: boolean
  deceased?: boolean
  guest?: boolean
  lastAttendedDate?: string | null
  created?: { date?: string | null } | null
}

export type OcGroupMembership = {
  id: number
  person: number
  group: { id: number; name?: string | null }
  role?: StringKeyPair | null
  positions?: KeyPair[] | null
  admin?: boolean
  start?: string | null
  end?: string | null
}

export type OcContribution = {
  id: number
  person?: { id?: number } | null
  amount?: number | null              // read to compute a pattern, never stored
  date?: string | null                // yyyy-MM-dd
  schedule?: number | null            // set when the gift came from a recurring schedule
  status?: StringKeyPair | null
  anonymous?: boolean
}

export type OcAttendance = {
  id: number
  person?: number | null
  event?: KeyPair | null
  categories?: KeyPair[] | null
  groups?: KeyPair[] | null
  date?: string | null
  meetingDate?: string | null         // yyyy-MM-dd
  checkins?: number
}

export type OcFormEntry = {
  id: number
  form?: number | null
  responses?: { field: number; response: unknown }[] | null
  person?: { id?: number; linkedTo?: number | null; first?: string; last?: string; email?: string; phone?: string } | null
}

export type OcConnection = {
  id: number
  person?: { id?: number } | number | null
  type?: KeyPair | null
  date?: string | null
}

export const WEBHOOK_EVENTS = [
  'person_created',
  'person_updated',
  'group_member_added',
  'contribution_created',
  'form_entry_submitted',
  'connection_created',
  'event_registration_created',
] as const
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number]
