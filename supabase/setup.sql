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
  brand text not null check (brand in ('hustle', 'second-studio')),
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

alter table public.members enable row level security;
alter table public.invites enable row level security;
alter table public.content_entries enable row level security;

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

grant usage on schema public to authenticated;
grant select, update, delete on public.members to authenticated;
grant select, insert, update, delete on public.invites to authenticated;
grant select, insert, update, delete on public.content_entries to authenticated;
revoke execute on function public.bootstrap_member() from public, anon;
revoke execute on function public.current_member_role() from public, anon;
grant execute on function public.bootstrap_member() to authenticated;
grant execute on function public.current_member_role() to authenticated;

-- Include the deleted row's brand so filtered realtime listeners also receive deletes.
alter table public.content_entries replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'content_entries'
  ) then
    alter publication supabase_realtime add table public.content_entries;
  end if;
end $$;
