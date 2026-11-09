import { runCron } from '@/lib/cron-run'
import { isOneChurchConfigured } from '@/lib/onechurch/client'
import { syncAttendanceBatch } from '@/lib/onechurch/sync'

export const maxDuration = 300

/** Every 30 minutes: pull attendance for the next slice of members who allow it. */
export function GET(request: Request) {
  return runCron(request, 'attendance', async (db) => {
    if (!isOneChurchConfigured()) return { skipped: 'ONECHURCH_API_KEY not set' }
    return syncAttendanceBatch(db)
  })
}
