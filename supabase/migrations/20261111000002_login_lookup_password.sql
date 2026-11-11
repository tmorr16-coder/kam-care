-- Adds whether the sign-in has a password (or uses Google etc.), so the admin portal can tell
-- "finished setting up" from "invite link opened by an email scanner, no password yet".
drop function if exists public.login_for_email(text);

create function public.login_for_email(p_email text)
returns table (user_id uuid, email text, invited_at timestamptz, last_sign_in_at timestamptz, has_password boolean, other_providers boolean)
language sql stable security definer set search_path = '' as $$
  select u.id, u.email::text, u.invited_at, u.last_sign_in_at,
    coalesce(u.encrypted_password, '') <> '',
    exists (select 1 from auth.identities i where i.user_id = u.id and i.provider <> 'email')
  from auth.users u
  where lower(u.email) = lower(trim(p_email))
  limit 1
$$;

revoke all on function public.login_for_email(text) from public, anon, authenticated;
grant execute on function public.login_for_email(text) to service_role;
