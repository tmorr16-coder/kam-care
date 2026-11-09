// "Keep me signed in". Supabase's sign-in cookies normally last 400 days. When someone unticks
// the box, we set this marker (itself a browser-session cookie) and every place that writes the
// sign-in cookies drops their expiry, so closing the browser signs them out.

export const SESSION_ONLY_COOKIE = 'kc-session-only'

type Expiring = { maxAge?: number; expires?: Date }

export function withRemember<T extends Expiring>(options: T, sessionOnly: boolean): T {
  // maxAge 0 means "delete this cookie"; keep that as is.
  if (!sessionOnly || !options || options.maxAge === 0) return options
  const rest = { ...options }
  delete rest.maxAge
  delete rest.expires
  return rest
}
