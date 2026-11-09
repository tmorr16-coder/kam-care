'use client'
import { useState } from 'react'

type Month = { key: string; label: string; flagged: number; met: number }

const FLAGGED = '#7ea7d1'
const MET = '#0b4373'

/** Care needs flagged vs. closed within 72h, by month. Values are labeled; a table view is included. */
export function NeedsChart({ months }: { months: Month[] }) {
  const [hover, setHover] = useState<string | null>(null)
  const max = Math.max(1, ...months.map((m) => m.flagged))
  const h = 200

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 pb-3">
        <h2 className="font-serif text-xl font-semibold">Care needs vs. needs met</h2>
        <ul className="flex gap-4 text-xs text-ink-muted" aria-label="Legend">
          <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: FLAGGED }} /> Needs flagged</li>
          <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: MET }} /> Closed within 72h</li>
        </ul>
      </div>

      <div className="px-5" role="img" aria-label={`Bar chart. ${months.map((m) => `${m.label}: ${m.flagged} flagged, ${m.met} closed within 72 hours`).join('. ')}`}>
        <div className="flex items-end gap-3 border-b border-line sm:gap-6" style={{ height: h + 24 }}>
          {months.map((m) => {
            const active = hover === m.key
            return (
              <div
                key={m.key}
                className="relative flex flex-1 flex-col items-center justify-end"
                style={{ height: h + 24 }}
                onMouseEnter={() => setHover(m.key)}
                onMouseLeave={() => setHover(null)}
              >
                {active && (
                  <div className="pointer-events-none absolute -top-2 z-10 -translate-y-full rounded-lg border border-line bg-white px-3 py-2 text-xs whitespace-nowrap shadow-md">
                    <p className="font-semibold text-ink">{m.label}</p>
                    <p className="text-ink-muted">{m.flagged} flagged · {m.met} closed in 72h</p>
                    <p className="text-ink-muted">{m.flagged ? Math.round((m.met / m.flagged) * 100) : 0}% met</p>
                  </div>
                )}
                <span className="mb-1 text-xs font-semibold text-ink tabular-nums">{m.flagged}</span>
                <div className="flex w-full items-end justify-center gap-0.5" style={{ height: h }}>
                  <div className="w-1/2 max-w-11 rounded-t" style={{ height: (m.flagged / max) * h, background: FLAGGED, opacity: hover && !active ? 0.5 : 1 }} />
                  <div className="w-1/2 max-w-11 rounded-t" style={{ height: (m.met / max) * h, background: MET, opacity: hover && !active ? 0.5 : 1 }} />
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex gap-3 pt-2 sm:gap-6">
          {months.map((m) => <span key={m.key} className="flex-1 text-center text-xs text-ink-muted">{m.label}</span>)}
        </div>
      </div>

      <details className="mt-3 px-5 text-sm">
        <summary className="cursor-pointer text-navy-800">Show as table</summary>
        <table className="mt-2 w-full text-left">
          <thead className="text-xs text-ink-muted"><tr><th className="py-1">Month</th><th>Flagged</th><th>Closed within 72h</th></tr></thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.key} className="border-t border-line"><td className="py-1">{m.label}</td><td className="tabular-nums">{m.flagged}</td><td className="tabular-nums">{m.met}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}
