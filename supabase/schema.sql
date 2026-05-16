-- Run this once in your Supabase project's SQL editor.
-- Phase-1 policies: permissive anon access (no auth yet).
-- Phase 2 will tighten with `auth.uid() = user_id`.

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

alter table public.papers enable row level security;

drop policy if exists "anon all (phase 1)" on public.papers;
create policy "anon all (phase 1)" on public.papers
  for all to anon using (true) with check (true);

-- The publishable client also identifies as authenticated for some Supabase
-- routes — keep the policy permissive for both roles in Phase 1.
drop policy if exists "authenticated all (phase 1)" on public.papers;
create policy "authenticated all (phase 1)" on public.papers
  for all to authenticated using (true) with check (true);


-- ---- Storage bucket -----------------------------------------------------
-- Create the bucket if it doesn't exist. Public read so we can use plain
-- signed URLs without auth complexity in Phase 1.

insert into storage.buckets (id, name, public)
values ('papers', 'papers', true)
on conflict (id) do update set public = excluded.public;

-- RLS on storage.objects: allow anon + authenticated full access to the
-- papers bucket ONLY. This is the policy that fixes
-- "new row violates row-level security policy" on upload.

drop policy if exists "anon papers bucket (phase 1)" on storage.objects;
create policy "anon papers bucket (phase 1)" on storage.objects
  for all to anon
  using (bucket_id = 'papers')
  with check (bucket_id = 'papers');

drop policy if exists "authenticated papers bucket (phase 1)" on storage.objects;
create policy "authenticated papers bucket (phase 1)" on storage.objects
  for all to authenticated
  using (bucket_id = 'papers')
  with check (bucket_id = 'papers');
