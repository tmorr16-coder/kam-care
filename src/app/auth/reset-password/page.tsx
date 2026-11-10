import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Logo } from '@/components/ui'
import { createClient } from '@/lib/supabase/server'
import { NewPasswordForm } from '@/app/login/email-forms'

export const metadata: Metadata = { title: 'Choose a new password' }

async function ResetBody() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) {
    return (
      <p className="text-[15px] text-ink">
        This reset link has expired or was already used.{' '}
        <a href="/login" className="font-semibold text-navy-800 underline">Go to sign in</a> and choose &ldquo;Forgot password?&rdquo; to get a new one.
      </p>
    )
  }
  return (
    <>
      <p className="mb-4 text-[15px] text-ink-muted">For {data.user.email}</p>
      <NewPasswordForm />
    </>
  )
}

export default function ResetPassword() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <Logo size={72} />
      <h1 className="mt-6 mb-2 font-serif text-3xl font-semibold">Choose a new password</h1>
      <Suspense fallback={null}>
        <ResetBody />
      </Suspense>
    </div>
  )
}
