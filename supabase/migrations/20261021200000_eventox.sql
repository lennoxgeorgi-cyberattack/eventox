-- Eventox: accounts, events, favorites, friends.
-- Run this in the Supabase SQL editor or with the Supabase CLI: supabase db push

create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  avatar_url text,
  created_at timestamptz not null default now(),
  constraint profiles_username_length check (char_length(btrim(username)) between 2 and 40)
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles (id) on delete cascade,
  title text not null,
  description text not null default '',
  category text not null,
  date date not null,
  all_day boolean not null default false,
  start_time text,
  end_time text,
  repeat text,
  place text not null,
  lat double precision not null,
  lng double precision not null,
  gold boolean not null default false,
  image text,
  source text,
  source_url text,
  source_external_id text,
  created_at timestamptz not null default now(),
  constraint events_repeat check (repeat is null or repeat in ('daily', 'weekly', 'monthly', 'yearly'))
);

create unique index events_source_identity
  on public.events (source, source_external_id)
  where source is not null and source_external_id is not null;

create index events_date_idx on public.events (date);
create index events_search_idx on public.events using gin (to_tsvector('simple', title || ' ' || place || ' ' || description));

create table public.favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

create table public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references public.profiles (id) on delete cascade,
  to_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (from_id, to_id),
  constraint friend_requests_not_self check (from_id <> to_id)
);

create table public.friendships (
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  constraint friendships_ordered check (user_a < user_b)
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  wanted text;
begin
  wanted := btrim(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)));
  if wanted is null or char_length(wanted) < 2 then
    wanted := 'Nutzer';
  end if;
  wanted := left(wanted, 40);
  while exists (select 1 from public.profiles where username = wanted) loop
    wanted := left(wanted, 28) || '-' || left(replace(new.id::text, '-', ''), 8);
  end loop;
  insert into public.profiles (id, username) values (new.id, wanted);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.friendships
    where user_a = least(a, b) and user_b = greatest(a, b)
  );
$$;

create or replace function public.purge_expired_events()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  delete from public.events
  where repeat is null
    and date < (timezone('Europe/Berlin', now()))::date;
  get diagnostics removed = row_count;
  return removed;
end;
$$;

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.favorites enable row level security;
alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;

create policy profiles_select on public.profiles
  for select to authenticated using (true);
create policy profiles_update on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy events_select on public.events
  for select using (
    repeat is not null
    or date >= (timezone('Europe/Berlin', now()))::date
  );
create policy events_insert on public.events
  for insert to authenticated with check (owner_id = auth.uid());
create policy events_update on public.events
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy events_delete on public.events
  for delete to authenticated using (owner_id = auth.uid());

create policy favorites_select on public.favorites
  for select to authenticated using (user_id = auth.uid() or public.are_friends(auth.uid(), user_id));
create policy favorites_insert on public.favorites
  for insert to authenticated with check (user_id = auth.uid());
create policy favorites_delete on public.favorites
  for delete to authenticated using (user_id = auth.uid());

create policy friend_requests_select on public.friend_requests
  for select to authenticated using (from_id = auth.uid() or to_id = auth.uid());
create policy friend_requests_insert on public.friend_requests
  for insert to authenticated with check (from_id = auth.uid());
create policy friend_requests_delete on public.friend_requests
  for delete to authenticated using (from_id = auth.uid() or to_id = auth.uid());

create policy friendships_select on public.friendships
  for select to authenticated using (user_a = auth.uid() or user_b = auth.uid());
create policy friendships_insert on public.friendships
  for insert to authenticated with check (user_a = auth.uid() or user_b = auth.uid());
create policy friendships_delete on public.friendships
  for delete to authenticated using (user_a = auth.uid() or user_b = auth.uid());

revoke all on function public.purge_expired_events() from public;
grant execute on function public.purge_expired_events() to anon, authenticated;
revoke all on function public.are_friends(uuid, uuid) from public;
grant execute on function public.are_friends(uuid, uuid) to authenticated;

grant select on public.events to anon, authenticated;
grant select, insert, update, delete on public.events to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, delete on public.favorites to authenticated;
grant select, insert, delete on public.friend_requests to authenticated;
grant select, insert, delete on public.friendships to authenticated;
