-- Lets the admin portal see whether an email already has a KAM Care sign-in
-- (including someone invited who hasn't accepted yet). Server-only: callable
-- with the service-role key, never from the browser.
create or replace function public.login_for_email(p_email text)
returns table (user_id uuid, email text, invited_at timestamptz, email_confirmed_at timestamptz, last_sign_in_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select u.id, u.email::text, u.invited_at, u.email_confirmed_at, u.last_sign_in_at
  from auth.users u
  where lower(u.email) = lower(trim(p_email))
  limit 1
$$;

revoke all on function public.login_for_email(text) from public, anon, authenticated;
grant execute on function public.login_for_email(text) to service_role;
