import { Suspense } from 'react'
import Link from 'next/link'
import { AdminNav } from '@/components/admin-nav'
import { Logo } from '@/components/ui'
import { ConnectionBadge, ViewerBadge } from './shell-status'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="lg:flex lg:min-h-dvh">
      <aside className="gold-rule relative bg-navy-900 text-white lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-[220px] lg:shrink-0 lg:flex-col">
        <div className="flex items-center justify-between px-4 pt-5 pb-3 lg:block">
          <Link href="/admin" className="flex items-center gap-3">
            <Logo size={40} />
            <span>
              <span className="block font-serif text-lg leading-tight font-semibold">KAM Care</span>
              <span className="block text-xs text-white/70">Admin portal</span>
            </span>
          </Link>
          <AdminNav />
        </div>
        <div className="mt-auto hidden space-y-3 p-3 lg:block">
          <Suspense fallback={null}>
            <ViewerBadge />
          </Suspense>
          <Suspense fallback={<div className="h-14 rounded-lg bg-white/5" />}>
            <ConnectionBadge />
          </Suspense>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
    </div>
  )
}
