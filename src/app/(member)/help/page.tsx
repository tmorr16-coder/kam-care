import type { Metadata } from 'next'
import { requireMember } from '@/lib/auth'
import { BackHeader, ErrorNote } from '../parts'
import { HelpForm } from './help-form'

export const metadata: Metadata = { title: 'Practical help' }

export default async function Help({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireMember()
  return (
    <div className="px-5 pt-8">
      <BackHeader title="What would help right now?" sub="Pick all that apply. Only our benevolence team sees this, and there's no judgment here." />
      <ErrorNote searchParams={searchParams} messages={{ empty: 'Pick at least one kind of help.' }} />
      <HelpForm />
    </div>
  )
}
