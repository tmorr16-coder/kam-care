'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'
import { Suspense } from 'react'

const TABS = [
  { href: '/home', label: 'Home' },
  { href: '/requests', label: 'My requests' },
  { href: '/give', label: 'Give' },
  { href: '/privacy', label: 'Privacy' },
]

export function MemberTabs() {
  return (
    <Suspense fallback={<Tabs path="" />}>
      <TabsWithPath />
    </Suspense>
  )
}

function TabsWithPath() {
  return <Tabs path={usePathname()} />
}

function Tabs({ path }: { path: string }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-white pb-[env(safe-area-inset-bottom)]" aria-label="Main">
      <div className="mx-auto grid max-w-md grid-cols-4">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={clsx('py-4 text-center text-[15px]', path.startsWith(t.href) ? 'font-semibold text-navy-800' : 'text-ink-muted')}
            aria-current={path.startsWith(t.href) ? 'page' : undefined}
          >
            {t.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
