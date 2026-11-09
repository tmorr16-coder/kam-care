'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'
import { buttonClass, inputClass } from '@/components/ui'

type Enroll = { factorId: string; qr: string; secret: string }

export function MfaClient() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [factorId, setFactorId] = useState<string | null>(null)
  const [enroll, setEnroll] = useState<Enroll | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    ;(async () => {
      const { data, error } = await supabase.auth.mfa.listFactors()
      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }
      const verified = data.totp.find((f) => f.status === 'verified')
      if (verified) {
        setFactorId(verified.id)
      } else {
        // Clear half-finished enrollments, then start a fresh one.
        for (const f of data.all.filter((f) => f.factor_type === 'totp' && f.status !== 'verified')) {
          await supabase.auth.mfa.unenroll({ factorId: f.id })
        }
        const res = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `KAM Care ${new Date().toISOString().slice(0, 16)}` })
        if (res.error) setError(res.error.message)
        else setEnroll({ factorId: res.data.id, qr: res.data.totp.qr_code, secret: res.data.totp.secret })
      }
      setLoading(false)
    })()
  }, [])

  async function verify(e: React.FormEvent) {
    e.preventDefault()
    const id = enroll?.factorId ?? factorId
    if (!id) return
    setBusy(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: id, code: code.trim() })
    if (error) {
      setError(error.message === 'Invalid TOTP code entered' ? 'That code didn’t work. Try the newest one in your app.' : error.message)
      setBusy(false)
      return
    }
    router.replace('/')
    router.refresh()
  }

  if (loading) return <p className="text-ink-muted">Getting things ready…</p>

  return (
    <form onSubmit={verify} className="space-y-5">
      {enroll ? (
        <div className="space-y-3">
          <p className="text-ink">
            Scan this code with an authenticator app (Microsoft Authenticator, Google Authenticator, 1Password or similar), then enter the 6-digit code it shows.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={enroll.qr} alt="QR code for your authenticator app" width={180} height={180} className="rounded-lg border border-line bg-white p-2" />
          <p className="text-sm text-ink-muted">
            Can&apos;t scan? Enter this key: <code className="rounded bg-canvas px-1.5 py-0.5 font-mono text-ink break-all">{enroll.secret}</code>
          </p>
        </div>
      ) : (
        <p className="text-ink">Enter the 6-digit code from your authenticator app.</p>
      )}
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="123456"
        aria-label="6-digit code"
        className={inputClass + ' max-w-48 text-center font-mono text-xl tracking-[0.4em]'}
        autoFocus
      />
      {error && <p className="text-sm text-urgent" role="alert">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <button disabled={busy || code.length !== 6} className={buttonClass('primary', 'md')}>{busy ? 'Checking…' : 'Verify'}</button>
      </div>
    </form>
  )
}
