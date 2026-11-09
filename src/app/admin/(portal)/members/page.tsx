import Link from 'next/link'
import type { Metadata } from 'next'
import { requireStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { fmtShort } from '@/lib/dates'
import { Card, Empty, PageTitle, Pill, SensitivePill, UrgencyPill, buttonClass, cx, inputClass } from '@/components/ui'
import type { Urgency } from '@/lib/types'

export const metadata: Metadata = { title: 'Members' }

const PAGE_SIZE = 50

export default async function MembersPage({ searchParams }: { searchParams: Promise<{ q?: string; campus?: string; page?: string }> }) {
  await requireStaff()
  const sp = await searchParams
  const q = (sp.q ?? '').trim()
  const campus = sp.campus || ''
  const page = Math.max(1, Number(sp.page) || 1)
  const sb = await createClient()

  let query = sb
    .from('people')
    .select('id, display_name, email, phone, campus:campuses(name), member_since, is_guest, care:person_care!person_care_person_id_fkey(care_score, last_touch_at, last_touch_summary)', { count: 'exact' })
    .eq('archived', false)
    .order('last_name')
    .order('first_name')
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
  if (campus) query = query.eq('campus_id', campus)
  if (q) {
    const safe = q.replace(/[%,()]/g, ' ')
    query = query.or(`first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,email.ilike.%${safe}%,phone.ilike.%${safe.replace(/\D/g, '') || safe}%`)
  }

  const [{ data: people, count }, { data: campuses }] = await Promise.all([query, sb.from('campuses').select('id, name').order('sort')])
  const ids = (people ?? []).map((p) => p.id)
  const { data: cases } = ids.length
    ? await sb.from('care_cases').select('person_id, urgency, sensitive').eq('status', 'open').in('person_id', ids)
    : { data: [] as { person_id: string; urgency: Urgency; sensitive: boolean }[] }
  const openCase = new Map<string, { urgency: Urgency; sensitive: boolean }>()
  const rank = { urgent: 3, high: 2, normal: 1 }
  for (const c of cases ?? []) {
    const prev = openCase.get(c.person_id)
    if (!prev || rank[c.urgency] > rank[prev.urgency]) openCase.set(c.person_id, { urgency: c.urgency, sensitive: c.sensitive || !!prev?.sensitive })
  }

  const total = count ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const link = (p: number) => `/admin/members?${new URLSearchParams({ ...(q ? { q } : {}), ...(campus ? { campus } : {}), page: String(p) })}`

  return (
    <div className="mx-auto max-w-[1180px]">
      <PageTitle title="Members" subtitle={`${total.toLocaleString()} people from OneChurch`} />
      <form className="mb-4 flex flex-wrap gap-3" method="get">
        <input name="q" defaultValue={q} placeholder="Search by name, email or phone" className={cx(inputClass, 'max-w-sm')} aria-label="Search members" />
        <select name="campus" defaultValue={campus} className={cx(inputClass, 'w-auto')} aria-label="Campus">
          <option value="">All campuses</option>
          {(campuses ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button className={buttonClass('primary')}>Search</button>
      </form>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-canvas text-left text-[11px] tracking-wide text-ink-muted uppercase">
            <tr>
              <th className="px-5 py-2.5 font-semibold">Member</th>
              <th className="px-3 py-2.5 font-semibold">Campus</th>
              <th className="px-3 py-2.5 font-semibold">Care score</th>
              <th className="px-3 py-2.5 font-semibold">Last touch</th>
              <th className="px-3 py-2.5 pr-5 font-semibold">Care need</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {(people ?? []).map((p) => {
              const care = (Array.isArray(p.care) ? p.care[0] : p.care) as { care_score: number | null; last_touch_at: string | null; last_touch_summary: string | null } | null
              const c = openCase.get(p.id)
              return (
                <tr key={p.id}>
                  <td className="px-5 py-3">
                    <Link href={`/admin/members/${p.id}`} className="font-semibold hover:underline">{p.display_name}</Link>
                    <span className="block text-xs text-ink-muted">{p.email ?? p.phone ?? 'No contact on file'}</span>
                  </td>
                  <td className="px-3 py-3">
                    {(p.campus as { name: string } | null)?.name ?? '—'}
                    {p.is_guest && <Pill className="ml-2">Guest</Pill>}
                  </td>
                  <td className={cx('px-3 py-3 font-semibold', care?.care_score !== null && care?.care_score !== undefined && care.care_score < 50 && 'text-urgent')}>
                    {care?.care_score ?? '—'}
                  </td>
                  <td className="px-3 py-3 text-ink-muted">
                    {care?.last_touch_at ? (
                      <>
                        {fmtShort(care.last_touch_at)}
                        <span className="block max-w-[16rem] truncate text-xs">{care.last_touch_summary}</span>
                      </>
                    ) : 'Never'}
                  </td>
                  <td className="px-3 py-3 pr-5">
                    {c ? (
                      <span className="flex gap-1"><UrgencyPill urgency={c.urgency} />{c.sensitive && <SensitivePill />}</span>
                    ) : <span className="text-ink-muted">—</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!people?.length && <Empty>No members match that search.</Empty>}
      </Card>

      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pages">
          <span className="text-ink-muted">Page {page} of {pages}</span>
          <span className="flex gap-2">
            {page > 1 && <Link className={buttonClass('secondary', 'sm')} href={link(page - 1)}>Previous</Link>}
            {page < pages && <Link className={buttonClass('secondary', 'sm')} href={link(page + 1)}>Next</Link>}
          </span>
        </nav>
      )}
    </div>
  )
}
