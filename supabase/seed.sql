-- Local sample data that mirrors the design mockup. Never run against production.
-- Demo logins (password: kamcare-demo):
--   pastor@kam.test  pastor + admin     staff@kam.test  staff
--   hayes@kam.test   care leader        kevin@kam.test  member

-- ─── People ─────────────────────────────────────────────────────────────────
insert into households (id, oc_family_id, name) values
  ('b0000000-0000-0000-0000-000000000001', 9001, 'Ortiz'),
  ('b0000000-0000-0000-0000-000000000002', 9002, 'Coleman'),
  ('b0000000-0000-0000-0000-000000000003', 9003, 'Reed'),
  ('b0000000-0000-0000-0000-000000000004', 9004, 'Williams'),
  ('b0000000-0000-0000-0000-000000000005', 9005, 'Johnson');

insert into people (id, oc_person_id, household_id, title, first_name, last_name, email, phone, campus_id, family_position, member_since, ministries, birthday) values
  -- care leaders and staff
  ('a0000000-0000-0000-0000-000000000101', 101, null, 'Dcn.', 'Ronald', 'Hayes', 'hayes@kam.test', '+13135550101', 'detroit', 'Head', '2004-01-01', '{Deacons,Men''s Ministry}', null),
  ('a0000000-0000-0000-0000-000000000102', 102, null, 'Sis.', 'Monica', 'Carter', 'carter@kam.test', '+13175550102', 'global', 'Head', '2010-01-01', '{Care Ministry}', null),
  ('a0000000-0000-0000-0000-000000000103', 103, null, 'Bro.', 'James', 'Hill', 'hill@kam.test', '+13175550103', 'indianapolis', 'Head', '2012-01-01', '{Small Groups}', null),
  ('a0000000-0000-0000-0000-000000000104', 104, null, 'Bro.', 'David', 'Price', 'price@kam.test', '+13135550104', 'detroit', 'Head', '2009-01-01', '{Men''s Ministry}', null),
  ('a0000000-0000-0000-0000-000000000105', 105, null, 'Pastor', 'Grace', 'Mitchell', 'pastor@kam.test', '+13175550105', 'indianapolis', 'Head', '2001-01-01', '{Pastoral Staff}', null),
  ('a0000000-0000-0000-0000-000000000106', 106, null, null, 'Jordan', 'Ellis', 'staff@kam.test', '+13175550106', 'indianapolis', 'Head', '2018-01-01', '{Member Services}', null),
  -- members in the care queue
  ('a0000000-0000-0000-0000-000000000001', 1, 'b0000000-0000-0000-0000-000000000001', null, 'Kevin', 'Ortiz', 'kevin@kam.test', '+13135550001', 'detroit', 'Head', '2019-03-01', '{Men''s Ministry}', '1987-04-12'),
  ('a0000000-0000-0000-0000-000000000002', 2, 'b0000000-0000-0000-0000-000000000001', null, 'Maria', 'Ortiz', 'maria@kam.test', '+13135550002', 'detroit', 'Spouse', '2019-03-01', '{}', '1989-08-02'),
  ('a0000000-0000-0000-0000-000000000003', 3, 'b0000000-0000-0000-0000-000000000002', 'Bro.', 'Terrence', 'Coleman', 'tcoleman@kam.test', '+14045550003', 'atlanta', 'Head', '2015-01-01', '{}', null),
  ('a0000000-0000-0000-0000-000000000004', 4, null, null, 'Gloria', 'Banks', 'gbanks@kam.test', '+13175550004', 'indianapolis', 'Head', '2011-01-01', '{}', null),
  ('a0000000-0000-0000-0000-000000000005', 5, null, null, 'Robert', 'Lee Sr.', 'rlee@kam.test', '+13175550005', 'global', 'Head', '2008-01-01', '{}', '1948-02-10'),
  ('a0000000-0000-0000-0000-000000000006', 6, 'b0000000-0000-0000-0000-000000000003', null, 'Marcus', 'Reed', 'mreed@kam.test', '+13175550006', 'indianapolis', 'Head', '2022-01-01', '{}', null),
  ('a0000000-0000-0000-0000-000000000007', 7, 'b0000000-0000-0000-0000-000000000003', null, 'Tonya', 'Reed', 'treed@kam.test', '+13175550007', 'indianapolis', 'Spouse', '2022-01-01', '{}', null),
  ('a0000000-0000-0000-0000-000000000008', 8, null, null, 'Darnell', 'Brooks', 'dbrooks@kam.test', '+13135550008', 'detroit', 'Head', '2016-01-01', '{}', null),
  ('a0000000-0000-0000-0000-000000000009', 9, null, 'Mother', 'Ella', 'Simmons', null, '+13175550009', 'indianapolis', 'Head', '1990-01-01', '{}', '1936-05-20'),
  ('a0000000-0000-0000-0000-000000000010', 10, null, null, 'Aaliyah', 'Grant', 'agrant@kam.test', '+14045550010', 'atlanta', 'Head', null, '{}', null),
  ('a0000000-0000-0000-0000-000000000011', 11, 'b0000000-0000-0000-0000-000000000004', null, 'Andre', 'Williams', 'awilliams@kam.test', '+13135550011', 'detroit', 'Head', '2020-01-01', '{}', null),
  -- coming up in the next 7 days
  ('a0000000-0000-0000-0000-000000000012', 12, null, 'Sis.', 'Linda', 'Moore', 'lmoore@kam.test', '+13175550012', 'indianapolis', 'Head', '1999-01-01', '{}', null),
  ('a0000000-0000-0000-0000-000000000013', 13, 'b0000000-0000-0000-0000-000000000005', null, 'James', 'Johnson', 'jjohnson@kam.test', '+13175550013', 'indianapolis', 'Head', '2001-01-01', '{}', null),
  ('a0000000-0000-0000-0000-000000000014', 14, 'b0000000-0000-0000-0000-000000000005', null, 'Carla', 'Johnson', 'cjohnson@kam.test', '+13175550014', 'indianapolis', 'Spouse', '2001-01-01', '{}', null),
  ('a0000000-0000-0000-0000-000000000015', 15, null, null, 'Tasha', 'Green', 'tgreen@kam.test', '+14045550015', 'atlanta', 'Head', '2017-01-01', '{}', null),
  ('a0000000-0000-0000-0000-000000000016', 16, null, 'Bro.', 'Andre', 'Lewis', 'alewis@kam.test', '+13175550016', 'indianapolis', 'Head', '2014-01-01', '{}', null),
  ('a0000000-0000-0000-0000-000000000017', 17, null, null, 'Deborah', 'King', 'dking@kam.test', '+13135550017', 'detroit', 'Head', '2006-01-01', '{}', null),
  ('a0000000-0000-0000-0000-000000000018', 18, null, 'Mother', 'Ruth', 'Harris', null, '+13175550018', 'indianapolis', 'Head', '1975-01-01', '{}', (current_date + 6 - interval '90 years')::date),
  ('a0000000-0000-0000-0000-000000000019', 19, null, null, 'Marcus', 'Webb', 'mwebb@kam.test', '+13135550019', 'detroit', 'Head', '2013-01-01', '{}', null);

-- Filler membership so lists and charts have shape.
insert into people (oc_person_id, first_name, last_name, email, campus_id, member_since)
select 1000 + g,
       (array['Angela','Brian','Cynthia','Darius','Erica','Frank','Gwen','Harold','Imani','Jerome','Keisha','Lamar','Monique','Nathan','Olivia','Patrice','Quentin','Renee','Samuel','Tiana'])[1 + g % 20],
       (array['Adams','Baker','Carter','Davis','Evans','Foster','Graham','Hughes','Irving','Jackson','Kelly','Lawson','Mason','Nelson','Owens','Parker'])[1 + (g * 7) % 16],
       'member' || g || '@kam.test',
       (array['indianapolis','indianapolis','indianapolis','detroit','detroit','atlanta','global'])[1 + g % 7],
       current_date - (g * 37 % 5000)
from generate_series(1, 140) g;

-- ─── Care teams ─────────────────────────────────────────────────────────────
insert into care_teams (id, slug, name, subtitle, kind, person_id, campus_id, weekly_capacity, gifted_for) values
  ('c0000000-0000-0000-0000-000000000001', 'dcn-r-hayes', 'Dcn. R. Hayes', 'Care deacon', 'person', 'a0000000-0000-0000-0000-000000000101', 'detroit', 8, '{Men,employment,hospital}'),
  ('c0000000-0000-0000-0000-000000000002', 'sis-m-carter', 'Sis. M. Carter', 'Care minister', 'person', 'a0000000-0000-0000-0000-000000000102', 'global', 8, '{Seniors,"phone care"}'),
  ('c0000000-0000-0000-0000-000000000003', 'bro-j-hill', 'Bro. J. Hill', 'Small group leader', 'person', 'a0000000-0000-0000-0000-000000000103', 'indianapolis', 6, '{Re-engagement,couples}'),
  ('c0000000-0000-0000-0000-000000000004', 'care-team-east', 'Care Team East', 'Team · 4 people', 'team', null, 'indianapolis', 12, '{Hospital,meals}'),
  ('c0000000-0000-0000-0000-000000000005', 'shut-in-team', 'Shut-in Team', 'Team · 6 people', 'team', null, null, 18, '{Communion,"home visits"}'),
  ('c0000000-0000-0000-0000-000000000006', 'benevolence-team', 'Benevolence Team', 'Team · 3 people', 'team', null, null, 10, '{Food,holiday,"Total Restoration"}'),
  ('c0000000-0000-0000-0000-000000000007', 'guest-team-atl', 'Guest Team ATL', 'Team · 5 people', 'team', null, 'atlanta', 10, '{"New guests","new members"}'),
  ('c0000000-0000-0000-0000-000000000008', 'bro-d-price', 'Bro. D. Price', 'Men''s Ministry lead', 'person', 'a0000000-0000-0000-0000-000000000104', 'detroit', 5, '{Men,mentoring,jobs}'),
  ('c0000000-0000-0000-0000-000000000009', 'pastoral-office', 'Pastoral office', 'Campus pastors', 'team', null, null, 30, '{Bereavement,crisis}'),
  ('c0000000-0000-0000-0000-000000000010', 'counseling-services', 'Counseling Services', 'Licensed counselors', 'team', null, null, 10, '{Counseling}');

insert into care_team_members (team_id, person_id) values
  ('c0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000105');

-- ─── Consent ────────────────────────────────────────────────────────────────
insert into consents (person_id, weekly_checkin, texts, emails, use_attendance, celebrate_milestones, use_giving, social_connected)
select id, (oc_person_id % 10) < 7, true, true, true, true, (oc_person_id % 3) = 0, (oc_person_id % 4) = 0 from people;
update consents set weekly_checkin = true, use_giving = true, social_connected = false where person_id = 'a0000000-0000-0000-0000-000000000001';

-- ─── Person care state ──────────────────────────────────────────────────────
insert into person_care (person_id, care_score, care_score_delta_14d, primary_team_id, is_shut_in, lives_alone, preferred_channel, text_read_fast, email_ignored) values
  ('a0000000-0000-0000-0000-000000000001', 42, -31, 'c0000000-0000-0000-0000-000000000001', false, false, 'text', true, true),
  ('a0000000-0000-0000-0000-000000000005', 51, -12, 'c0000000-0000-0000-0000-000000000002', false, true, 'call', false, false),
  ('a0000000-0000-0000-0000-000000000009', 60, 0, 'c0000000-0000-0000-0000-000000000005', true, true, 'visit', false, false),
  ('a0000000-0000-0000-0000-000000000018', 70, 0, 'c0000000-0000-0000-0000-000000000005', true, false, 'visit', false, false);

-- ─── Kevin Ortiz: the worked example ────────────────────────────────────────
insert into checkins (person_id, score, note, created_at)
select 'a0000000-0000-0000-0000-000000000001', s.score, s.note, (current_date - (7 * (7 - s.i)))::timestamptz + interval '19 hours'
from (values (0,4,null),(1,4,null),(2,4,null),(3,4,null),(4,4,null),(5,4,null),(6,2,null),(7,1,'Lost my job.')) as s(i, score, note);

insert into attendance (person_id, kind, meeting_date, via)
select 'a0000000-0000-0000-0000-000000000001', 'sunday', d::date, 'in_person'
from generate_series(current_date - 77, current_date - 14, interval '7 days') d
where extract(dow from d) = 0 and d::date <> current_date - 35;

insert into attendance (person_id, kind, meeting_date, via)
select 'a0000000-0000-0000-0000-000000000001', 'bible_study', d::date, 'in_person'
from generate_series(current_date - 82, current_date - 12, interval '7 days') d
where d::date not in (current_date - 75, current_date - 47);

insert into touches (person_id, channel, outcome, summary, by_team_id, occurred_at) values
  ('a0000000-0000-0000-0000-000000000001', 'text', 'reached', 'Text from Dcn. Hayes; Kevin replied', 'c0000000-0000-0000-0000-000000000001', current_date - 19);

insert into giving_patterns (person_id, first_gift_on, last_gift_on, has_recurring, gifts_last_90d, trend, years_giving) values
  ('a0000000-0000-0000-0000-000000000001', '2019-05-01', current_date - 20, true, 8, 'steady', 6),
  ('a0000000-0000-0000-0000-000000000008', '2018-01-07', current_date - 45, false, 2, 'lapsed', 6);
update giving_patterns set recurring_stopped_on = current_date - 30 where person_id = 'a0000000-0000-0000-0000-000000000008';

-- ─── Open care queue ────────────────────────────────────────────────────────
insert into care_cases (id, person_id, household_label, urgency, sensitive, sensitive_visibility, sensitive_reason, why_flagged, action_channels, action_title, action_detail, suggested_message, confidence, owner_team_id, due_on, moment_type, opened_at) values
  ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'The Coleman family', 'urgent', true, 'pastors_and_staff', 'Bereavement',
   'Bereavement: Bro. Coleman''s father passed Nov 6 (reported by his small group).', '{visit,call}', 'Visit + Call',
   'Pastor visit; connect Funerals ministry; set 30/90/365-day grief follow-ups.', null, 'high', 'c0000000-0000-0000-0000-000000000009', current_date, 'bereavement', now() - interval '20 hours'),
  ('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000004', null, 'urgent', true, 'pastors_and_staff', 'Health',
   'Prayer request via portal: mother admitted to hospital Friday.', '{visit,call}', 'Visit + Call',
   'Hospital visit today; start a meal train for the family.', null, 'high', 'c0000000-0000-0000-0000-000000000004', current_date, 'sickness', now() - interval '30 hours'),
  ('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', null, 'urgent', true, 'pastors', 'Employment and finances',
   'Weekly check-in dropped from Good to Very hard; mentioned job loss.', '{text,call}', 'Text, then Call',
   'Pastoral text now; offer Counseling Services and Community Resources (211).',
   'Hey Kevin, it''s Deacon Hayes. You''ve been on my heart this week. No agenda, just want to see how you and the family are holding up. Got a few minutes Tuesday before Bible Study?',
   'high', 'c0000000-0000-0000-0000-000000000001', current_date, 'job_loss', now() - interval '2 days'),
  ('d0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000005', null, 'urgent', false, null, null,
   'Lives alone, 78. Hasn''t joined the 10 AM livestream in 3 weeks.', '{call}', 'Call',
   'Wellness call; offer a ride or a home visit.', null, 'medium', 'c0000000-0000-0000-0000-000000000002', current_date, null, now() - interval '10 hours'),
  ('d0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000006', 'Marcus & Tonya Reed', 'high', false, null, null,
   'Missed 4 Sundays after 3 years of steady attendance.', '{call}', 'Call',
   'Check-in call from their small group leader. No ask.', null, 'medium', 'c0000000-0000-0000-0000-000000000003', current_date + 1, null, now() - interval '6 hours'),
  ('d0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000008', null, 'high', true, 'pastors', 'Giving pattern',
   'Recurring giving stopped after 6 years; missed 2 Tuesday Bible Studies.', '{call}', 'Call',
   'Care call, never about giving. Listen for hardship; offer Total Restoration.', null, 'medium', 'c0000000-0000-0000-0000-000000000003', current_date + 1, null, now() - interval '5 hours'),
  ('d0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000009', null, 'high', false, null, null,
   'Shut-in. Monthly visit due; no contact logged in 34 days.', '{visit}', 'Visit',
   'Home visit with Communion; check livestream setup.', null, 'high', 'c0000000-0000-0000-0000-000000000005', current_date + 3, 'shut_in', now() - interval '4 hours'),
  ('d0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000010', null, 'normal', false, null, null,
   'First-time guest, second visit this month.', '{text}', 'Text',
   'Invite to Become a Member class; share Plan Your Visit.', null, 'medium', 'c0000000-0000-0000-0000-000000000007', current_date + 2, null, now() - interval '3 hours'),
  ('d0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000011', 'The Williams family', 'normal', false, null, null,
   'Life event shared in portal: new baby born Nov 5.', '{email,card}', 'Email + Card',
   'Celebration note from the pastor; Baby Dedication sign-up.', null, 'high', 'c0000000-0000-0000-0000-000000000009', current_date + 3, 'birth', now() - interval '2 days');

insert into tasks (case_id, person_id, title, subtitle, instructions, task_type, assignee_team_id, due_on, status, sensitive) values
  ('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Pastoral text and call', 'Check in; offer prayer',
   'Check in on Kevin and the family. Offer prayer. No questions about finances.', 'call', 'c0000000-0000-0000-0000-000000000001', current_date, 'due', true),
  ('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Benevolence intake', 'Holiday Assistance and Food Pantry eligibility',
   'Groceries and Free Holiday Assistance requested. Family of 4.', 'intake', 'c0000000-0000-0000-0000-000000000006', current_date + 4, 'scheduled', true),
  ('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Counseling referral', 'Only if Kevin agrees',
   null, 'referral', 'c0000000-0000-0000-0000-000000000010', current_date + 6, 'scheduled', true),
  (null, 'a0000000-0000-0000-0000-000000000019', 'Hospital visit · Henry Ford', null,
   'Room 412. Bring the prayer cloth from Sunday service.', 'visit', 'c0000000-0000-0000-0000-000000000001', current_date + 1, 'scheduled', false),
  ('d0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000011', 'Drop off baby card and gift', null,
   'Gift bag is at the Detroit welcome desk.', 'visit', 'c0000000-0000-0000-0000-000000000001', current_date + 3, 'scheduled', false),
  ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'Pastor visit and call', null, null, 'visit', 'c0000000-0000-0000-0000-000000000009', current_date, 'due', true),
  ('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000004', 'Hospital visit or call', null, null, 'visit', 'c0000000-0000-0000-0000-000000000004', current_date, 'due', true),
  ('d0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000005', 'Wellness call', null, 'Offer a ride or a home visit.', 'call', 'c0000000-0000-0000-0000-000000000002', current_date, 'due', false),
  ('d0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000006', 'Check-in call', null, 'No ask. Just checking in.', 'call', 'c0000000-0000-0000-0000-000000000003', current_date + 1, 'scheduled', false),
  ('d0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000008', 'Care call', null, 'Never about giving. Listen for hardship.', 'call', 'c0000000-0000-0000-0000-000000000003', current_date + 1, 'scheduled', true),
  ('d0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000009', 'Home visit with Communion', null, 'Check livestream setup.', 'visit', 'c0000000-0000-0000-0000-000000000005', current_date + 3, 'scheduled', false),
  ('d0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000010', 'Invite to Become a Member class', null, null, 'text', 'c0000000-0000-0000-0000-000000000007', current_date + 2, 'scheduled', false),
  -- unassigned, waiting for a match
  (null, 'a0000000-0000-0000-0000-000000000016', 'Hospital visit', 'Knee surgery', 'Pre-op prayer call, then a hospital visit.', 'visit', null, current_date + 4, 'scheduled', false),
  ('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Job-network coffee', null,
   'Invite Kevin to coffee this week. Listen first; ask about job leads he''d welcome from the men''s network.', 'coffee', null, current_date + 3, 'scheduled', true);

insert into signals (person_id, kind, summary, source, severity, occurred_at) values
  ('a0000000-0000-0000-0000-000000000001', 'flagged', 'Flagged: urgent care need', 'Care engine · check-in drop + absence', 'urgent', now()),
  ('a0000000-0000-0000-0000-000000000001', 'checkin_low', 'Weekly check-in: Very hard. "Lost my job."', 'Member portal check-in', 'urgent', current_date - 2),
  ('a0000000-0000-0000-0000-000000000001', 'missed_attendance', 'Missed Tuesday Bible Study', 'OneChurch attendance', 'high', current_date - 5),
  ('a0000000-0000-0000-0000-000000000001', 'missed_attendance', 'Missed Sunday 10 AM service', 'OneChurch attendance', 'high', current_date - 7),
  ('a0000000-0000-0000-0000-000000000001', 'touch', 'Text from Dcn. Hayes; Kevin replied', 'Outreach log', 'normal', current_date - 19),
  ('a0000000-0000-0000-0000-000000000001', 'checkin_low', 'Weekly check-in: Good', 'Member portal check-in', 'normal', current_date - 23);

-- Kevin's own requests (member portal "My requests")
insert into care_requests (person_id, kind, topic, body, visibility, wants_call, status, case_id, created_at) values
  ('a0000000-0000-0000-0000-000000000001', 'prayer', 'Work & finances', 'Please pray for my family as I look for work. It''s been a hard few weeks.', 'pastors', true, 'in_progress', 'd0000000-0000-0000-0000-000000000003', current_date - 2),
  ('a0000000-0000-0000-0000-000000000001', 'practical', null, 'Family of 4. Lost my job Oct 30.', 'pastors', false, 'approved', 'd0000000-0000-0000-0000-000000000003', current_date - 2);
update care_requests set items = '{groceries,holiday}', contact_pref = 'text', team_id = 'c0000000-0000-0000-0000-000000000006' where kind = 'practical';

insert into life_moments (person_id, type, moment_date, who, source, status, created_at) values
  ('a0000000-0000-0000-0000-000000000001', 'birth', current_date - 37, 'Our family', 'portal', 'celebrated', current_date - 37),
  ('a0000000-0000-0000-0000-000000000011', 'birth', current_date - 3, 'Our family', 'portal', 'open', current_date - 3),
  ('a0000000-0000-0000-0000-000000000003', 'bereavement', current_date - 2, 'Father', 'care_request', 'open', current_date - 2),
  ('a0000000-0000-0000-0000-000000000004', 'sickness', current_date - 2, 'Mother', 'portal', 'open', current_date - 2),
  ('a0000000-0000-0000-0000-000000000012', 'bereavement', current_date + 1 - 365, 'Husband', 'care_request', 'closed', current_date - 365),
  ('a0000000-0000-0000-0000-000000000013', 'anniversary', current_date + 2 - interval '25 years', 'James & Carla', 'onechurch_profile', 'open', now()),
  ('a0000000-0000-0000-0000-000000000015', 'promotion', current_date + 3, 'Nurse manager', 'portal', 'open', now()),
  ('a0000000-0000-0000-0000-000000000016', 'sickness', current_date + 4, 'Knee surgery', 'portal', 'open', now()),
  ('a0000000-0000-0000-0000-000000000017', 'work_anniversary', current_date + 5 - interval '20 years', '20 years at her job', 'onechurch_profile', 'open', now()),
  ('a0000000-0000-0000-0000-000000000018', 'shut_in', current_date + 6, 'Turning 90', 'onechurch_profile', 'open', now());
update life_moments set remind_yearly = true where type in ('bereavement', 'anniversary', 'work_anniversary');
update life_moments set case_id = 'd0000000-0000-0000-0000-000000000009' where person_id = 'a0000000-0000-0000-0000-000000000011' and type = 'birth';
update life_moments set case_id = 'd0000000-0000-0000-0000-000000000001' where person_id = 'a0000000-0000-0000-0000-000000000003' and type = 'bereavement';
update life_moments set case_id = 'd0000000-0000-0000-0000-000000000002' where person_id = 'a0000000-0000-0000-0000-000000000004' and type = 'sickness';

-- ─── History for Insights (last 6 months) ───────────────────────────────────
with filler as (
  select id, campus_id, row_number() over (order by oc_person_id) rn from people where oc_person_id >= 1000
)
insert into care_cases (person_id, status, urgency, why_flagged, action_title, action_channels, owner_team_id, opened_at, first_touch_at, closed_at, moment_type)
select f.id, 'closed',
       (array['urgent','high','normal','normal']::urgency[])[1 + (g % 4)],
       (array['Missed 3 Sundays','Low weekly check-in','Hospital stay','Practical help request','New baby','Bereavement','Shut-in visit due','Giving pattern change'])[1 + (g % 8)],
       'Call', '{call}',
       case f.campus_id when 'detroit' then 'c0000000-0000-0000-0000-000000000001'::uuid
                        when 'global' then 'c0000000-0000-0000-0000-000000000002'::uuid
                        when 'atlanta' then 'c0000000-0000-0000-0000-000000000007'::uuid
                        else 'c0000000-0000-0000-0000-000000000003'::uuid end,
       ts,
       ts + case f.campus_id when 'detroit' then interval '31 hours' when 'global' then interval '12 hours' when 'atlanta' then interval '7 hours' else interval '5 hours' end,
       case when g % 9 = 0 then ts + interval '5 days' else ts + interval '40 hours' end,
       (array['other','other','sickness','other','birth','bereavement','shut_in','other']::moment_type[])[1 + (g % 8)]
from generate_series(1, 520) g
join filler f on f.rn = 1 + (g % 140)
cross join lateral (select now() - ((g * 8 % 180) || ' days')::interval as ts) t;

insert into touches (person_id, channel, outcome, summary, occurred_at)
select f.id,
       (array['text','text','text','call','call','visit','app','email','email'])[1 + g % 9]::channel,
       case (array['text','text','text','call','call','visit','app','email','email'])[1 + g % 9]
         when 'text' then case when g % 100 < 78 then 'reached' else 'left_message' end
         when 'call' then case when g % 100 < 64 then 'reached' else 'left_message' end
         when 'visit' then case when g % 100 < 92 then 'reached' else 'left_message' end
         when 'app' then case when g % 100 < 51 then 'reached' else 'left_message' end
         else case when g % 100 < 22 then 'reached' else 'left_message' end
       end::task_outcome,
       'Care touch', now() - ((g * 13 % 88) || ' days')::interval
from generate_series(1, 418) g
join (select id, row_number() over (order by oc_person_id) rn from people where oc_person_id >= 1000) f on f.rn = 1 + (g % 140);

insert into checkins (person_id, score, created_at)
select p.id, 2 + ((p.oc_person_id + w) % 4), now() - (w * 7 || ' days')::interval
from people p cross join generate_series(0, 5) w
where p.oc_person_id >= 1000 and p.oc_person_id % 10 < 7;

insert into care_ratings (person_id, rating)
select id, case when oc_person_id % 5 = 0 then 4 else 5 end from people where oc_person_id between 1000 and 1060;

-- ─── Sync health + match reviews ────────────────────────────────────────────
insert into oc_webhook_events (event, payload, received_at, status, http_status, summary) values
  ('person_updated', '{}', now() - interval '2 minutes', 'processed', 200, 'Ortiz, Kevin · new mobile number'),
  ('form_entry_submitted', '{}', now() - interval '31 minutes', 'processed', 200, 'Prayer form → task for Care Team East'),
  ('contribution_created', '{}', now() - interval '45 minutes', 'processed', 200, 'Pattern updated; amount discarded'),
  ('reconcile', '{}', date_trunc('day', now()) + interval '2 hours', 'processed', 429, 'Rate limited; resumed after Retry-After (8 sec)');

-- ─── Demo logins ────────────────────────────────────────────────────────────
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
       crypt('kamcare-demo', gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
from (values
  ('e0000000-0000-0000-0000-000000000001'::uuid, 'pastor@kam.test'),
  ('e0000000-0000-0000-0000-000000000002'::uuid, 'staff@kam.test'),
  ('e0000000-0000-0000-0000-000000000003'::uuid, 'hayes@kam.test'),
  ('e0000000-0000-0000-0000-000000000004'::uuid, 'kevin@kam.test')
) as u(id, email);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, id::text, jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true), 'email', now(), now(), now()
from auth.users where email like '%@kam.test';

update profiles set person_id = 'a0000000-0000-0000-0000-000000000105', role = 'pastor', is_admin = true, match_status = 'matched', campus_id = 'indianapolis'
  where user_id = 'e0000000-0000-0000-0000-000000000001';
update profiles set person_id = 'a0000000-0000-0000-0000-000000000106', role = 'staff', match_status = 'matched', campus_id = 'indianapolis'
  where user_id = 'e0000000-0000-0000-0000-000000000002';
update profiles set person_id = 'a0000000-0000-0000-0000-000000000101', role = 'care_leader', match_status = 'matched', campus_id = 'detroit'
  where user_id = 'e0000000-0000-0000-0000-000000000003';
update profiles set person_id = 'a0000000-0000-0000-0000-000000000001', role = 'member', match_status = 'matched', campus_id = 'detroit'
  where user_id = 'e0000000-0000-0000-0000-000000000004';

insert into match_reviews (user_id, label, reason) values
  ('e0000000-0000-0000-0000-000000000004', 'D. & L. Grant', 'Shared family email matches 2 people'),
  ('e0000000-0000-0000-0000-000000000004', 'Marcus T.', 'Signed in with Facebook; no email or mobile match'),
  ('e0000000-0000-0000-0000-000000000004', 'A. Simmons', 'Mobile number matches 2 records');
