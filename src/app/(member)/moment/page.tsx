import type { Metadata } from 'next'
import { requireMember } from '@/lib/auth'
import { todayISO } from '@/lib/dates'
import { BackHeader, ErrorNote } from '../parts'
import { MomentForm } from './moment-form'

export const metadata: Metadata = { title: 'Share a life moment' }

export default async function Moment({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireMember()
  return (
    <div className="px-5 pt-8">
      <BackHeader title="Share a life moment" sub="Good news or hard news, your church family wants to walk with you." />
      <ErrorNote searchParams={searchParams} messages={{ missing: 'Pick what happened and the date.' }} />
      <MomentForm today={todayISO()} />
    </div>
  )
}
