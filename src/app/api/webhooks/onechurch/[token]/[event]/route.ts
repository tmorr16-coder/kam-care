import { after, NextResponse, type NextRequest } from 'next/server'
import { env } from '@/lib/env'
import { safeEqual } from '@/lib/cron'
import { createAdminClient } from '@/lib/supabase/admin'
import { processWebhook } from '@/lib/onechurch/sync'
import { WEBHOOK_EVENTS } from '@/lib/onechurch/types'

export const maxDuration = 60

/**
 * OneChurch webhook receiver: POST /api/webhooks/onechurch/{token}/{event}
 *
 * OneChurch doesn't sign deliveries yet, so:
 *   - the URL carries a long random token (ONECHURCH_WEBHOOK_TOKEN), and
 *   - we never trust the payload: we take the record id and re-fetch it from the API.
 * We store the delivery, answer 200 right away, and do the work after the response.
 * We never answer 410 (OneChurch deletes the subscription on 410).
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ token: string; event: string }> }) {
  const { token, event } = await ctx.params
  const expected = env.onechurchWebhookToken
  if (!expected || !safeEqual(token, expected)) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (!(WEBHOOK_EVENTS as readonly string[]).includes(event)) return NextResponse.json({ ok: true, ignored: event })

  const raw = await request.text()
  if (raw.length > 256_000) return NextResponse.json({ error: 'payload too large' }, { status: 413 })
  let payload: unknown = {}
  try {
    payload = raw ? JSON.parse(raw) : {}
  } catch {
    payload = { raw: raw.slice(0, 2000) }
  }

  const db = createAdminClient()
  const { data: row } = await db.from('oc_webhook_events').insert({ event, payload: payload as never }).select('id').single()

  after(async () => {
    try {
      const summary = await processWebhook(db, event, payload)
      await db.from('oc_webhook_events').update({ status: 'processed', summary, processed_at: new Date().toISOString() }).eq('id', row!.id)
    } catch (e) {
      console.error('[onechurch webhook]', event, e)
      await db.from('oc_webhook_events').update({ status: 'failed', error: String(e).slice(0, 500), processed_at: new Date().toISOString() }).eq('id', row!.id)
    }
  })

  return NextResponse.json({ ok: true })
}
