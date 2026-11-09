import { Suspense } from 'react'
import { ViewSwitcher } from '@/components/view-switcher'

// Leader view: phone-first task list.
export default function LeaderLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh max-w-md pb-10">
      <Suspense fallback={null}>
        <ViewSwitcher current="leader" className="bg-navy-900 px-5 pt-3 text-white" />
      </Suspense>
      {children}
    </div>
  )
}
