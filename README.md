# KAM Care

The care platform for pastors, deacons and care leaders across Kingdom Apostolic Ministries
(Indianapolis, Detroit, Atlanta and the Global Campus). Lives at **care.kam.church** and syncs
with **kam.onechurchsoftware.com**.

| Who | Where | What they see |
|---|---|---|
| Pastors & staff | `/admin` | Care queue, members, insights, teams, templates, OneChurch connection |
| Care leaders | `/leader` | Only their own tasks, and only while the task is open |
| Members | `/home` | Weekly check-in, prayer, practical help, life moments, their requests, privacy |

## Stack

- **Next.js 16** (App Router, Cache Components) on **Vercel**
- **Supabase**: Postgres, Auth (Microsoft, Google, Facebook, email + two-step verification), row-level security
- **OneChurch API**: server-side only, API key in Vercel env vars
- **Twilio** (texts) and **Resend** (email), both optional; without them, messages are logged as `not_configured`

```
src/
  app/
    admin/(portal)/      admin portal screens
    admin/login, mfa     staff sign-in and two-step verification
    (member)/            member portal (phone-first)
    leader/              care leader task list
    login/               member sign-in
    auth/callback        OAuth return → OneChurch matching → role home
    api/webhooks/onechurch/[token]/[event]   webhook receiver
    api/cron/*           reconcile, engine, escalate, attendance
  lib/
    onechurch/           API client (rate limited) and sync
    care/engine.ts       signals → cases → tasks, playbooks, escalation, care scores
    auth.ts              viewer, roles, two-step enforcement
    matching.ts          sign-in → OneChurch person
supabase/
  migrations/            schema, row-level security, reference data
  seed.sql               local sample data (mirrors the design mockup)
```

## How privacy is enforced

Rules live in the database (`supabase/migrations/*_security.sql`), so a bug in a page can't leak data.

- **Sensitive matters** marked *Pastors only* are invisible to staff and leaders. Every view is written to `access_log`.
- **Giving**: only a pattern is kept (first gift, lapse, increase, recurring started or stopped). Amounts are read from OneChurch to compute it, then discarded. Only pastors can read patterns, and only for members who opted in. A lapse creates a care call, never a giving ask.
- **Leaders** see a person's name and phone only while they hold an open task for them, and the task text, not the file. They log outcomes through a database function, not direct writes.
- **Members** see only their own records. Their timeline shows friendly steps ("Deacon Hayes called you"), never internal notes.
- **Sensitive matters never leave KAM Care.** Non-sensitive care touches can be written back to OneChurch as private Notes (toggle on the OneChurch connection page).
- **Two-step verification** is required for pastors and staff, and for leaders signing in with a KAM Care password.

## Local development

Requires Docker.

```bash
npm install
npm run db:start      # local Supabase (first run pulls images)
npm run db:reset      # applies migrations + seed
npm run dev           # http://localhost:3000
```

`.env.local` is already set up for the local Supabase. Demo logins (password `kamcare-demo`):

| Email | Role |
|---|---|
| pastor@kam.test | Pastor + admin |
| staff@kam.test | Staff |
| hayes@kam.test | Care leader (Dcn. R. Hayes) |
| kevin@kam.test | Member (Kevin Ortiz) |

Pastor and staff logins will ask you to set up an authenticator app on first sign-in.
Local email (magic links, sign-up confirmations) goes to Mailpit at http://127.0.0.1:54324.

After changing a migration: `npm run db:reset && npm run db:types`.

## Deploying to care.kam.church

### 1. Supabase (Pro)

1. Create a project (US East, to sit near Vercel `iad1`).
2. Link and push the schema. Don't run `seed.sql` against production.
   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```
3. **Authentication → URL Configuration**: Site URL `https://care.kam.church`; redirect URLs `https://care.kam.church/auth/callback` (add your Vercel preview URL pattern too).
4. **Authentication → Sign In / Providers**:
   - **Azure (Microsoft)**: app registration in Entra ID for the kam.church tenant; redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`.
   - **Google**: OAuth client in Google Cloud; same redirect URI.
   - **Facebook**: member portal only; same redirect URI.
   - **Apple**: member portal only. Services ID + Sign in with Apple key in the Apple Developer account; return URL `https://<project-ref>.supabase.co/auth/v1/callback`. The secret Apple issues expires every 6 months, so regenerate it before then.

   Sign-in buttons appear on their own once a provider is switched on (checked about once a minute).
   - **Email**: on, with "Confirm email" on.
5. **Authentication → Multi-Factor**: enable TOTP (authenticator app). WebAuthn passkeys can be turned on there too.
6. **Authentication → Emails → SMTP**: use Resend (or similar) so sign-in emails come from `care@kam.church`.

### 2. Vercel (Pro)

1. Import this repo. Framework preset: Next.js.
2. Add the environment variables from `.env.example` (Production and Preview). Generate the two secrets with `openssl rand -hex 32`.
3. **Domains**: add `care.kam.church`, then at the DNS host for kam.church add `CNAME care → cname.vercel-dns.com`.
4. Deploy. The cron jobs in `vercel.json` register automatically:
   - `reconcile` at 2 AM Eastern: people, roles, giving patterns
   - `engine` at 6 AM Eastern: milestones, missed Sundays, shut-in visits, care scores
   - `escalate` hourly: due-task texts, 48-hour escalation
   - `attendance` every 30 minutes: attendance in slices of 250 people

### 3. OneChurch

API and webhooks require the **Core Plus or Premium** plan.

1. **Settings & Tools → API / Webhooks → API Keys → Add New**. Name: `KAM Care backend`. Access: **Custom**, never Super User:

   | Section | Tick only |
   |---|---|
   | Account Settings | nothing |
   | People | Limited Read People, Full Read Connections, Write Notes |
   | Groups | Full Read Groups |
   | Other | API |
   | Giving / Contributions | Limited Read Contributions |
   | Events / Check-In | read attendance |
   | Forms | Full Read Forms |

   Leave everything else off, including any write, delete, merge, import, safeguards, files and billing permission.
   Under the key's **Campuses** tab, select all four campuses.

   Put the key in Vercel as `ONECHURCH_API_KEY` and redeploy. Rotate every 90 days.
2. Sign in as an admin → **OneChurch connection** → **Test connection**, then **Register webhooks**. KAM Care subscribes one URL per event (`/api/webhooks/onechurch/<token>/<event>`).
3. Click **Run full reconcile** to import people, households and giving patterns.
4. Map OneChurch to KAM Care (SQL editor, or the screens noted):
   ```sql
   -- campuses: OneChurch location ids
   update campuses set oc_location_id = <id> where id = 'indianapolis';  -- repeat per campus
   -- which OneChurch groups grant which role (also editable on Signals & consent)
   insert into role_mappings (oc_group_id, group_name, role, grants_admin) values
     (<id>, 'Pastoral Staff', 'pastor', false),
     (<id>, 'Church Staff', 'staff', false),
     (<id>, 'Care Deacons', 'care_leader', false),
     (<id>, 'IT Admins', 'staff', true);
   -- website prayer/care forms that should create care tasks (empty = all forms)
   insert into app_settings (key, value) values ('care_form_ids', '[<formId>, <formId>]')
     on conflict (key) do update set value = excluded.value;
   ```
5. Create care teams on **Care teams** (or link a team to a OneChurch group so membership syncs).

### First admin

Nobody has a role until OneChurch says so. To bootstrap before role mappings exist, sign in once, then run:

```sql
update profiles set role = 'pastor', is_admin = true, role_source = 'manual'
where user_id = (select id from auth.users where email = 'you@kam.church');
```

## Needs a test with KAM's own OneChurch account

These follow OneChurch's public API reference. Confirm them with real data:

- **Webhook payload shape.** OneChurch doesn't document it, and deliveries aren't signed yet. KAM Care only takes the record id from the payload (it looks in common places) and re-fetches the record from the API. Check the first deliveries on the OneChurch connection page.
- **Attendance**: event and category names are matched against keywords (`sunday`, `worship`, `bible study`…). Adjust with the `attendance_event_keywords` setting.
- **Livestream** (Global Campus) isn't in OneChurch. It needs the streaming platform's export or API. Until then, Global Campus attendance comes from OneChurch check-ins only.
- **Life dates**: birthday and anniversary come from People. Work anniversaries and shut-in status need their Custom Field ids.
- **Notes write-back**: confirm the `private` privacy level and note type.

## Not built yet

- Reading social media (member-connected or KAM pages). The consent switch and UI copy exist; the connector doesn't.
- Inbound texts (replying to the weekly check-in by SMS). Outbound texts work once Twilio is configured.
