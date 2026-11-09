// Brand marks for sign-in buttons (simple single-color versions).
export function MicrosoftMark() {
  return (
    <svg viewBox="0 0 20 20" className="size-5" aria-hidden>
      <rect x="1" y="1" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <rect x="11" y="1" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <rect x="1" y="11" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <rect x="11" y="11" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}
export function GoogleMark() {
  return (
    <svg viewBox="0 0 20 20" className="size-5" aria-hidden>
      <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10 10h6" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}
export function FacebookMark() {
  return (
    <svg viewBox="0 0 20 20" className="size-5" aria-hidden>
      <rect x="2" y="2" width="16" height="16" rx="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M11.5 18v-6h2l.3-2.3h-2.3V8.4c0-.7.2-1.1 1.1-1.1h1.3V5.2c-.2 0-1-.1-1.8-.1-1.8 0-3 1.1-3 3.1v1.6H7v2.3h2.1v6" fill="currentColor" />
    </svg>
  )
}
