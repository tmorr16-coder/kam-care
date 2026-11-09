'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { Suspense, useState } from 'react'
import clsx from 'clsx'

const NAV = [
  { href: '/admin', label: 'Care queue' },
  { href: '/admin/members', label: 'Members' },
  { href: '/admin/insights', label: 'Insights' },
  { href: '/admin/signals', label: 'Signals & consent' },
  { href: '/admin/teams', label: 'Care teams' },
  { href: '/admin/templates', label: 'Message templates' },
  { href: '/admin/onechurch', label: 'OneChurch connection' },
]

export function AdminNav() {
  return (
    <Suspense fallback={<NavInner path="" />}>
      <NavWithPath />
    </Suspense>
  )
}

function NavWithPath() {
  return <NavInner path={usePathname()} />
}

function NavInner({ path }: { path: string }) {
  const [open, setOpen] = useState(false)
  const isActive = (href: string) => (href === '/admin' ? path === '/admin' : path.startsWith(href))
  return (
    <>
      <button
        className="rounded-md p-2 text-white lg:hidden"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>
      <nav className={clsx('flex-col gap-1 px-3 lg:mt-6 lg:flex', open ? 'absolute inset-x-0 top-full z-20 flex bg-navy-900 pb-4' : 'hidden')}>
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            onClick={() => setOpen(false)}
            className={clsx(
              'rounded-lg px-3 py-2 text-[15px] transition-colors',
              isActive(n.href) ? 'bg-navy-800 font-semibold text-white' : 'text-white/85 hover:bg-white/5 hover:text-white',
            )}
            aria-current={isActive(n.href) ? 'page' : undefined}
          >
            {n.label}
          </Link>
        ))}
        {/* Pastors and staff are members too: their own check-in, prayer and requests. */}
        <Link
          href="/home"
          onClick={() => setOpen(false)}
          className="mt-3 rounded-lg border-t border-white/10 px-3 pt-3 pb-2 text-[15px] text-white/85 hover:bg-white/5 hover:text-white"
        >
          My care (member view)
        </Link>
      </nav>
    </>
  )
}
