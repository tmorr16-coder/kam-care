import { MemberTabs } from '@/components/member-tabs'

// Member portal: phone-first, single column.
export default function MemberLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh max-w-md pb-24">
      {children}
      <MemberTabs />
    </div>
  )
}
