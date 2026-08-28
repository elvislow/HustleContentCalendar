# Content Flow

A Vercel-ready, multi-brand content calendar for **hustle.** and **The Second Studio**, with Supabase cloud sync, admin-managed email/password accounts, team roles and realtime updates.

The Insights view aggregates Views, Likes, Shares, Saves and Follows by content publish date. It supports Last week, Last month, custom ranges, automatic previous-period comparison, percentage change and visual trend charts. Follows are stored inside the existing `platform_data` JSON, so no database migration is required.

## One-time Supabase setup

1. Open your Supabase project.
2. Go to **SQL Editor**, open `supabase/setup.sql` from this repository, and run the entire file once.
3. Go to **Authentication → Sign In / Providers → Email**, confirm Email is enabled, and turn off public new-user signups if that option is shown.
4. Go to **Authentication → Users → Add user → Create new user**.
5. Create `elvis@hustle.com.sg` with a temporary password and turn on **Auto Confirm User**.

Sign in with that email and temporary password. The first approved admin is `elvis@hustle.com.sg`; it can open **Admin settings** and approve more emails as Admin, Editor or Viewer.

## Add another team member

1. In Content Flow, open **Admin settings** and approve the person's email and role.
2. In Supabase, go to **Authentication → Users → Add user → Create new user**.
3. Create the same email with a temporary password and turn on **Auto Confirm User**.
4. Give the temporary password to the person securely.
5. After signing in, the person can open their account menu and choose a new password.

This flow does not send login emails and is not affected by Supabase email rate limits.

## Deploy

Upload the contents of this folder to the root of your GitHub repository. Vercel can deploy it with the default Next.js settings.

## Existing device data

After the first cloud login, Content Flow detects older browser-only records and offers an **Import to cloud** button. The cloud database becomes the source of truth after import.
