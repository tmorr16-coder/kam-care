import type { Metadata } from 'next'
import { requireStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { CHANNEL_LABELS, type Channel, type MomentType } from '@/lib/types'
import { buttonClass, Card, CardHeader, Empty, Field, inputClass, PageTitle, Pill } from '@/components/ui'
import { deleteTemplate, saveTemplate } from './actions'

export const metadata: Metadata = { title: 'Message templates' }

const MOMENT_LABELS: Record<MomentType, string> = {
  birth: 'New baby', wedding: 'Wedding', promotion: 'Promotion or new job', award: 'Award or graduation',
  anniversary: 'Wedding anniversary', work_anniversary: 'Work anniversary', moved: 'Moved', sickness: 'Sickness & hospital',
  bereavement: 'Bereavement', job_loss: 'Job loss', shut_in: 'Shut-in', birthday: 'Birthday', other: 'Other',
}
const CHANNELS: Channel[] = ['text', 'email', 'app', 'card']

const VARIABLES = [
  { v: '{first_name}', d: "Member's first name" },
  { v: '{sender}', d: 'The leader sending it, e.g. Deacon Hayes' },
  { v: '{years}', d: 'Years, for anniversaries and milestones' },
]

function TemplateForm({ t }: { t?: { id: string; name: string; channel: Channel; moment_type: MomentType | null; body: string } }) {
  return (
    <form action={saveTemplate} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="id" value={t?.id ?? ''} />
      <Field label="Name"><input name="name" required defaultValue={t?.name} className={inputClass} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Channel">
          <select name="channel" defaultValue={t?.channel ?? 'text'} className={inputClass}>
            {CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>)}
          </select>
        </Field>
        <Field label="Life moment">
          <select name="momentType" defaultValue={t?.moment_type ?? ''} className={inputClass}>
            <option value="">Any</option>
            {Object.entries(MOMENT_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Message" className="sm:col-span-2">
        <textarea name="body" required rows={3} defaultValue={t?.body} className={inputClass} />
      </Field>
      <div className="flex gap-2 sm:col-span-2">
        <button className={buttonClass('primary', 'sm')}>{t ? 'Save changes' : 'Add template'}</button>
      </div>
    </form>
  )
}

export default async function TemplatesPage() {
  await requireStaff()
  const supabase = await createClient()
  const { data: templates } = await supabase.from('message_templates').select('id, name, channel, moment_type, body, updated_at').order('name')

  return (
    <div className="mx-auto max-w-5xl">
      <PageTitle title="Message templates" subtitle="Starting points for texts and notes. Leaders always edit before sending." />

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          {!templates?.length && <Card><Empty>No templates yet.</Empty></Card>}
          {(templates ?? []).map((t) => (
            <Card key={t.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold">{t.name}</h2>
                  <div className="mt-1 flex gap-2">
                    <Pill tone="navy">{CHANNEL_LABELS[t.channel]}</Pill>
                    {t.moment_type && <Pill>{MOMENT_LABELS[t.moment_type]}</Pill>}
                  </div>
                </div>
                <form action={deleteTemplate}>
                  <input type="hidden" name="id" value={t.id} />
                  <button className="text-sm text-urgent hover:underline">Delete</button>
                </form>
              </div>
              <p className="mt-3 rounded-lg bg-canvas p-3 text-sm whitespace-pre-wrap">{t.body}</p>
              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-navy-800">Edit</summary>
                <div className="mt-3"><TemplateForm t={t} /></div>
              </details>
            </Card>
          ))}
          <Card className="pb-5">
            <CardHeader title="New template" />
            <div className="px-5"><TemplateForm /></div>
          </Card>
        </div>

        <Card className="h-fit p-5">
          <h2 className="font-serif text-lg font-semibold">Variables</h2>
          <p className="mt-1 text-sm text-ink-muted">Filled in automatically when a leader opens the message.</p>
          <dl className="mt-3 space-y-3 text-sm">
            {VARIABLES.map((x) => (
              <div key={x.v}>
                <dt className="font-mono text-navy-800">{x.v}</dt>
                <dd className="text-ink-muted">{x.d}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 rounded-lg bg-gold-100 p-3 text-xs text-high">Keep care messages free of any ask. Never mention giving.</p>
        </Card>
      </div>
    </div>
  )
}
