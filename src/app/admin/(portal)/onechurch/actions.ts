'use server'
import { after } from 'next/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { assertStaff } from '@/lib/auth'
import { env } from '@/lib/env'
import { createAdminClient } from '@/lib/supabase/admin'
import { isOneChurchConfigured, OneChurchError, ocRequest } from '@/lib/onechurch/client'
import type { Paged } from '@/lib/onechurch/types'
import { registerWebhooks } from '@/lib/onechurch/sync'
import { todayISO } from '@/lib/dates'

export type ActionResult = { ok?: boolean; message?: string; error?: string; at?: number }

async function guard(): Promise<ActionResult | null> {
  try {
    await assertStaff({ admin: true })
    return null
  } catch {
    return { error: 'Admins only.', at: Date.now() }
  }
}

function explain(e: unknown) {
  if (e instanceof OneChurchError) {
    if (e.status === 401) return 'OneChurch rejected the API key (401). Check ONECHURCH_API_KEY.'
    if (e.status === 403) return 'The API key is missing a permission for this call (403).'
    if (e.status === 0) return e.message
    return `${e.message}${e.body ? ` · ${e.body.slice(0, 160)}` : ''}`
  }
  return e instanceof Error ? e.message : String(e)
}

export async function testConnection(): Promise<ActionResult> {
  const denied = await guard()
  if (denied) return denied
  if (!isOneChurchConfigured()) return { error: 'No API key yet. Add ONECHURCH_API_KEY in Vercel and redeploy.', at: Date.now() }
  try {
    const started = Date.now()
    const page = await ocRequest<Paged<unknown>>('/people', { query: { limit: 1 } })
    return { ok: true, message: `Connected to ${env.onechurchTenant}.onechurchsoftware.com · ${page.total.toLocaleString()} people · ${Date.now() - started} ms`, at: Date.now() }
  } catch (e) {
    return { error: explain(e), at: Date.now() }
  }
}

/** Starts the reconcile cron job in its own function so it can run up to 13 minutes. */
export async function runReconcile(): Promise<ActionResult> {
  const denied = await guard()
  if (denied) return denied
  if (!isOneChurchConfigured()) return { error: 'No API key yet. Add ONECHURCH_API_KEY first.', at: Date.now() }
  if (!env.cronSecret) return { error: 'Set CRON_SECRET in Vercel so the reconcile job can be started.', at: Date.now() }
  const db = createAdminClient()
  const { data: running } = await db.from('sync_runs').select('id').eq('kind', 'reconcile').is('finished_at', null).gte('started_at', new Date(Date.now() - 15 * 60_000).toISOString()).maybeSingle()
  if (running) return { ok: true, message: 'A reconcile is already running. Check back in a few minutes.', at: Date.now() }
  after(async () => {
    await fetch(`${env.siteUrl}/api/cron/reconcile`, { headers: { Authorization: `Bearer ${env.cronSecret}` }, cache: 'no-store' }).catch((e) => console.error('reconcile trigger failed', e))
  })
  return { ok: true, message: 'Reconcile started. It runs in the background; results appear under Sync history.', at: Date.now() }
}

export async function registerWebhooksAction(): Promise<ActionResult> {
  const denied = await guard()
  if (denied) return denied
  if (!isOneChurchConfigured()) return { error: 'No API key yet. Add ONECHURCH_API_KEY first.', at: Date.now() }
  try {
    const added = await registerWebhooks(createAdminClient())
    revalidatePath('/admin/onechurch')
    return { ok: true, message: added.length ? `Subscribed: ${added.join(', ')}` : 'All webhooks were already registered.', at: Date.now() }
  } catch (e) {
    return { error: explain(e), at: Date.now() }
  }
}

export async function markKeyRotated() {
  await assertStaff({ admin: true })
  await createAdminClient().from('app_settings').upsert({ key: 'api_key_rotated_on', value: todayISO(), updated_at: new Date().toISOString() })
  revalidatePath('/admin/onechurch')
}

export async function setWriteBack(formData: FormData) {
  await assertStaff({ admin: true })
  const on = formData.get('writeBack') === 'on'
  await createAdminClient().from('app_settings').upsert({ key: 'write_back_to_onechurch', value: on, updated_at: new Date().toISOString() })
  revalidatePath('/admin/onechurch')
}

export type PersonHit = { id: string; name: string; detail: string }

export async function searchPeople(_prev: { results: PersonHit[]; q: string }, formData: FormData) {
  await assertStaff({ admin: true })
  const q = z.string().trim().max(80).parse(formData.get('q') ?? '')
  if (q.length < 2) return { results: [], q }
  const like = `%${q.replace(/[%_,()]/g, '')}%`
  const { data } = await createAdminClient()
    .from('people')
    .select('id, display_name, email, phone, campus_id')
    .eq('archived', false)
    .or(`first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`)
    .limit(8)
  return {
    q,
    results: (data ?? []).map((p) => ({ id: p.id, name: p.display_name ?? '', detail: [p.email, p.phone, p.campus_id].filter(Boolean).join(' · ') })),
  }
}

export async function resolveMatch(formData: FormData) {
  const viewer = await assertStaff({ admin: true })
  const reviewId = z.guid().parse(formData.get('reviewId'))
  const personId = z.guid().parse(formData.get('personId'))
  const db = createAdminClient()
  const { data: review } = await db.from('match_reviews').select('user_id').eq('id', reviewId).single()
  if (!review) throw new Error('Review not found')
  const { data: taken } = await db.from('profiles').select('user_id').eq('person_id', personId).neq('user_id', review.user_id).maybeSingle()
  if (taken) throw new Error('That person already has a KAM Care login.')
  const { data: person } = await db.from('people').select('campus_id').eq('id', personId).single()
  await db.from('profiles').update({ person_id: personId, match_status: 'matched', campus_id: person?.campus_id ?? null }).eq('user_id', review.user_id)
  await db.from('match_reviews').update({ status: 'resolved', resolved_by: viewer.userId }).eq('id', reviewId)
  revalidatePath('/admin/onechurch')
}

export async function rejectMatch(formData: FormData) {
  const viewer = await assertStaff({ admin: true })
  const reviewId = z.guid().parse(formData.get('reviewId'))
  const db = createAdminClient()
  const { data: review } = await db.from('match_reviews').update({ status: 'rejected', resolved_by: viewer.userId }).eq('id', reviewId).select('user_id').single()
  if (review) await db.from('profiles').update({ match_status: 'rejected' }).eq('user_id', review.user_id)
  revalidatePath('/admin/onechurch')
}
