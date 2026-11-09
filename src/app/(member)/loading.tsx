export default function Loading() {
  return (
    <div className="animate-pulse space-y-4 p-5" aria-busy="true" aria-label="Loading">
      <div className="h-12 w-60 rounded bg-line" />
      <div className="h-72 rounded-3xl bg-navy-900/80" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 rounded-2xl bg-white" />)}
      </div>
    </div>
  )
}
