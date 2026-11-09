'use client'
import { useState } from 'react'
import clsx from 'clsx'
import { createClient } from '@/lib/supabase/browser'
import { AppleMark, FacebookMark, GoogleMark, MicrosoftMark } from '@/components/icons'
import type { OAuthProvider as Provider } from '@/lib/auth-providers'

const LABELS: Record<Provider, { label: string; Icon: () => React.ReactElement }> = {
  azure: { label: 'Continue with Microsoft', Icon: MicrosoftMark },
  google: { label: 'Continue with Google', Icon: GoogleMark },
  facebook: { label: 'Continue with Facebook', Icon: FacebookMark },
  apple: { label: 'Continue with Apple', Icon: AppleMark },
}

export function OAuthButton({ provider, next = '/', size = 'md' }: { provider: Provider; next?: string; size?: 'md' | 'lg' }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { label, Icon } = LABELS[provider]

  async function go() {
    setBusy(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        scopes: provider === 'azure' ? 'email openid profile' : undefined,
      },
    })
    if (error) {
      setError(error.message)
      setBusy(false)
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={go}
        disabled={busy}
        className={clsx(
          'flex w-full items-center justify-center gap-3 rounded-xl border border-[#cfd3da] bg-white font-semibold text-ink transition-colors hover:bg-canvas disabled:opacity-60',
          size === 'lg' ? 'py-4 text-lg' : 'py-3 text-[15px]',
        )}
      >
        <Icon /> {busy ? 'Opening…' : label}
      </button>
      {error && <p className="mt-1 text-sm text-urgent">{error}</p>}
    </div>
  )
}
