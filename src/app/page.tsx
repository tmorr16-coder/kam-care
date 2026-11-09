import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getViewer, homeFor } from '@/lib/auth'

async function RouteByRole() {
  const v = await getViewer()
  redirect(v ? homeFor(v) : '/login')
  return null
}

export default function Root() {
  return (
    <Suspense fallback={null}>
      <RouteByRole />
    </Suspense>
  )
}
