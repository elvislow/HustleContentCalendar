# Content Flow

A Vercel-ready, multi-brand content calendar for **hustle.** and **The Second Studio**, with Supabase cloud sync, passwordless email login, optional Google login, team roles and realtime updates.

## One-time Supabase setup

1. Open your Supabase project.
2. Go to **SQL Editor**, open `supabase/setup.sql` from this repository, and run the entire file once.
3. Go to **Authentication → Sign In / Providers → Email** and confirm Email is enabled. No password or Google credentials are required.
4. In **Authentication → URL Configuration**:
   - Set **Site URL** to your production Vercel URL.
   - Add your Vercel production URL and `http://localhost:3000` to Redirect URLs.

The first approved admin is `elvis@hustle.com.sg`. Enter that address on the login page, then open the secure link sent by Supabase. After signing in, the account can open **Admin settings** and approve more emails as Admin, Editor or Viewer.

## Optional Google login

The Google button can remain as an optional second login method. It only works after Google is enabled in **Authentication → Sign In / Providers → Google** and its OAuth Client ID and Client Secret are saved. Email magic links work without this setup.

## Deploy

Upload the contents of this folder to the root of your GitHub repository. Vercel can deploy it with the default Next.js settings.

## Existing device data

After the first cloud login, Content Flow detects older browser-only records and offers an **Import to cloud** button. The cloud database becomes the source of truth after import.
