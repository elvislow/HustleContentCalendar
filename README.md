# Content Flow

A Vercel-ready, multi-brand content calendar for **hustle.** and **The Second Studio**, with Supabase cloud sync, Google login, team roles and realtime updates.

## One-time Supabase setup

1. Open your Supabase project.
2. Go to **SQL Editor**, open `supabase/setup.sql` from this repository, and run the entire file once.
3. Go to **Authentication → Providers → Google** and enable Google.
4. In Google Cloud Console, create a Web OAuth client and add this Authorized redirect URI:

   `https://akbwzlkavuznkwreeerh.supabase.co/auth/v1/callback`

5. Paste the Google Client ID and Client Secret into the Supabase Google provider settings.
6. In **Authentication → URL Configuration**:
   - Set **Site URL** to your production Vercel URL.
   - Add your Vercel production URL and `http://localhost:3000` to Redirect URLs.

The first approved admin is `elvis@hustle.com.sg`. After signing in, that account can open **Admin settings** and approve more Google emails as Admin, Editor or Viewer.

## Deploy

Upload the contents of this folder to the root of your GitHub repository. Vercel can deploy it with the default Next.js settings.

## Existing device data

After the first cloud login, Content Flow detects older browser-only records and offers an **Import to cloud** button. The cloud database becomes the source of truth after import.
