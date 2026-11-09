import 'server-only'
import { env } from '@/lib/env'
import type { Paged } from './types'

/**
 * OneChurch API client.
 *
 * - The API key lives only in server environment variables, never in the browser.
 * - OneChurch allows 30 requests per 10 seconds per key. We queue under 25 to leave headroom
 *   for other integrations, and on a 429 we wait for Retry-After and try again.
 */

const WINDOW_MS = 10_000
const MAX_PER_WINDOW = 25
const sentAt: number[] = []
let lastRemaining: number | null = null

export class OneChurchError extends Error {
  constructor(message: string, public status: number, public body?: string) {
    super(message)
  }
}

export function isOneChurchConfigured() {
  return Boolean(env.onechurchApiKey)
}

export function baseUrl() {
  return `https://${env.onechurchTenant}.onechurchsoftware.com/api`
}

export function rateLimitSnapshot() {
  const now = Date.now()
  const used = sentAt.filter((t) => now - t < WINDOW_MS).length
  return { used, limit: 30, remaining: lastRemaining }
}

async function waitForSlot() {
  for (;;) {
    const now = Date.now()
    while (sentAt.length && now - sentAt[0] >= WINDOW_MS) sentAt.shift()
    if (sentAt.length < MAX_PER_WINDOW) {
      sentAt.push(now)
      return
    }
    await sleep(WINDOW_MS - (now - sentAt[0]) + 25)
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

type Query = Record<string, string | number | boolean | undefined | null>

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  query?: Query
  body?: unknown
  /** Called when we had to back off, so callers can log it. */
  onRateLimited?: (retryAfterSeconds: number) => void
}

export async function ocRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const key = env.onechurchApiKey
  if (!key) throw new OneChurchError('OneChurch API key is not configured', 0)

  const url = new URL(baseUrl() + path)
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    await waitForSlot()
    const res = await fetch(url, {
      method: opts.method ?? 'GET',
      headers: {
        'Ocs-Api-Key': key,
        Accept: 'application/json',
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      cache: 'no-store',
    })

    const remaining = res.headers.get('Ocs-Rate-Limit-Remaining')
    if (remaining !== null) lastRemaining = Number(remaining)

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get('Retry-After') ?? '10') || 10
      opts.onRateLimited?.(retryAfter)
      await sleep(retryAfter * 1000)
      continue
    }
    if (res.status >= 500 && attempt < 2) {
      await sleep(1000 * 2 ** attempt)
      continue
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new OneChurchError(`OneChurch ${opts.method ?? 'GET'} ${path} failed: ${res.status}`, res.status, text)
    }
    if (res.status === 204) return undefined as T
    const text = await res.text()
    return (text ? JSON.parse(text) : undefined) as T
  }
  throw new OneChurchError(`OneChurch ${path} still rate limited after retries`, 429)
}

/** Walks every page of a paged endpoint using limit/skip. */
export async function* ocPaginate<T>(path: string, query: Query = {}, pageSize = 100, opts: Omit<RequestOptions, 'query'> = {}) {
  let skip = 0
  for (;;) {
    const page = await ocRequest<Paged<T>>(path, { ...opts, query: { ...query, limit: pageSize, skip } })
    for (const item of page.data ?? []) yield item
    skip += pageSize
    if (!page.data?.length || skip >= page.total) return
  }
}
