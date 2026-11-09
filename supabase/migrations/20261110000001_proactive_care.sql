-- Proactive care: signals KAM Care notices without the member telling us.
alter type signal_kind add value if not exists 'household_change';  -- someone joined or left a household in OneChurch
alter type signal_kind add value if not exists 'attendance_fade';   -- weekly → occasional, not a hard stop
alter type signal_kind add value if not exists 'contact_lost';      -- texts or emails keep failing

-- Leaders can't browse the people list (they only see people on their open tasks), so the
-- "Saw it on social" form searches through this function. It returns name and campus only.
create or replace function public.leader_find_people(q text)
returns table (id uuid, display_name text, campus text)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, c.name
  from people p
  left join campuses c on c.id = p.campus_id
  where public.is_care_role()
    and length(trim(q)) >= 2
    and not p.archived and not p.deceased
    and (p.display_name ilike '%' || trim(q) || '%' or (p.first_name || ' ' || p.last_name) ilike '%' || trim(q) || '%')
  order by p.last_name, p.first_name
  limit 8
$$;
revoke all on function public.leader_find_people(text) from public, anon;
grant execute on function public.leader_find_people(text) to authenticated;
