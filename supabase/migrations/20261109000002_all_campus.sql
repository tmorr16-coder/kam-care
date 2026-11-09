-- OneChurch's "ALL Campus" location: people who belong to every campus rather than one.
insert into campuses (id, name, sort) values ('all', 'All Campus', 5) on conflict (id) do nothing;
