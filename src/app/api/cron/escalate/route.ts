import { runCron } from '@/lib/cron-run'
import { escalateOverdue, promoteDueTasks } from '@/lib/care/engine'

export const maxDuration = 60

/** Hourly: tasks that come due text their leader; tasks 48h overdue move up a level. */
export function GET(request: Request) {
  return runCron(request, 'escalate', async (db) => ({
    tasksDue: await promoteDueTasks(db),
    escalated: await escalateOverdue(db),
  }))
}
