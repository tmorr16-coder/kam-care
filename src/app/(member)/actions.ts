'use server'
import { after } from 'next/server'
import { redirect } from 'next/navigation'
import { refresh } from 'next/cache'
import { requireMember } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { onCareRequest, onCheckin, onLifeMoment } from '@/lib/care/engine'
import type { Channel, Insert, MomentType } from '@/lib/types'

const text = (fd: FormData, k: string, max = 2000) => {
  const v = String(fd.get(k) ?? '').trim()
  return v ? v.slice(0, max) : null
}

/** Runs the care engine after the response is sent, so members never wait on it. */
function runLater(fn: () => Promise<unknown>) {
  after(() => fn().catch((e) => console.error('[care-engine]', e)))
}

export async function submitCheckin(formData: FormData) {
  const v = await requireMember()
  const score = Number(formData.get('score'))
  if (!Number.isInteger(score) || score < 1 || score > 5) redirect('/home?error=checkin')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('checkins')
    .insert({ person_id: v.personId, score, note: text(formData, 'note', 1000), wants_contact: formData.get('wants_contact') === 'on' })
    .select('id')
    .single()
  if (error) throw error
  runLater(() => onCheckin(createAdminClient(), data.id))
  redirect('/home?sent=checkin')
}

const TOPICS = ['Health', 'Family', 'Work & finances', 'Grief', 'Spiritual growth', 'Salvation of a loved one', 'Thanksgiving']
const VISIBILITY = ['pastors', 'prayer_team', 'church'] as const

async function createRequest(row: {
  kind: 'prayer' | 'pastor_call' | 'practical' | 'counseling'
  topic?: string | null
  body?: string | null
  items?: string[]
  visibility?: (typeof VISIBILITY)[number]
  wants_call?: boolean
  contact_pref?: Channel | null
}) {
  const v = await requireMember()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('care_requests')
    .insert({ person_id: v.personId, source: 'portal', ...row })
    .select('id')
    .single()
  if (error) throw error
  runLater(() => onCareRequest(createAdminClient(), data.id))
}

export async function submitPrayer(formData: FormData) {
  const topic = text(formData, 'topic')
  const visibility = String(formData.get('visibility') ?? 'pastors') as (typeof VISIBILITY)[number]
  const body = text(formData, 'body')
  if (!body) redirect('/pray?error=empty')
  await createRequest({
    kind: 'prayer',
    topic: topic && TOPICS.includes(topic) ? topic : null,
    body,
    visibility: VISIBILITY.includes(visibility) ? visibility : 'pastors',
    wants_call: formData.get('wants_call') === 'on',
  })
  redirect('/requests?sent=prayer')
}

const ITEMS = ['groceries', 'holiday', 'bills', 'ride', 'counseling', 'other']
const CONTACT: Channel[] = ['text', 'call', 'email']

export async function submitPractical(formData: FormData) {
  const items = formData.getAll('items').map(String).filter((i) => ITEMS.includes(i))
  if (!items.length) redirect('/help?error=empty')
  const pref = String(formData.get('contact_pref') ?? 'text') as Channel
  await createRequest({
    kind: 'practical',
    items,
    body: text(formData, 'body'),
    visibility: 'pastors',
    contact_pref: CONTACT.includes(pref) ? pref : 'text',
  })
  redirect('/requests?sent=help')
}

export async function submitPastorCall(formData: FormData) {
  await createRequest({ kind: 'pastor_call', body: text(formData, 'body'), visibility: 'pastors', wants_call: true, contact_pref: 'call' })
  redirect('/requests?sent=pastor')
}

export async function submitCounseling(formData: FormData) {
  await createRequest({ kind: 'counseling', body: text(formData, 'body'), visibility: 'pastors', contact_pref: 'call' })
  redirect('/requests?sent=counseling')
}

const MOMENTS: MomentType[] = ['birth', 'wedding', 'promotion', 'award', 'anniversary', 'moved', 'sickness', 'bereavement', 'job_loss', 'other']

export async function submitMoment(formData: FormData) {
  const v = await requireMember()
  const type = String(formData.get('type') ?? '') as MomentType
  const date = String(formData.get('date') ?? '')
  if (!MOMENTS.includes(type) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) redirect('/moment?error=missing')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('life_moments')
    .insert({
      person_id: v.personId,
      type,
      moment_date: date,
      who: text(formData, 'who', 200),
      note: text(formData, 'note'),
      share_with_church: formData.get('share') === 'on',
      remind_yearly: formData.get('remind') === 'on',
      source: 'portal',
    })
    .select('id')
    .single()
  if (error) throw error
  runLater(() => onLifeMoment(createAdminClient(), data.id))
  redirect('/requests?sent=moment')
}

const CONSENT_FIELDS = ['weekly_checkin', 'texts', 'emails', 'use_attendance', 'celebrate_milestones', 'use_giving'] as const
export type ConsentField = (typeof CONSENT_FIELDS)[number]

export async function saveConsent(field: ConsentField, value: boolean) {
  const v = await requireMember()
  if (!CONSENT_FIELDS.includes(field)) throw new Error('Unknown setting')
  const supabase = await createClient()
  const row: Insert<'consents'> = { person_id: v.personId, updated_at: new Date().toISOString() }
  row[field] = value
  const { error } = await supabase.from('consents').upsert(row, { onConflict: 'person_id' })
  if (error) throw error
  // Turning off giving consent removes any stored pattern right away.
  if (field === 'use_giving' && !value) {
    const personId = v.personId
    runLater(async () => createAdminClient().from('giving_patterns').delete().eq('person_id', personId))
  }
}

export async function rateTouch(formData: FormData) {
  const v = await requireMember()
  const rating = Number(formData.get('rating'))
  const touchId = String(formData.get('touch_id') ?? '')
  if (!Number.isInteger(rating) || rating < 1 || rating > 5 || !touchId) return
  // Only rate a touch that was actually with this member.
  const { data: touch } = await createAdminClient().from('touches').select('person_id').eq('id', touchId).maybeSingle()
  if (touch?.person_id !== v.personId) return
  const supabase = await createClient()
  await supabase.from('care_ratings').insert({ person_id: v.personId, touch_id: touchId, rating })
  refresh()
}
