import Link from 'next/link'
import type { ReactNode } from 'react'

export function BackHeader({ title, sub }: { title: string; sub?: ReactNode }) {
  return (
    <header className="mb-6">
      <Link href="/home" className="text-[17px] font-medium text-navy-800">← Home</Link>
      <h1 className="mt-6 font-serif text-[2rem] leading-tight font-semibold">{title}</h1>
      {sub && <p className="mt-2 text-[17px] text-ink-muted">{sub}</p>}
    </header>
  )
}

export function StickySubmit({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] -mx-5 mt-8 border-t border-line bg-canvas px-5 py-4">
      {children}
    </div>
  )
}

export const submitClass = 'w-full rounded-xl bg-navy-800 py-4 text-lg font-semibold text-white hover:bg-navy-700 disabled:opacity-60'
export const textareaClass = 'w-full rounded-xl border border-[#d9d6cf] bg-white p-4 text-[17px] text-ink focus:border-navy-700 focus:outline-none'
export const chipClass =
  'cursor-pointer rounded-full border-2 border-[#e5e2dc] bg-white px-5 py-2.5 text-[17px] font-semibold has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-white has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-navy-700'
export const optionCardClass =
  'block cursor-pointer rounded-xl border-2 border-[#e5e2dc] bg-white p-4 has-[:checked]:border-navy-800 has-[:checked]:bg-navy-100 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-navy-700'

export async function ErrorNote({ searchParams, messages }: { searchParams: Promise<{ error?: string }>; messages: Record<string, string> }) {
  const { error } = await searchParams
  if (!error) return null
  return <p className="mb-4 rounded-lg bg-urgent-bg px-3 py-2 text-[15px] text-urgent" role="alert">{messages[error] ?? 'Something went wrong. Please try again.'}</p>
}
