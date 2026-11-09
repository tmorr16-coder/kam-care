import 'server-only'

function required(name: string, ...fallbacks: string[]): string {
  for (const key of [name, ...fallbacks]) {
    const v = process.env[key]
    if (v) return v
  }
  throw new Error(`Missing environment variable ${name}`)
}

function optional(name: string): string | undefined {
  return process.env[name] || undefined
}

export const env = {
  get supabaseUrl() {
    return required('NEXT_PUBLIC_SUPABASE_URL')
  },
  get supabasePublishableKey() {
    return required('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY')
  },
  get supabaseSecretKey() {
    return required('SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY')
  },
  /** e.g. "kam" for kam.onechurchsoftware.com */
  get onechurchTenant() {
    return optional('ONECHURCH_TENANT') ?? 'kam'
  },
  get onechurchApiKey() {
    return optional('ONECHURCH_API_KEY')
  },
  /** Random secret in the webhook URL path. OneChurch deliveries are not signed. */
  get onechurchWebhookToken() {
    return optional('ONECHURCH_WEBHOOK_TOKEN')
  },
  get cronSecret() {
    return optional('CRON_SECRET')
  },
  get siteUrl() {
    return optional('NEXT_PUBLIC_SITE_URL') ?? 'http://localhost:3000'
  },
  twilio: {
    get accountSid() { return optional('TWILIO_ACCOUNT_SID') },
    get authToken() { return optional('TWILIO_AUTH_TOKEN') },
    get messagingServiceSid() { return optional('TWILIO_MESSAGING_SERVICE_SID') },
  },
  resend: {
    get apiKey() { return optional('RESEND_API_KEY') },
    get from() { return optional('EMAIL_FROM') ?? 'KAM Care <care@kam.church>' },
  },
}
