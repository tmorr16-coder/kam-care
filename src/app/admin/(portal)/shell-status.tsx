import { createClient } from '@/lib/supabase/server'
import { getViewer } from '@/lib/auth'
import { isOneChurchConfigured } from '@/lib/onechurch/client'

function ago(ts: string) {
  const mins = Math.round((Date.now() - Date.parse(ts)) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const h = Math.round(mins / 60)
  return h < 48 ? `${h}h ago` : `${Math.round(h / 24)}d ago`
}

export async function ConnectionBadge() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('oc_webhook_events')
    .select('received_at')
    .neq('event', 'reconcile')
    .order('received_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (
    <div className="rounded-lg bg-navy-800/70 px-3 py-2.5 text-xs leading-relaxed text-white/85">
      <p>{isOneChurchConfigured() ? 'Connected to OneChurch' : 'OneChurch not connected yet'}</p>
      <p className="text-white/65">{data ? `Last webhook ${ago(data.received_at)}` : 'Set it up under OneChurch connection'}</p>
    </div>
  )
}

export async function ViewerBadge() {
  const v = await getViewer()
  if (!v) return null
  return (
    <div className="flex items-center justify-between px-1 text-xs text-white/75">
      <span className="truncate">
        {v.displayName ?? v.email}
        <span className="block text-white/50 capitalize">{v.role.replace('_', ' ')}{v.isAdmin ? ' · admin' : ''}</span>
      </span>
      <form action="/auth/signout" method="post">
        <button className="rounded px-2 py-1 text-white/70 hover:bg-white/10 hover:text-white">Sign out</button>
      </form>
    </div>
  )
}
