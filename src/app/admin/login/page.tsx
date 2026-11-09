import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Logo } from '@/components/ui'
import { OAuthButton } from '@/app/login/oauth-button'
import { AdminPasswordForm } from '@/app/login/email-forms'
import { enabledProviders } from '@/lib/auth-providers'

export const metadata: Metadata = { title: 'Admin sign in' }

async function ErrorNote({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  if (!error) return null
  return <p className="mb-4 rounded-lg bg-urgent-bg px-3 py-2 text-sm text-urgent" role="alert">{error}</p>
}

export default async function AdminLogin({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  // Facebook and Apple are for members.
  const providers = (await enabledProviders()).filter((p) => p === 'google')
  return (
    <div className="grid min-h-dvh lg:grid-cols-[48%_1fr]">
      <section className="gold-rule flex flex-col bg-navy-900 px-8 pt-12 pb-8 text-white sm:px-14">
        <div className="flex items-center gap-4">
          <Logo size={88} />
          <span className="font-serif text-xl font-semibold">KAM Care</span>
        </div>
        <div className="my-12 lg:my-auto">
          <h1 className="font-serif text-4xl leading-tight font-semibold sm:text-5xl">No one in the KAM family goes unseen.</h1>
          <p className="mt-5 max-w-lg text-lg text-white/80">
            The care platform for pastors, deacons and care leaders across Indianapolis, Detroit, Atlanta and the Global Campus.
          </p>
        </div>
        <p className="text-sm text-white/70">Works with kam.onechurchsoftware.com</p>
      </section>

      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <h2 className="font-serif text-3xl font-semibold">Sign in to the admin portal</h2>
          <p className="mt-2 text-ink-muted">Use your KAM Care email and password.</p>

          <div className="mt-7 space-y-3">
            <Suspense fallback={null}>
              <ErrorNote searchParams={searchParams} />
            </Suspense>
            {providers.map((p) => (
              <OAuthButton key={p} provider={p} next="/admin" />
            ))}
          </div>
          {providers.length > 0 && (
            <div className="my-5 flex items-center gap-3 text-sm text-ink-muted">
              <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
            </div>
          )}
          <AdminPasswordForm />

          <div className="mt-6 rounded-xl border border-line bg-white p-5">
            <h3 className="font-semibold">Who can sign in</h3>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-ink">
              <li>You must be a named person in OneChurch, matched by email</li>
              <li>Your OneChurch role sets your access: Pastor, Care Leader or Staff</li>
              <li>Access ends automatically when the role is removed in OneChurch</li>
            </ul>
          </div>
          <p className="mt-6 text-sm text-ink-muted">
            Can&apos;t sign in? Contact <span className="font-medium text-navy-800 underline">Member Services</span> to update your OneChurch record.
          </p>
        </div>
      </section>
    </div>
  )
}
