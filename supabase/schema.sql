-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create profiles table if not exists
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

-- Safely update profiles table columns if it already exists
alter table public.profiles drop column if exists name;
alter table public.profiles add column if not exists username text unique;

-- Enable RLS for profiles
alter table public.profiles enable row level security;

-- Drop existing policies to prevent "already exists" errors
drop policy if exists "Profiles selectable by owner" on public.profiles;
drop policy if exists "Profiles updatable by owner" on public.profiles;

-- Policies for profiles
create policy "Profiles selectable by owner" on public.profiles
  for select to authenticated using (auth.uid() = id);

create policy "Profiles updatable by owner" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- Create urls table if not exists
create table if not exists public.urls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  original_url text not null,
  short_code text not null unique,
  custom_alias text unique,
  click_count integer not null default 0,
  last_visited_at timestamptz,
  expiry_date timestamptz,
  created_at timestamptz not null default now()
);

-- Enable RLS for urls
alter table public.urls enable row level security;

-- Drop existing policies to prevent "already exists" errors
drop policy if exists "URLs readable by anyone" on public.urls;
drop policy if exists "URLs insertable by owner" on public.urls;
drop policy if exists "URLs updatable by owner" on public.urls;
drop policy if exists "URLs deletable by owner" on public.urls;

-- Policies for urls
create policy "URLs readable by anyone" on public.urls
  for select to anon, authenticated using (true);

create policy "URLs insertable by owner" on public.urls
  for insert to authenticated with check (auth.uid() = user_id);

create policy "URLs updatable by owner" on public.urls
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "URLs deletable by owner" on public.urls
  for delete to authenticated using (auth.uid() = user_id);

-- Create indexes for urls
create index if not exists urls_user_id_idx on public.urls(user_id);
create index if not exists urls_short_code_idx on public.urls(short_code);

-- Create visits table if not exists
create table if not exists public.visits (
  id uuid primary key default gen_random_uuid(),
  url_id uuid not null references public.urls(id) on delete cascade,
  timestamp timestamptz not null default now(),
  ip_address text,
  browser text,
  device text,
  os text,
  country text,
  city text
);

-- Enable RLS for visits
alter table public.visits enable row level security;

-- Drop existing policies to prevent "already exists" errors
drop policy if exists "Visits readable by url owner" on public.visits;

-- Policies for visits
create policy "Visits readable by url owner" on public.visits
  for select to authenticated
  using (exists (
    select 1 from public.urls
    where urls.id = visits.url_id and urls.user_id = auth.uid()
  ));

-- Create indexes for visits
create index if not exists visits_url_id_idx on public.visits(url_id);
create index if not exists visits_timestamp_idx on public.visits(timestamp desc);

-- Trigger to automatically increment click_count and last_visited_at on urls
create or replace function public.increment_url_clicks()
returns trigger as $$
begin
  update public.urls
  set click_count = click_count + 1,
      last_visited_at = new.timestamp
  where id = new.url_id;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_visit_logged on public.visits;
create trigger on_visit_logged
  after insert on public.visits
  for each row execute function public.increment_url_clicks();

revoke execute on function public.increment_url_clicks() from public, anon, authenticated;

-- Trigger to auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Revoke permissions on helper function
revoke execute on function public.handle_new_user() from public, anon, authenticated;
