import Link from 'next/link'
import clsx from 'clsx'
import { getViewer, type Viewer } from '@/lib/auth'

type View = 'member' | 'leader' | 'admin'

const VIEWS: { id: View; label: string; href: string; allowed: (v: Viewer) => boolean }[] = [
  { id: 'member', label: 'Member', href: '/home', allowed: (v) => !!v.personId },
  { id: 'leader', label: 'Leader', href: '/leader', allowed: (v) => v.role !== 'member' },
  { id: 'admin', label: 'Admin', href: '/admin', allowed: (v) => v.role === 'staff' || v.role === 'pastor' },
]

/**
 * Switch between the member, leader and admin views. Only shows the views this person can
 * open, and hides itself for people who only have one (most members).
 */
export async function ViewSwitcher({ current, className }: { current: View; className?: string }) {
  const v = await getViewer()
  if (!v) return null
  const views = VIEWS.filter((x) => x.allowed(v))
  if (views.length < 2) return null
  return (
    <nav aria-label="Switch view" className={clsx('flex items-center gap-1 text-sm', className)}>
      <span className="mr-1 opacity-70">View</span>
      {views.map((x) => (
        <Link
          key={x.id}
          href={x.href}
          aria-current={x.id === current ? 'page' : undefined}
          className={clsx(
            'rounded-full px-3 py-1',
            x.id === current ? 'bg-white font-semibold text-navy-900' : 'text-white/85 hover:bg-white/10 hover:text-white',
          )}
        >
          {x.label}
        </Link>
      ))}
    </nav>
  )
}
