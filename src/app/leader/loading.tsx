export default function Loading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="h-56 bg-navy-900/80" />
      <div className="space-y-4 p-5">
        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-64 rounded-2xl bg-white" />)}
      </div>
    </div>
  )
}
