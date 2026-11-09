-- Roles normally come from OneChurch group membership. A role granted by hand (e.g. the first
-- admin, before any role mappings exist) is marked manual so the sync never overwrites it.
alter table profiles add column role_source text not null default 'onechurch'
  check (role_source in ('onechurch', 'manual'));
