-- Reference data that ships to every environment.
-- Set oc_location_id for each campus to the matching OneChurch location id after connecting.

insert into campuses (id, name, sort) values
  ('indianapolis', 'Indianapolis', 1),
  ('detroit', 'Detroit', 2),
  ('atlanta', 'Atlanta', 3),
  ('global', 'Global', 4)
on conflict (id) do nothing;

-- Each life moment comes with its own care playbook.
-- offset_days is relative to the moment date; team_slug is resolved when tasks are created
-- (null = the person's primary care team, falling back to the pastoral office).
insert into playbooks (moment_type, label, summary, urgency, sensitive, action_channels, action_title, steps) values
  ('bereavement', 'Bereavement', 'Pastor call within 24h, Funerals ministry, grief follow-ups at 30/90/365 days',
    'urgent', true, '{visit,call}', 'Visit + Call',
    '[{"offset_days":0,"title":"Pastor visit and call","task_type":"visit","team_slug":"pastoral-office"},
      {"offset_days":0,"title":"Connect Funerals ministry","task_type":"call","team_slug":"pastoral-office"},
      {"offset_days":30,"title":"Grief follow-up · 30 days","task_type":"call"},
      {"offset_days":90,"title":"Grief follow-up · 90 days","task_type":"call"},
      {"offset_days":365,"title":"Grief follow-up · 1 year","task_type":"call","team_slug":"pastoral-office"}]'),
  ('sickness', 'Sickness & hospital', 'Visit or call, prayer team, meal train',
    'urgent', true, '{visit,call}', 'Visit + Call',
    '[{"offset_days":0,"title":"Hospital visit or call","task_type":"visit"},
      {"offset_days":0,"title":"Add to prayer team list","task_type":"call","team_slug":"care-team-east"},
      {"offset_days":1,"title":"Start a meal train","task_type":"call"}]'),
  ('shut_in', 'Shut-ins', 'Monthly visit, Communion, livestream help',
    'high', false, '{visit}', 'Visit',
    '[{"offset_days":0,"title":"Home visit with Communion","task_type":"visit","team_slug":"shut-in-team"}]'),
  ('birth', 'Births', 'Card and gift, Baby Dedication invite',
    'normal', false, '{email,card}', 'Email + Card',
    '[{"offset_days":0,"title":"Celebration note from the pastor","task_type":"card","team_slug":"pastoral-office"},
      {"offset_days":2,"title":"Drop off baby card and gift","task_type":"visit"},
      {"offset_days":7,"title":"Baby Dedication invite","task_type":"text"}]'),
  ('wedding', 'Weddings', 'Note from the pastor, marriage ministry intro',
    'normal', false, '{card}', 'Card',
    '[{"offset_days":0,"title":"Note from the pastor","task_type":"card","team_slug":"pastoral-office"},
      {"offset_days":14,"title":"Marriage ministry intro","task_type":"text"}]'),
  ('anniversary', 'Wedding anniversaries', 'Text from the pastor on the date; e-card for 10, 25, 50 years',
    'normal', false, '{text}', 'Text',
    '[{"offset_days":0,"title":"Anniversary text from the pastor","task_type":"text","team_slug":"pastoral-office"}]'),
  ('promotion', 'Promotions & new jobs', 'Congratulate, invite to mentor or serve',
    'normal', false, '{text}', 'Text',
    '[{"offset_days":0,"title":"Congratulations text","task_type":"text"}]'),
  ('award', 'Awards & graduations', 'Card; Sunday shout-out only with permission',
    'normal', false, '{card}', 'Card',
    '[{"offset_days":0,"title":"Congratulations card","task_type":"card"}]'),
  ('work_anniversary', 'Work anniversaries', 'Encouragement text on the date',
    'normal', false, '{text}', 'Text',
    '[{"offset_days":0,"title":"Encouragement text","task_type":"text"}]'),
  ('job_loss', 'Job loss', 'Pastoral text now, then a call; benevolence intake; counseling only if wanted',
    'urgent', true, '{text,call}', 'Text, then Call',
    '[{"offset_days":0,"title":"Pastoral text and call","task_type":"call"},
      {"offset_days":4,"title":"Benevolence intake","task_type":"intake","team_slug":"benevolence-team"},
      {"offset_days":6,"title":"Counseling referral","task_type":"referral","team_slug":"counseling-services"}]'),
  ('moved', 'Moved or new home', 'Welcome note; update campus if needed',
    'normal', false, '{text}', 'Text',
    '[{"offset_days":0,"title":"New home note","task_type":"text"}]'),
  ('birthday', 'Birthdays', 'Birthday text',
    'normal', false, '{text}', 'Text',
    '[{"offset_days":0,"title":"Birthday text","task_type":"text"}]'),
  ('other', 'Something else', 'Read and route',
    'normal', false, '{call}', 'Call',
    '[{"offset_days":0,"title":"Check-in call","task_type":"call"}]')
on conflict (moment_type) do nothing;

insert into message_templates (name, channel, moment_type, body) values
  ('Gentle check-in', 'text', null,
   'Hey {first_name}, it''s {sender}. You''ve been on my heart this week. No agenda, just want to see how you and the family are holding up.'),
  ('Missed you Sunday', 'text', null,
   'Hi {first_name}, it''s {sender} from KAM. We missed you Sunday. No pressure at all, just wanted you to know you''re thought of.'),
  ('Wedding anniversary', 'text', 'anniversary',
   'Happy anniversary, {first_name}! Your KAM family is celebrating {years} years with you today.'),
  ('Congratulations', 'text', 'promotion',
   'Congratulations, {first_name}! We heard the good news and we''re celebrating with you.'),
  ('Work anniversary', 'text', 'work_anniversary',
   '{first_name}, {years} years of faithful work. Proud of you and praying for the season ahead.'),
  ('New baby', 'email', 'birth',
   'Dear {first_name}, congratulations on your new arrival! We would love to celebrate with you at an upcoming Baby Dedication.'),
  ('First-time giver thank you', 'text', null,
   'Hi {first_name}, it''s {sender}. Thank you for partnering with KAM. It means more than you know.'),
  ('Grief follow-up', 'text', 'bereavement',
   '{first_name}, we''re still thinking of you and your family. Would a call or visit this week be welcome?')
on conflict do nothing;

insert into app_settings (key, value) values
  ('write_back_to_onechurch', 'true'),
  ('first_touch_goal_hours', '24'),
  ('escalate_after_hours', '48'),
  ('attendance_missed_sundays_threshold', '3'),
  ('livestream_absent_weeks_threshold', '3'),
  ('shut_in_visit_interval_days', '30')
on conflict (key) do nothing;
