'use server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RESET_PATH } from '@/app/login/paths'
import { LINK_TYPES, type LinkType } from './types'

export type ConfirmState = { error?: string } | undefined

/** Runs only when the person presses the button, so email link scanners can't use up the link. */
export async function confirmLink(_: ConfirmState, fd: FormData): Promise<ConfirmState> {
  const tokenHash = String(fd.get('token_hash') ?? '')
  const type = String(fd.get('type') ?? '') as LinkType
  if (!tokenHash || !LINK_TYPES.includes(type)) return { error: 'expired' }

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
  if (error) return { error: 'expired' }

  if (type === 'invite') redirect(`${RESET_PATH}?welcome=1`)
  if (type === 'recovery') redirect(RESET_PATH)
  // Magic link and others: the callback matches them to OneChurch and routes by role.
  redirect('/auth/callback')
}
