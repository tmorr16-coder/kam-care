import { Suspense } from 'react'
import { MemberTabs } from '@/components/member-tabs'
import { ViewSwitcher } from '@/components/view-switcher'

// Member portal: phone-first, single column.
export default function MemberLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh max-w-md pb-24">
      <Suspense fallback={null}>
        <ViewSwitcher current="member" className="bg-navy-900 px-5 py-2 text-white" />
      </Suspense>
      {children}
      <MemberTabs />
    </div>
  )
}
