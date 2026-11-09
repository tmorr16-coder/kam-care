import 'server-only'
import { env } from '@/lib/env'

export type DeliveryStatus = 'sent' | 'failed' | 'not_configured'

/** Sends a text through Twilio. Returns not_configured when Twilio isn't set up yet. */
export async function sendSms(to: string | null | undefined, body: string): Promise<DeliveryStatus> {
  const { accountSid, authToken, messagingServiceSid } = env.twilio
  if (!to) return 'failed'
  if (!accountSid || !authToken || !messagingServiceSid) {
    console.info('[sms:not_configured]', to.slice(-4), body.slice(0, 60))
    return 'not_configured'
  }
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, MessagingServiceSid: messagingServiceSid, Body: body }),
  })
  if (!res.ok) console.error('[sms:failed]', res.status, await res.text().catch(() => ''))
  return res.ok ? 'sent' : 'failed'
}

/** Sends an email through Resend. */
export async function sendEmail(to: string | null | undefined, subject: string, text: string): Promise<DeliveryStatus> {
  const { apiKey, from } = env.resend
  if (!to) return 'failed'
  if (!apiKey) {
    console.info('[email:not_configured]', subject)
    return 'not_configured'
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, text }),
  })
  if (!res.ok) console.error('[email:failed]', res.status, await res.text().catch(() => ''))
  return res.ok ? 'sent' : 'failed'
}

export function fillTemplate(body: string, vars: Record<string, string | number | undefined | null>) {
  return body.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : m))
}
