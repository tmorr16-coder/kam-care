import { runCron } from '@/lib/cron-run'
import { isOneChurchConfigured } from '@/lib/onechurch/client'
import { reconcile } from '@/lib/onechurch/sync'

export const maxDuration = 800

/** Nightly at 2 AM Eastern: catch anything webhooks missed (people, roles, giving patterns). */
export function GET(request: Request) {
  return runCron(request, 'reconcile', async (db) => {
    if (!isOneChurchConfigured()) return { skipped: 'ONECHURCH_API_KEY not set' }
    const notes: string[] = []
    const stats = await reconcile(db, (m) => notes.push(m))
    if (stats.rateLimited) {
      await db.from('oc_webhook_events').insert({ event: 'reconcile', payload: {}, status: 'processed', http_status: 429, summary: notes.at(-1) ?? 'Rate limited; resumed' })
    }
    return stats
  })
}
