-- Run this in your Supabase project's SQL editor.
-- Phase-2: per-user ownership via auth.uid().

-- ---- papers table -------------------------------------------------------

create table if not exists public.papers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  pdf_filename text not null,
  total_pages int not null default 0,
  pdf_path text not null,
  status text not null default 'uploaded',
  annotations jsonb,
  plan jsonb,
  error_message text
);

-- Phase-2 additions
alter table public.papers
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.papers
  add column if not exists connected_repo_full_name text;
alter table public.papers
  add column if not exists pr_url text;
alter table public.papers
  add column if not exists pr_number int;

alter table public.papers enable row level security;

-- Replace any prior permissive policies with per-user ownership
drop policy if exists "anon all (phase 1)" on public.papers;
drop policy if exists "authenticated all (phase 1)" on public.papers;
drop policy if exists "owner select" on public.papers;
drop policy if exists "owner insert" on public.papers;
drop policy if exists "owner update" on public.papers;
drop policy if exists "owner delete" on public.papers;

create policy "owner select" on public.papers
  for select to authenticated using (auth.uid() = user_id);
create policy "owner insert" on public.papers
  for insert to authenticated with check (auth.uid() = user_id);
create policy "owner update" on public.papers
  for update to authenticated using (auth.uid() = user_id);
create policy "owner delete" on public.papers
  for delete to authenticated using (auth.uid() = user_id);


-- ---- Storage bucket -----------------------------------------------------
-- Storage path convention: papers/<user_id>/<paper_id>.pdf

insert into storage.buckets (id, name, public)
values ('papers', 'papers', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "anon papers bucket (phase 1)" on storage.objects;
drop policy if exists "authenticated papers bucket (phase 1)" on storage.objects;
drop policy if exists "owner papers bucket" on storage.objects;
drop policy if exists "authenticated papers rw" on storage.objects;

-- Phase 2 (relaxed): any authenticated user can read/write the papers bucket.
-- Per-row ownership is enforced on the public.papers table above; PDF blobs
-- are addressed by UUIDs the user must already own a row for, so this is
-- safe enough for MVP without per-folder scoping.
create policy "authenticated papers rw" on storage.objects
  for all to authenticated
  using (bucket_id = 'papers')
  with check (bucket_id = 'papers');
