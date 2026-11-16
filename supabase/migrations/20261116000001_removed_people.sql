-- People an admin deleted from KAM Care. The OneChurch sync skips these, so a deleted
-- member isn't re-created on the next nightly reconcile or webhook.
create table removed_people (
  oc_person_id int primary key,
  name text,
  removed_by uuid references auth.users(id) on delete set null,
  removed_at timestamptz not null default now()
);

-- Service role only: no policies, so signed-in users can't read or write it.
alter table removed_people enable row level security;
