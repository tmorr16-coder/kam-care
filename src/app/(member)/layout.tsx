import { Suspense } from 'react'
import { MemberTabs } from '@/components/member-tabs'
import { PortalSwitch } from './portal-switch'

// Member portal: phone-first, single column.
export default function MemberLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh max-w-md pb-24">
      <Suspense fallback={null}>
        <PortalSwitch />
      </Suspense>
      {children}
      <MemberTabs />
    </div>
  )
}
