import 'server-only'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCron } from '@/lib/cron'
import { errorText } from '@/lib/onechurch/sync'

type Db = ReturnType<typeof createAdminClient>

/** Runs a cron job with auth and a sync_runs record. */
export async function runCron(request: Request, kind: string, job: (db: Db) => Promise<Record<string, unknown>>) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const db = createAdminClient()
  const { data: run, error: logError } = await db.from('sync_runs').insert({ kind }).select('id').single()
  if (logError) console.error(`[cron:${kind}] could not write sync_runs`, logError.message)
  try {
    const stats = await job(db)
    await db.from('sync_runs').update({ ok: true, finished_at: new Date().toISOString(), stats: stats as never }).eq('id', run?.id ?? -1)
    return NextResponse.json({ ok: true, stats })
  } catch (e) {
    console.error(`[cron:${kind}]`, e)
    await db.from('sync_runs').update({ ok: false, finished_at: new Date().toISOString(), error: errorText(e).slice(0, 1000) }).eq('id', run?.id ?? -1)
    return NextResponse.json({ ok: false, error: errorText(e) }, { status: 500 })
  }
}
