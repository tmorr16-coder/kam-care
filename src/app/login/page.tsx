import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Logo } from '@/components/ui'
import { enabledProviders } from '@/lib/auth-providers'
import { OAuthButton } from './oauth-button'
import { MemberEmailForms } from './email-forms'

export const metadata: Metadata = { title: 'Sign in' }

async function ErrorNote({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  if (!error) return null
  return <p className="mb-4 rounded-lg bg-urgent-bg px-3 py-2 text-sm text-urgent" role="alert">{error}</p>
}

export default async function MemberLogin({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const providers = await enabledProviders()
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <header className="gold-rule bg-navy-900 px-6 pt-14 pb-10 text-white">
        <Logo size={88} />
        <h1 className="mt-6 font-serif text-4xl font-semibold">Welcome to KAM Care</h1>
        <p className="mt-3 text-lg text-white/80">Prayer, help and your care team, all in one place.</p>
      </header>
      <main className="flex-1 px-6 pt-6">
        <Suspense fallback={null}>
          <ErrorNote searchParams={searchParams} />
        </Suspense>
        {providers.length > 0 && (
          <>
            <div className="space-y-3">
              {providers.map((p) => (
                <OAuthButton key={p} provider={p} size="lg" />
              ))}
            </div>
            <div className="my-6 flex items-center gap-4 text-ink-muted">
              <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
            </div>
          </>
        )}
        <MemberEmailForms />
      </main>
      <footer className="px-6 py-8 text-[15px] text-ink-muted">
        Every account is matched to your church record in OneChurch before you can use KAM Care.
        <a href="/admin/login" className="mt-4 block font-semibold text-navy-800 underline-offset-2 hover:underline">
          Pastors, staff and care leaders: sign in to the admin portal →
        </a>
      </footer>
    </div>
  )
}
