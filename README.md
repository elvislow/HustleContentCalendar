# Content Flow

A Vercel-ready, multi-brand content calendar for **hustle.** and **The Second Studio**, with Supabase cloud sync, admin-managed email/password accounts, team roles and realtime updates.

The Insights view aggregates Views, Likes, Shares, Saves and Follows by content publish date. It supports Last week, Last month, custom ranges, automatic previous-period comparison, percentage change and visual trend charts. Follows are stored inside the existing `platform_data` JSON, so no database migration is required.

The Audience view stores monthly data for each brand and platform and saves changes automatically. Weekly rows accept account-level Total Follows and Unfollows and calculate Net Growth. Cumulative Content-attributed Follows are shown separately in a monthly post ranking and are never subtracted from account-level growth. The view also calculates follower growth, profile and link conversion, compares the previous month and produces automatic monthly observations.

## One-time Supabase setup

1. Open your Supabase project.
2. Go to **SQL Editor**, open `supabase/setup.sql` from this repository, and run the entire file once.
3. Go to **Authentication → Sign In / Providers → Email**, confirm Email is enabled, and turn off public new-user signups if that option is shown.
4. Go to **Authentication → Users → Add user → Create new user**.
5. Create `elvis@hustle.com.sg` with a temporary password and turn on **Auto Confirm User**.

Sign in with that email and temporary password. The first approved admin is `elvis@hustle.com.sg`; it can open **Admin settings** and approve more emails as Admin, Editor or Viewer.

If this project was already installed before the Audience features were added, run the updated `supabase/setup.sql` once again. It is safe to rerun and creates the `audience_monthly` and `audience_weekly` cloud tables and access policies without removing existing content.

## Add another team member

1. In Content Flow, open **Admin settings** and approve the person's email and role.
2. In Supabase, go to **Authentication → Users → Add user → Create new user**.
3. Create the same email with a temporary password and turn on **Auto Confirm User**.
4. Give the temporary password to the person securely.
5. After signing in, the person can open their account menu and choose a new password.

This flow does not send login emails and is not affected by Supabase email rate limits.

## Enable Admin password resets

The Admin settings page can reset the password of any connected team member. The operation is performed by a protected server route and re-checks the signed-in user's active Admin role before changing anything.

1. In Supabase, open **Project Settings → API Keys**.
2. Create or copy a server-side **Secret key** (`sb_secret_...`). A legacy `service_role` key also works.
3. In Vercel, open the project → **Settings → Environment Variables**.
4. Add `SUPABASE_SECRET_KEY` with the secret key as its value for Production, Preview and Development.
5. Redeploy the project.

Never paste this secret into source code, GitHub, browser code, chat or screenshots. After deployment, an Admin can open **Admin settings → Reset password** beside a connected member.

## Deploy

Upload the contents of this folder to the root of your GitHub repository. Vercel can deploy it with the default Next.js settings.

## Existing device data

After the first cloud login, Content Flow detects older browser-only records and offers an **Import to cloud** button. The cloud database becomes the source of truth after import.
