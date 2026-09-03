-- Run this entire file once in Supabase Dashboard → SQL Editor.

create table if not exists public.members (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  role text not null check (role in ('admin', 'editor', 'viewer')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists public.invites (
  email text primary key,
  role text not null check (role in ('admin', 'editor', 'viewer')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists public.content_entries (
  id uuid primary key,
  brand text not null check (brand in ('hustle', 'second-studio', 'pots-pans')),
  publish_date date not null,
  publish_hour text not null,
  publish_minute text not null,
  title text not null,
  platforms jsonb not null default '[]'::jsonb,
  reference_url text not null default '',
  filmed boolean not null default false,
  edited boolean not null default false,
  platform_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create index if not exists content_entries_brand_date_idx
  on public.content_entries (brand, publish_date);

create table if not exists public.audience_monthly (
  id uuid primary key default gen_random_uuid(),
  brand text not null check (brand in ('hustle', 'second-studio', 'pots-pans')),
  platform text not null check (platform in ('IG', 'YouTube', 'Lemon8', 'TikTok', 'FB')),
  month_key date not null,
  starting_followers bigint not null default 0 check (starting_followers >= 0),
  ending_followers bigint not null default 0 check (ending_followers >= 0),
  reach bigint not null default 0 check (reach >= 0),
  profile_visits bigint not null default 0 check (profile_visits >= 0),
  link_clicks bigint not null default 0 check (link_clicks >= 0),
  non_follower_reach_pct numeric(5,2) not null default 0 check (non_follower_reach_pct between 0 and 100),
  women_pct numeric(5,2) not null default 0 check (women_pct between 0 and 100),
  men_pct numeric(5,2) not null default 0 check (men_pct between 0 and 100),
  primary_age text not null default '',
  top_locations text not null default '',
  active_day text not null default '',
  active_time text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  unique (brand, platform, month_key)
);

create index if not exists audience_monthly_brand_month_idx
  on public.audience_monthly (brand, month_key);

create table if not exists public.audience_weekly (
  id uuid primary key default gen_random_uuid(),
  brand text not null check (brand in ('hustle', 'second-studio', 'pots-pans')),
  platform text not null check (platform in ('IG', 'YouTube', 'Lemon8', 'TikTok', 'FB')),
  month_key date not null,
  week_index integer not null check (week_index between 1 and 5),
  total_follows bigint not null default 0 check (total_follows >= 0),
  unfollows bigint not null default 0 check (unfollows >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  unique (brand, platform, month_key, week_index)
);

create index if not exists audience_weekly_brand_month_idx
  on public.audience_weekly (brand, month_key, platform);

create table if not exists public.lemon8_weekly_performance (
  id uuid primary key default gen_random_uuid(),
  brand text not null check (brand in ('hustle', 'second-studio', 'pots-pans')),
  week_start date not null,
  reads bigint not null default 0 check (reads >= 0),
  likes_and_saves bigint not null default 0 check (likes_and_saves >= 0),
  follows bigint not null default 0 check (follows >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  unique (brand, week_start)
);

-- Safe upgrade for projects that created the earlier weekly table version.
alter table public.lemon8_weekly_performance
  add column if not exists likes_and_saves bigint not null default 0 check (likes_and_saves >= 0),
  add column if not exists follows bigint not null default 0 check (follows >= 0);

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lemon8_weekly_performance' and column_name = 'likes')
     and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lemon8_weekly_performance' and column_name = 'saves') then
    execute 'update public.lemon8_weekly_performance set likes_and_saves = likes + saves where likes_and_saves = 0';
  end if;
end $$;

create index if not exists lemon8_weekly_brand_week_idx
  on public.lemon8_weekly_performance (brand, week_start);

-- Safe upgrade: allow the third brand on existing installations.
alter table public.content_entries drop constraint if exists content_entries_brand_check;
alter table public.content_entries add constraint content_entries_brand_check check (brand in ('hustle', 'second-studio', 'pots-pans'));
alter table public.audience_monthly drop constraint if exists audience_monthly_brand_check;
alter table public.audience_monthly add constraint audience_monthly_brand_check check (brand in ('hustle', 'second-studio', 'pots-pans'));
alter table public.audience_weekly drop constraint if exists audience_weekly_brand_check;
alter table public.audience_weekly add constraint audience_weekly_brand_check check (brand in ('hustle', 'second-studio', 'pots-pans'));
alter table public.lemon8_weekly_performance drop constraint if exists lemon8_weekly_performance_brand_check;
alter table public.lemon8_weekly_performance add constraint lemon8_weekly_performance_brand_check check (brand in ('hustle', 'second-studio', 'pots-pans'));

-- Safe upgrade: Facebook is available for Pots & Pans audience reporting.
alter table public.audience_monthly drop constraint if exists audience_monthly_platform_check;
alter table public.audience_monthly add constraint audience_monthly_platform_check check (platform in ('IG', 'YouTube', 'Lemon8', 'TikTok', 'FB'));
alter table public.audience_weekly drop constraint if exists audience_weekly_platform_check;
alter table public.audience_weekly add constraint audience_weekly_platform_check check (platform in ('IG', 'YouTube', 'Lemon8', 'TikTok', 'FB'));

alter table public.members enable row level security;
alter table public.invites enable row level security;
alter table public.content_entries enable row level security;
alter table public.audience_monthly enable row level security;
alter table public.audience_weekly enable row level security;
alter table public.lemon8_weekly_performance enable row level security;

create or replace function public.current_member_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.members
  where id = auth.uid() and status = 'active'
  limit 1;
$$;

create or replace function public.bootstrap_member()
returns public.members
language plpgsql
security definer
set search_path = public
as $$
declare
  user_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  invited public.invites;
  result public.members;
begin
  if auth.uid() is null or user_email = '' then
    raise exception 'Authentication required';
  end if;

  select * into result from public.members where id = auth.uid();
  if found then return result; end if;

  if user_email = 'elvis@hustle.com.sg' then
    insert into public.members (id, email, role, status, created_by)
    values (auth.uid(), user_email, 'admin', 'active', auth.uid())
    on conflict (id) do update set status = 'active'
    returning * into result;
    return result;
  end if;

  select * into invited from public.invites
  where email = user_email and status = 'active';
  if not found then raise exception 'This email has not been invited'; end if;

  insert into public.members (id, email, role, status, created_by)
  values (auth.uid(), user_email, invited.role, 'active', invited.created_by)
  on conflict (id) do update set role = excluded.role, status = 'active'
  returning * into result;
  return result;
end;
$$;

create or replace function public.protect_last_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role = 'admin' and old.status = 'active' then
    if tg_op = 'DELETE' and (select count(*) from public.members where role = 'admin' and status = 'active') <= 1 then
      raise exception 'The final active admin cannot be removed';
    end if;
    if tg_op = 'UPDATE' and (new.role <> 'admin' or new.status <> 'active')
       and (select count(*) from public.members where role = 'admin' and status = 'active') <= 1 then
      raise exception 'The final active admin cannot be removed';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists protect_last_admin_trigger on public.members;
create trigger protect_last_admin_trigger
before update or delete on public.members
for each row execute function public.protect_last_admin();

drop policy if exists "members read" on public.members;
create policy "members read" on public.members for select to authenticated
using (id = auth.uid() or public.current_member_role() = 'admin');

drop policy if exists "members admin update" on public.members;
create policy "members admin update" on public.members for update to authenticated
using (public.current_member_role() = 'admin')
with check (public.current_member_role() = 'admin');

drop policy if exists "members admin delete" on public.members;
create policy "members admin delete" on public.members for delete to authenticated
using (public.current_member_role() = 'admin');

drop policy if exists "invites admin read" on public.invites;
create policy "invites admin read" on public.invites for select to authenticated
using (public.current_member_role() = 'admin');

drop policy if exists "invites admin create" on public.invites;
create policy "invites admin create" on public.invites for insert to authenticated
with check (public.current_member_role() = 'admin' and email = lower(email));

drop policy if exists "invites admin update" on public.invites;
create policy "invites admin update" on public.invites for update to authenticated
using (public.current_member_role() = 'admin')
with check (public.current_member_role() = 'admin' and email = lower(email));

drop policy if exists "invites admin delete" on public.invites;
create policy "invites admin delete" on public.invites for delete to authenticated
using (public.current_member_role() = 'admin');

drop policy if exists "entries member read" on public.content_entries;
create policy "entries member read" on public.content_entries for select to authenticated
using (public.current_member_role() in ('admin', 'editor', 'viewer'));

drop policy if exists "entries editor create" on public.content_entries;
create policy "entries editor create" on public.content_entries for insert to authenticated
with check (public.current_member_role() in ('admin', 'editor') and updated_by = auth.uid());

drop policy if exists "entries editor update" on public.content_entries;
create policy "entries editor update" on public.content_entries for update to authenticated
using (public.current_member_role() in ('admin', 'editor'))
with check (public.current_member_role() in ('admin', 'editor') and updated_by = auth.uid());

drop policy if exists "entries editor delete" on public.content_entries;
create policy "entries editor delete" on public.content_entries for delete to authenticated
using (public.current_member_role() in ('admin', 'editor'));

drop policy if exists "audience member read" on public.audience_monthly;
create policy "audience member read" on public.audience_monthly for select to authenticated
using (public.current_member_role() in ('admin', 'editor', 'viewer'));

drop policy if exists "audience editor create" on public.audience_monthly;
create policy "audience editor create" on public.audience_monthly for insert to authenticated
with check (public.current_member_role() in ('admin', 'editor') and updated_by = auth.uid());

drop policy if exists "audience editor update" on public.audience_monthly;
create policy "audience editor update" on public.audience_monthly for update to authenticated
using (public.current_member_role() in ('admin', 'editor'))
with check (public.current_member_role() in ('admin', 'editor') and updated_by = auth.uid());

drop policy if exists "audience editor delete" on public.audience_monthly;
create policy "audience editor delete" on public.audience_monthly for delete to authenticated
using (public.current_member_role() in ('admin', 'editor'));

drop policy if exists "weekly audience member read" on public.audience_weekly;
create policy "weekly audience member read" on public.audience_weekly for select to authenticated
using (public.current_member_role() in ('admin', 'editor', 'viewer'));

drop policy if exists "weekly audience editor create" on public.audience_weekly;
create policy "weekly audience editor create" on public.audience_weekly for insert to authenticated
with check (public.current_member_role() in ('admin', 'editor') and updated_by = auth.uid());

drop policy if exists "weekly audience editor update" on public.audience_weekly;
create policy "weekly audience editor update" on public.audience_weekly for update to authenticated
using (public.current_member_role() in ('admin', 'editor'))
with check (public.current_member_role() in ('admin', 'editor') and updated_by = auth.uid());

drop policy if exists "weekly audience editor delete" on public.audience_weekly;
create policy "weekly audience editor delete" on public.audience_weekly for delete to authenticated
using (public.current_member_role() in ('admin', 'editor'));

drop policy if exists "lemon8 weekly member read" on public.lemon8_weekly_performance;
create policy "lemon8 weekly member read" on public.lemon8_weekly_performance for select to authenticated
using (public.current_member_role() in ('admin', 'editor', 'viewer'));

drop policy if exists "lemon8 weekly editor create" on public.lemon8_weekly_performance;
create policy "lemon8 weekly editor create" on public.lemon8_weekly_performance for insert to authenticated
with check (public.current_member_role() in ('admin', 'editor') and updated_by = auth.uid());

drop policy if exists "lemon8 weekly editor update" on public.lemon8_weekly_performance;
create policy "lemon8 weekly editor update" on public.lemon8_weekly_performance for update to authenticated
using (public.current_member_role() in ('admin', 'editor'))
with check (public.current_member_role() in ('admin', 'editor') and updated_by = auth.uid());

drop policy if exists "lemon8 weekly editor delete" on public.lemon8_weekly_performance;
create policy "lemon8 weekly editor delete" on public.lemon8_weekly_performance for delete to authenticated
using (public.current_member_role() in ('admin', 'editor'));

grant usage on schema public to authenticated;
grant select, update, delete on public.members to authenticated;
grant select, insert, update, delete on public.invites to authenticated;
grant select, insert, update, delete on public.content_entries to authenticated;
grant select, insert, update, delete on public.audience_monthly to authenticated;
grant select, insert, update, delete on public.audience_weekly to authenticated;
grant select, insert, update, delete on public.lemon8_weekly_performance to authenticated;
revoke execute on function public.bootstrap_member() from public, anon;
revoke execute on function public.current_member_role() from public, anon;
grant execute on function public.bootstrap_member() to authenticated;
grant execute on function public.current_member_role() to authenticated;

-- Include the deleted row's brand so filtered realtime listeners also receive deletes.
alter table public.content_entries replica identity full;
alter table public.audience_monthly replica identity full;
alter table public.audience_weekly replica identity full;
alter table public.lemon8_weekly_performance replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'content_entries'
  ) then
    alter publication supabase_realtime add table public.content_entries;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'lemon8_weekly_performance'
  ) then
    alter publication supabase_realtime add table public.lemon8_weekly_performance;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'audience_weekly'
  ) then
    alter publication supabase_realtime add table public.audience_weekly;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'audience_monthly'
  ) then
    alter publication supabase_realtime add table public.audience_monthly;
  end if;
end $$;
