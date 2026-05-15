-- Run this once in your Supabase project's SQL editor.
-- It creates the papers table + a permissive Phase-1 RLS policy.
-- Phase 2 will tighten the policy to `auth.uid() = user_id`.

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
  for all using (true) with check (true);


-- ---- Storage bucket -------------------------------------------------------
-- In the Supabase dashboard → Storage:
--   1. Create a new bucket named "papers"
--   2. Make it PUBLIC (or accept the default and rely on signed URLs)
--
-- If you'd rather create it via SQL, run:
--
--   insert into storage.buckets (id, name, public)
--   values ('papers', 'papers', true)
--   on conflict (id) do update set public = excluded.public;
--
-- Then add this RLS policy so the anon role can upload + read in Phase 1:
--
--   drop policy if exists "anon papers bucket (phase 1)" on storage.objects;
--   create policy "anon papers bucket (phase 1)" on storage.objects
--     for all to anon using (bucket_id = 'papers') with check (bucket_id = 'papers');
