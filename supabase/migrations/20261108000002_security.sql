-- Row-level security. The database enforces who sees what, so a bug in the app
-- can't leak a sensitive matter or a giving pattern.
--
--   member       their own record, check-ins, requests and consent
--   care_leader  only the tasks assigned to their team, and the people on those tasks
--   staff        the care queue, minus sensitive matters marked "Pastors only" and all giving
--   pastor       everything, including giving patterns and pastoral notes
--   is_admin     (flag) the OneChurch connection, sync log and match reviews

-- ─── Helpers ────────────────────────────────────────────────────────────────
create or replace function public.current_person_id() returns uuid
language sql stable security definer set search_path = public as $$
  select person_id from profiles where user_id = auth.uid()
$$;

create or replace function public.current_app_role() returns app_role
language sql stable security definer set search_path = public as $$
  select coalesce((select role from profiles where user_id = auth.uid()), 'member'::app_role)
$$;

create or replace function public.is_pastor() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'pastor' from profiles where user_id = auth.uid()), false)
$$;

create or replace function public.is_care_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('staff', 'pastor') from profiles where user_id = auth.uid()), false)
$$;

create or replace function public.is_care_role() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('care_leader', 'staff', 'pastor') from profiles where user_id = auth.uid()), false)
$$;

create or replace function public.is_app_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from profiles where user_id = auth.uid()), false)
$$;

create or replace function public.my_team_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select m.team_id from care_team_members m
  join profiles p on p.person_id = m.person_id
  where p.user_id = auth.uid()
  union
  select t.id from care_teams t
  join profiles p on p.person_id = t.person_id
  where p.user_id = auth.uid()
$$;

create or replace function public.can_see_case(p_sensitive boolean, p_vis sensitive_visibility) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_pastor()
    or (public.is_care_staff() and (not p_sensitive or p_vis = 'pastors_and_staff'))
$$;

create or replace function public.can_see_case_id(p_case uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_case is null and public.is_care_staff()
    or exists (select 1 from care_cases c where c.id = p_case and public.can_see_case(c.sensitive, c.sensitive_visibility))
$$;

-- A leader can see a person only while they hold an open task for them.
create or replace function public.leader_can_see_person(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from tasks t
    where t.person_id = p
      and t.status in ('scheduled', 'due')
      and t.assignee_team_id in (select public.my_team_ids())
  )
$$;

-- ─── New sign-ins get a profile (matched to OneChurch by the app) ───────────
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── A touch updates the case and the person's last touch ───────────────────
create or replace function public.handle_touch() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.case_id is not null then
    update care_cases set first_touch_at = coalesce(first_touch_at, new.occurred_at) where id = new.case_id;
  end if;
  insert into person_care (person_id, last_touch_at, last_touch_summary)
  values (new.person_id, new.occurred_at, new.summary)
  on conflict (person_id) do update
    set last_touch_at = greatest(person_care.last_touch_at, excluded.last_touch_at),
        last_touch_summary = case when excluded.last_touch_at >= coalesce(person_care.last_touch_at, '-infinity')
                                  then excluded.last_touch_summary else person_care.last_touch_summary end,
        updated_at = now();
  return new;
end $$;

create trigger on_touch_created after insert on touches
  for each row execute function public.handle_touch();

-- ─── Leaders log outcomes through this function, not direct table writes ───
create or replace function public.log_task_outcome(p_task uuid, p_outcome task_outcome, p_channel channel default 'call')
returns void language plpgsql security definer set search_path = public as $$
declare
  t tasks;
begin
  select * into t from tasks where id = p_task;
  if t.id is null then raise exception 'task not found'; end if;
  if not (t.assignee_team_id in (select public.my_team_ids()) or public.can_see_case_id(t.case_id)) then
    raise exception 'not allowed';
  end if;

  insert into touches (person_id, case_id, task_id, channel, outcome, summary, by_user, by_team_id)
  values (t.person_id, t.case_id, t.id, p_channel, p_outcome,
          t.title || ' · ' || replace(p_outcome::text, '_', ' '), auth.uid(), t.assignee_team_id);

  if p_outcome = 'reached' then
    update tasks set status = 'done', outcome = p_outcome, completed_at = now() where id = p_task;
  elsif p_outcome = 'needs_pastor' then
    -- Hand straight to the campus pastor (escalation step 2) without closing the task.
    update tasks set outcome = p_outcome, escalation_level = greatest(escalation_level, 2), escalated_at = now()
    where id = p_task;
  else
    update tasks set outcome = p_outcome where id = p_task;
  end if;
end $$;

grant execute on function public.log_task_outcome(uuid, task_outcome, channel) to authenticated;

-- ─── Enable RLS everywhere ──────────────────────────────────────────────────
do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', r.tablename);
  end loop;
end $$;

-- campuses, playbooks, templates: reference data
create policy campuses_read on campuses for select to authenticated using (true);
create policy playbooks_read on playbooks for select to authenticated using (is_care_role());
create policy playbooks_write on playbooks for all to authenticated using (is_pastor()) with check (is_pastor());
create policy templates_read on message_templates for select to authenticated using (is_care_role());
create policy templates_write on message_templates for all to authenticated using (is_care_staff()) with check (is_care_staff());

-- people & households
create policy people_read on people for select to authenticated using (
  is_care_staff() or id = current_person_id() or leader_can_see_person(id)
);
create policy households_read on households for select to authenticated using (
  is_care_staff() or id = (select household_id from people where id = current_person_id())
);
create policy person_care_read on person_care for select to authenticated using (is_care_staff());

-- profiles
create policy profiles_read on profiles for select to authenticated using (user_id = auth.uid() or is_care_staff() or is_app_admin());
create policy role_mappings_read on role_mappings for select to authenticated using (is_care_staff() or is_app_admin());
create policy role_mappings_write on role_mappings for all to authenticated using (is_app_admin()) with check (is_app_admin());

-- care teams
create policy care_teams_read on care_teams for select to authenticated using (is_care_role());
create policy care_teams_write on care_teams for all to authenticated using (is_care_staff()) with check (is_care_staff());
create policy care_team_members_read on care_team_members for select to authenticated using (is_care_role());
create policy care_team_members_write on care_team_members for all to authenticated using (is_care_staff()) with check (is_care_staff());

-- consent: members manage their own
create policy consents_own on consents for all to authenticated
  using (person_id = current_person_id()) with check (person_id = current_person_id());
create policy consents_staff_read on consents for select to authenticated using (is_care_staff());

-- check-ins
create policy checkins_own_insert on checkins for insert to authenticated with check (person_id = current_person_id());
create policy checkins_read on checkins for select to authenticated using (person_id = current_person_id() or is_care_staff());

-- care requests
create policy requests_own_insert on care_requests for insert to authenticated with check (person_id = current_person_id());
create policy requests_read on care_requests for select to authenticated using (
  person_id = current_person_id()
  or is_pastor()
  or (is_care_staff() and visibility <> 'pastors' and kind <> 'counseling')
  or team_id in (select my_team_ids())
);
create policy requests_update on care_requests for update to authenticated using (
  is_pastor()
  or (is_care_staff() and visibility <> 'pastors' and kind <> 'counseling')
  or team_id in (select my_team_ids())
);

-- life moments
create policy moments_own_insert on life_moments for insert to authenticated with check (person_id = current_person_id() or is_care_staff());
create policy moments_read on life_moments for select to authenticated using (person_id = current_person_id() or is_care_staff());
create policy moments_update on life_moments for update to authenticated using (is_care_staff());

-- attendance
create policy attendance_read on attendance for select to authenticated using (person_id = current_person_id() or is_care_staff());

-- giving: pastors only, never amounts
create policy giving_read on giving_patterns for select to authenticated using (is_pastor());

-- signals
create policy signals_read on signals for select to authenticated using (is_pastor() or (is_care_staff() and not pastors_only));
create policy signals_insert on signals for insert to authenticated with check (is_care_staff());

-- cases
create policy cases_read on care_cases for select to authenticated using (can_see_case(sensitive, sensitive_visibility));
create policy cases_insert on care_cases for insert to authenticated with check (can_see_case(sensitive, sensitive_visibility));
create policy cases_update on care_cases for update to authenticated using (can_see_case(sensitive, sensitive_visibility)) with check (can_see_case(sensitive, sensitive_visibility));

-- tasks: leaders see their own; staff see tasks on cases they can see
create policy tasks_read on tasks for select to authenticated using (
  assignee_team_id in (select my_team_ids()) or can_see_case_id(case_id)
);
create policy tasks_insert on tasks for insert to authenticated with check (is_care_staff() and can_see_case_id(case_id));
create policy tasks_update on tasks for update to authenticated using (is_care_staff() and can_see_case_id(case_id));

-- touches
create policy touches_read on touches for select to authenticated using (
  by_user = auth.uid() or can_see_case_id(case_id)
);
create policy touches_insert on touches for insert to authenticated with check (
  by_user = auth.uid() and is_care_role() and (can_see_case_id(case_id) or leader_can_see_person(person_id))
);

-- ratings: members rate, pastors read
create policy ratings_own_insert on care_ratings for insert to authenticated with check (person_id = current_person_id());
create policy ratings_read on care_ratings for select to authenticated using (person_id = current_person_id() or is_pastor());

-- pastoral notes: pastors only
create policy pastoral_notes_all on pastoral_notes for all to authenticated using (is_pastor()) with check (is_pastor() and author = auth.uid());

-- access log: everyone in a care role writes their own entries; pastors read
create policy access_log_insert on access_log for insert to authenticated with check (user_id = auth.uid() and is_care_role());
create policy access_log_read on access_log for select to authenticated using (is_pastor() or is_app_admin());

-- OneChurch sync: admins (and staff for read-only health)
create policy webhook_events_read on oc_webhook_events for select to authenticated using (is_app_admin() or is_care_staff());
create policy webhook_subs_read on oc_webhook_subscriptions for select to authenticated using (is_app_admin());
create policy sync_runs_read on sync_runs for select to authenticated using (is_app_admin() or is_care_staff());
create policy match_reviews_read on match_reviews for select to authenticated using (is_app_admin() or is_care_staff());
create policy match_reviews_update on match_reviews for update to authenticated using (is_app_admin() or is_care_staff());
create policy settings_read on app_settings for select to authenticated using (is_app_admin() or is_care_staff());
create policy settings_write on app_settings for update to authenticated using (is_app_admin());
