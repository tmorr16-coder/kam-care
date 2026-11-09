'use client'
import { useEffect, useRef } from 'react'

// Cloudflare Turnstile "I am human" check. It adds a hidden `cf-turnstile-response` field to the
// form it sits in; the server action passes that to Supabase, which verifies it.
// Renders nothing until NEXT_PUBLIC_TURNSTILE_SITE_KEY is set.

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string
  reset: (id: string) => void
  remove: (id: string) => void
}
declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

let loading: Promise<TurnstileApi> | null = null
function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = SCRIPT_SRC
    s.async = true
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile failed to load')))
    s.onerror = () => {
      loading = null
      reject(new Error('Turnstile failed to load'))
    }
    document.head.appendChild(s)
  })
  return loading
}

/** `resetKey`: pass the form's result state; a new value gets a fresh token (each is single-use). */
export function Turnstile({ resetKey }: { resetKey?: unknown }) {
  const el = useRef<HTMLDivElement>(null)
  const widget = useRef<string | null>(null)

  useEffect(() => {
    if (!SITE_KEY) return
    let cancelled = false
    loadTurnstile()
      .then((t) => {
        if (cancelled || !el.current) return
        widget.current = t.render(el.current, { sitekey: SITE_KEY, theme: 'light', size: 'flexible' })
      })
      .catch((e) => console.error(e))
    return () => {
      cancelled = true
      if (widget.current) window.turnstile?.remove(widget.current)
      widget.current = null
    }
  }, [])

  useEffect(() => {
    if (resetKey !== undefined && widget.current) window.turnstile?.reset(widget.current)
  }, [resetKey])

  if (!SITE_KEY) return null
  return <div ref={el} className="min-h-[65px]" />
}
