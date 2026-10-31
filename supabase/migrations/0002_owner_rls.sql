-- AXION-X100: replace the prototype "using (true)" policies with per-user ownership.
-- Every row belongs to the Supabase auth user that wrote it (auth.uid()); the anon role
-- gets no table access at all, and a client-side device_pair_id filter is no longer a
-- security boundary. Clients sign in (anonymous sign-in is enough) before syncing.
-- Rows written before this migration have no owner and become unreachable (deny by default).

alter table public.profiles
  add column if not exists owner_id uuid default auth.uid() references auth.users (id) on delete cascade;
alter table public.memory_chunks
  add column if not exists owner_id uuid default auth.uid() references auth.users (id) on delete cascade;

-- Uniqueness is per owner, so one user can never claim or collide with another's pair id.
alter table public.profiles drop constraint if exists profiles_device_pair_id_key;
alter table public.profiles add constraint profiles_owner_pair_key unique (owner_id, device_pair_id);
alter table public.memory_chunks drop constraint if exists memory_chunks_device_pair_id_summary_milestone_kind_key;
alter table public.memory_chunks add constraint memory_chunks_owner_pair_summary_key unique (owner_id, device_pair_id, summary, milestone_kind);

drop index if exists public.memory_chunks_pair_recent;
create index if not exists memory_chunks_owner_recent
  on public.memory_chunks (owner_id, device_pair_id, created_at desc);

-- ===== Privileges: nothing for anon, CRUD for signed-in users (still filtered by RLS) =====
revoke all on public.profiles, public.memory_chunks from anon, public;
grant select, insert, update, delete on public.profiles, public.memory_chunks to authenticated;

-- ===== Row Level Security: deny by default, owner-only =====
alter table public.profiles      enable row level security;
alter table public.memory_chunks enable row level security;
alter table public.profiles      force row level security;
alter table public.memory_chunks force row level security;

drop policy if exists "pair scope select profiles" on public.profiles;
drop policy if exists "pair scope write profiles"  on public.profiles;
drop policy if exists "pair scope select chunks"   on public.memory_chunks;
drop policy if exists "pair scope write chunks"    on public.memory_chunks;

create policy "owner select profiles" on public.profiles
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "owner insert profiles" on public.profiles
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "owner update profiles" on public.profiles
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "owner delete profiles" on public.profiles
  for delete to authenticated using (owner_id = (select auth.uid()));

create policy "owner select chunks" on public.memory_chunks
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "owner insert chunks" on public.memory_chunks
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "owner update chunks" on public.memory_chunks
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "owner delete chunks" on public.memory_chunks
  for delete to authenticated using (owner_id = (select auth.uid()));

-- ===== Daily cap counted per owner, with a pinned search_path =====
create or replace function public.enforce_user_row_cap()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (select count(*) from public.memory_chunks
      where owner_id = new.owner_id
        and created_at > now() - interval '24 hours') >= 200
  then
    raise exception 'memory_chunks daily cap reached for this user';
  end if;
  return new;
end;
$$;
