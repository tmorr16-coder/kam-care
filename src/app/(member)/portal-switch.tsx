import Link from 'next/link'
import { getViewer } from '@/lib/auth'

/** For pastors, staff and leaders using the member view: a way back to their own portal. */
export async function PortalSwitch() {
  const v = await getViewer()
  if (!v || v.role === 'member') return null
  const [href, label] = v.role === 'care_leader' ? ['/leader', 'My tasks'] : ['/admin', 'Admin portal']
  return (
    <div className="flex items-center justify-between bg-navy-900 px-5 py-2 text-sm text-white/85">
      <span>Member view</span>
      <Link href={href} className="font-semibold text-white hover:underline">
        Back to {label} →
      </Link>
    </div>
  )
}
