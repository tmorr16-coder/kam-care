import { runCron } from '@/lib/cron-run'
import { runDailyEngine } from '@/lib/care/engine'

export const maxDuration = 300

/** Every morning: milestones, missed attendance, shut-in visits, care scores, due tasks, escalation. */
export function GET(request: Request) {
  return runCron(request, 'engine', (db) => runDailyEngine(db))
}
