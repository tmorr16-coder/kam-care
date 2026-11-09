-- KAM Care core schema
-- People and households mirror OneChurch. Everything else is KAM Care's own care data.

create extension if not exists pgcrypto;

-- ─── Enums ──────────────────────────────────────────────────────────────────
create type app_role as enum ('member', 'care_leader', 'staff', 'pastor');
create type urgency as enum ('urgent', 'high', 'normal');
create type case_status as enum ('open', 'closed');
create type task_status as enum ('scheduled', 'due', 'done', 'cancelled');
create type task_outcome as enum ('reached', 'left_message', 'needs_pastor');
create type channel as enum ('text', 'call', 'visit', 'email', 'app', 'card');
create type sensitive_visibility as enum ('pastors', 'pastors_and_staff');
create type request_kind as enum ('prayer', 'pastor_call', 'practical', 'counseling');
create type request_visibility as enum ('pastors', 'prayer_team', 'church');
create type request_status as enum ('received', 'in_progress', 'approved', 'closed');
create type moment_type as enum (
  'birth', 'wedding', 'promotion', 'award', 'anniversary', 'work_anniversary', 'moved',
  'sickness', 'bereavement', 'job_loss', 'shut_in', 'birthday', 'other'
);
create type signal_kind as enum (
  'checkin_drop', 'checkin_low', 'missed_attendance', 'livestream_absent',
  'giving_first', 'giving_lapse', 'giving_increase', 'giving_new_recurring', 'giving_quiet',
  'prayer_request', 'care_request', 'life_moment', 'guest_visit', 'shut_in_due', 'social_post',
  'flagged', 'touch', 'engagement', 'safety'
);

-- ─── Reference data ─────────────────────────────────────────────────────────
create table campuses (
  id text primary key,                        -- 'indianapolis', 'detroit', 'atlanta', 'global'
  name text not null,
  oc_location_id int unique,                  -- OneChurch person.location id
  sort int not null default 0
);

create table households (
  id uuid primary key default gen_random_uuid(),
  oc_family_id int unique,
  name text,
  synced_at timestamptz
);

create table people (
  id uuid primary key default gen_random_uuid(),
  oc_person_id int unique,
  household_id uuid references households(id) on delete set null,
  title text,                                 -- Sis., Bro., Mother, Dcn.
  first_name text not null,
  last_name text not null,
  display_name text generated always as (
    coalesce(title || ' ', '') || first_name || ' ' || last_name
  ) stored,
  email text,
  phone text,
  campus_id text references campuses(id),
  family_position text,                       -- Head, Spouse, Child
  birthday date,
  anniversary date,
  member_since date,
  is_guest boolean not null default false,
  archived boolean not null default false,
  deceased boolean not null default false,
  ministries text[] not null default '{}',
  synced_at timestamptz,
  created_at timestamptz not null default now()
);
create index people_email_idx on people (lower(email));
create index people_phone_idx on people (phone);
create index people_campus_idx on people (campus_id);
create index people_household_idx on people (household_id);

-- KAM Care's live view of each person's care state, kept up to date by the care engine.
create table person_care (
  person_id uuid primary key references people(id) on delete cascade,
  care_score int,                             -- 0–100
  care_score_delta_14d int,
  last_touch_at timestamptz,
  last_touch_summary text,
  primary_team_id uuid,
  is_shut_in boolean not null default false,
  lives_alone boolean not null default false,
  preferred_channel channel,
  text_read_fast boolean,                     -- reads texts within the hour
  email_ignored boolean,
  updated_at timestamptz not null default now()
);

-- ─── Users and roles ────────────────────────────────────────────────────────
create table profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  person_id uuid unique references people(id) on delete set null,
  role app_role not null default 'member',
  is_admin boolean not null default false,    -- may manage the OneChurch connection
  campus_id text references campuses(id),
  match_status text not null default 'pending' check (match_status in ('pending', 'matched', 'review', 'rejected')),
  last_role_sync_at timestamptz,
  created_at timestamptz not null default now()
);

-- OneChurch group membership decides a signed-in user's KAM Care role.
create table role_mappings (
  oc_group_id int primary key,
  group_name text not null,
  role app_role not null,
  grants_admin boolean not null default false
);

-- ─── Care teams ─────────────────────────────────────────────────────────────
create table care_teams (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  subtitle text,                              -- "Care deacon", "Team · 4 people"
  kind text not null default 'person' check (kind in ('person', 'team')),
  person_id uuid references people(id) on delete set null,  -- for a single leader
  campus_id text references campuses(id),     -- null = all campuses
  weekly_capacity int not null default 8,
  gifted_for text[] not null default '{}',
  oc_group_id int,                            -- optional source group in OneChurch
  active boolean not null default true
);

create table care_team_members (
  team_id uuid references care_teams(id) on delete cascade,
  person_id uuid references people(id) on delete cascade,
  primary key (team_id, person_id)
);

alter table person_care
  add constraint person_care_primary_team_fk foreign key (primary_team_id) references care_teams(id) on delete set null;

-- ─── Consent ────────────────────────────────────────────────────────────────
create table consents (
  person_id uuid primary key references people(id) on delete cascade,
  weekly_checkin boolean not null default false,
  texts boolean not null default true,
  emails boolean not null default true,
  use_attendance boolean not null default true,
  celebrate_milestones boolean not null default true,
  use_giving boolean not null default false,
  social_connected boolean not null default false,
  social_provider text,
  updated_at timestamptz not null default now()
);

-- ─── Member input ───────────────────────────────────────────────────────────
create table checkins (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references people(id) on delete cascade,
  score int not null check (score between 1 and 5),   -- 5 Great … 1 Very hard
  note text,
  wants_contact boolean not null default false,
  source text not null default 'portal' check (source in ('portal', 'text')),
  created_at timestamptz not null default now()
);
create index checkins_person_idx on checkins (person_id, created_at desc);

create table care_requests (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references people(id) on delete cascade,
  kind request_kind not null,
  topic text,                                 -- Health, Family, Work & finances…
  body text,
  items text[] not null default '{}',         -- practical help: groceries, holiday…
  visibility request_visibility not null default 'pastors',
  wants_call boolean not null default false,
  contact_pref channel,
  status request_status not null default 'received',
  team_id uuid references care_teams(id),
  case_id uuid,
  source text not null default 'portal',      -- portal, onechurch_form, text_line
  oc_form_entry_id int unique,
  created_at timestamptz not null default now()
);
create index care_requests_person_idx on care_requests (person_id, created_at desc);

create table life_moments (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references people(id) on delete cascade,
  type moment_type not null,
  moment_date date not null,
  who text,
  note text,
  share_with_church boolean not null default false,
  remind_yearly boolean not null default false,
  source text not null default 'portal',      -- portal, onechurch_profile, care_request, social
  status text not null default 'open' check (status in ('open', 'celebrated', 'closed')),
  case_id uuid,
  created_at timestamptz not null default now()
);
create index life_moments_date_idx on life_moments (moment_date);

create table attendance (
  id bigint generated always as identity primary key,
  person_id uuid not null references people(id) on delete cascade,
  kind text not null check (kind in ('sunday', 'bible_study', 'other')),
  meeting_date date not null,
  via text not null default 'in_person' check (via in ('in_person', 'livestream')),
  oc_attendance_id int,
  unique (person_id, kind, meeting_date)
);
create index attendance_person_idx on attendance (person_id, meeting_date desc);

-- Giving pattern only. Amounts are read from OneChurch to compute these and then discarded.
create table giving_patterns (
  person_id uuid primary key references people(id) on delete cascade,
  first_gift_on date,
  last_gift_on date,
  has_recurring boolean not null default false,
  recurring_stopped_on date,
  gifts_last_90d int not null default 0,
  trend text check (trend in ('new', 'steady', 'up', 'down', 'lapsed', 'quiet')),
  years_giving int,
  updated_at timestamptz not null default now()
);

-- ─── Care work ──────────────────────────────────────────────────────────────
create table signals (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references people(id) on delete cascade,
  kind signal_kind not null,
  summary text not null,
  source text not null,                       -- 'Member portal check-in', 'OneChurch attendance'
  pastors_only boolean not null default false,
  severity urgency not null default 'normal',
  occurred_at timestamptz not null default now(),
  dedupe_key text unique,
  data jsonb not null default '{}'
);
create index signals_person_idx on signals (person_id, occurred_at desc);

create table care_cases (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references people(id) on delete cascade,
  household_label text,                       -- "The Coleman family"
  status case_status not null default 'open',
  urgency urgency not null default 'normal',
  sensitive boolean not null default false,
  sensitive_visibility sensitive_visibility,
  sensitive_reason text,
  why_flagged text not null,
  action_channels channel[] not null default '{}',
  action_title text not null,                 -- "Visit + Call"
  action_detail text,
  suggested_message text,
  confidence text default 'medium',
  owner_team_id uuid references care_teams(id),
  due_on date,
  moment_type moment_type,
  dedupe_key text unique,
  flagged_by uuid references auth.users(id),
  opened_at timestamptz not null default now(),
  first_touch_at timestamptz,
  closed_at timestamptz,
  snoozed_until date
);
create index care_cases_open_idx on care_cases (status, urgency, due_on);
create index care_cases_person_idx on care_cases (person_id);

alter table care_requests add constraint care_requests_case_fk foreign key (case_id) references care_cases(id) on delete set null;
alter table life_moments add constraint life_moments_case_fk foreign key (case_id) references care_cases(id) on delete set null;

create table tasks (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references care_cases(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  title text not null,
  subtitle text,
  instructions text,
  task_type text not null default 'call',     -- call, text, visit, card, coffee, intake, referral
  assignee_team_id uuid references care_teams(id),
  due_on date not null,
  status task_status not null default 'scheduled',
  outcome task_outcome,
  sensitive boolean not null default false,
  escalation_level int not null default 1 check (escalation_level between 1 and 4),
  escalated_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  notified_at timestamptz
);
create index tasks_assignee_idx on tasks (assignee_team_id, status, due_on);
create index tasks_case_idx on tasks (case_id);

create table touches (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references people(id) on delete cascade,
  case_id uuid references care_cases(id) on delete set null,
  task_id uuid references tasks(id) on delete set null,
  channel channel not null,
  outcome task_outcome,
  summary text not null,
  body text,                                  -- message text, when one was sent
  delivery_status text,                       -- sent, queued, failed, not_configured
  by_user uuid references auth.users(id),
  by_team_id uuid references care_teams(id),
  occurred_at timestamptz not null default now(),
  oc_note_id int,
  oc_written_at timestamptz
);
create index touches_person_idx on touches (person_id, occurred_at desc);

create table care_ratings (
  id uuid primary key default gen_random_uuid(),
  touch_id uuid references touches(id) on delete set null,
  person_id uuid not null references people(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  created_at timestamptz not null default now()
);

create table pastoral_notes (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references people(id) on delete cascade,
  author uuid references auth.users(id),
  body text not null,
  created_at timestamptz not null default now()
);

create table access_log (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id),
  person_id uuid references people(id) on delete cascade,
  case_id uuid references care_cases(id) on delete cascade,
  action text not null,                       -- view_sensitive, change_access, export
  at timestamptz not null default now()
);

create table message_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  channel channel not null,
  moment_type moment_type,
  body text not null,
  updated_at timestamptz not null default now()
);

create table playbooks (
  moment_type moment_type primary key,
  label text not null,
  summary text not null,
  urgency urgency not null default 'normal',
  sensitive boolean not null default false,
  action_channels channel[] not null default '{}',
  action_title text not null,
  -- [{ "offset_days": 0, "title": "Pastor call", "task_type": "call", "team_slug": "pastoral-office" }]
  steps jsonb not null default '[]'
);

-- ─── OneChurch sync ─────────────────────────────────────────────────────────
create table oc_webhook_events (
  id bigint generated always as identity primary key,
  event text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  status text not null default 'received' check (status in ('received', 'processed', 'failed', 'ignored')),
  http_status int not null default 200,
  summary text,
  error text
);
create index oc_webhook_events_received_idx on oc_webhook_events (received_at desc);

create table oc_webhook_subscriptions (
  oc_subscription_id int primary key,
  event text not null unique,
  url text not null,
  created_at timestamptz not null default now()
);

create table sync_runs (
  id bigint generated always as identity primary key,
  kind text not null,                         -- reconcile, engine, escalate
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean,
  stats jsonb not null default '{}',
  error text
);

create table match_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,                        -- "D. & L. Grant"
  reason text not null,                       -- "Shared family email matches 2 people"
  candidate_person_ids uuid[] not null default '{}',
  status text not null default 'open' check (status in ('open', 'resolved', 'rejected')),
  resolved_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- A profile milestone (birthday, anniversary) lands on the calendar once per date.
create unique index life_moments_profile_uniq on life_moments (person_id, type, moment_date) where source = 'onechurch_profile';
