export default function Loading() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-9 w-72 rounded bg-line" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-24 rounded-xl bg-white" />)}
      </div>
      <div className="h-96 rounded-xl bg-white" />
    </div>
  )
}
