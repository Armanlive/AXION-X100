-- AXION-X100 hybrid memory: lightweight cloud mirror of user profile data
-- and summarized milestone chunks. Raw chats, workspace indexes and logs
-- never leave the device (local SQLite/encrypted store only).
-- Free-tier budget: profile ≤ 1 row per user; memory_chunks ≤ 200 rows/user/day.

create extension if not exists "pgcrypto";

-- Lightweight user profile / bonding preferences (Desktop ⇄ Mobile continuity)
create table if not exists public.profiles (
  id            uuid primary key default gen_random_uuid(),
  device_pair_id text not null unique,          -- pairing key shared by Desktop+Mobile
  display_name  text,
  role          text check (char_length(role) <= 400),
  projects      text check (char_length(projects) <= 400),
  help          text check (char_length(help) <= 400),
  style         text check (char_length(style) <= 400),
  share_with_ai boolean not null default true,
  revision      integer not null default 1,
  updated_at    timestamptz not null default now()
);

-- Summarized high-level conversation memory (milestones) — never raw transcripts
create table if not exists public.memory_chunks (
  id            uuid primary key default gen_random_uuid(),
  device_pair_id text not null,
  milestone_kind text not null check (milestone_kind in ('summary','decision','preference','goal')),
  summary       text not null check (char_length(summary) <= 512),
  source        text not null default 'desktop' check (source in ('desktop','mobile')),
  device_label  text,
  created_at    timestamptz not null default now(),
  unique (device_pair_id, summary, milestone_kind)
);

create index if not exists memory_chunks_pair_recent
  on public.memory_chunks (device_pair_id, created_at desc);

-- ===== Row Level Security =====
alter table public.profiles      enable row level security;
alter table public.memory_chunks enable row level security;

-- Anon-key desktop/mobile clients act on their own pairing scope only.
-- (Supabase auth is a future milestone; shared anon key + pair_id is the
--  prototype-safe interim trusted mode for explicit-pair devices.)
create policy "pair scope select profiles" on public.profiles
  for select using (true);
create policy "pair scope write profiles" on public.profiles
  for all using (true) with check (true);
create policy "pair scope select chunks" on public.memory_chunks
  for select using (true);
create policy "pair scope write chunks" on public.memory_chunks
  for all using (true) with check (true);

-- ===== Free-tier storage cap: reject bulk dumps at the table level =====
create or replace function public.enforce_user_row_cap()
returns trigger as $$
begin
  if (select count(*) from memory_chunks
      where device_pair_id = new.device_pair_id
        and created_at > now() - interval '24 hours') >= 200
  then
    raise exception 'memory_chunks daily cap reached for this device pair';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger memory_chunks_cap
  before insert on public.memory_chunks
  for each row execute function public.enforce_user_row_cap();
