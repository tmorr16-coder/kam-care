import 'server-only'
import { timingSafeEqual } from 'node:crypto'
import { env } from '@/lib/env'

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. */
export function isAuthorizedCron(request: Request) {
  const secret = env.cronSecret
  if (!secret) return false
  return safeEqual(request.headers.get('authorization') ?? '', `Bearer ${secret}`)
}
