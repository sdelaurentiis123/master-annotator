# master-annotator

Upload a hand-annotated PDF, get a Claude Code prompt (Phase 1) or a GitHub PR (Phase 2)
that applies your reviewer's annotations to the paper's LaTeX source.

- **Gemini 3.1 Pro Preview** extracts every mark from the PDF.
- **Claude Opus 4.7** organizes the marks into an ordered plan + classifies each by
  reviewer intent.
- **Frontend (Next.js + Supabase)** drives the workflow and persists state.
- **Backend (FastAPI)** is three stateless endpoints — no DB layer in Python.

## Layout

```
master-annotator/
├── backend/                       FastAPI app, stateless
│   ├── pyproject.toml             uv-managed Python 3.12
│   └── app/{extractor,api,services,prompts,schemas}/
├── frontend/                      Next.js 15 (App Router, TS strict)
├── zoltan-marginalia.pdf          test fixture
├── DECISIONS.md                   non-trivial architectural calls
└── .env.example                   variable list
```

## Local setup

### Backend

```bash
cd backend
uv sync
cp ../.env.example .env       # fill GEMINI_API_KEY + ANTHROPIC_API_KEY
uv run pytest                  # smoke tests
uv run uvicorn app.main:app --reload --port 8000
```

Health check: `curl http://localhost:8000/api/health`

### Frontend

```bash
cd frontend
pnpm install
cp ../.env.example .env.local  # fill NEXT_PUBLIC_SUPABASE_* + BACKEND_URL
pnpm dev
```

Then open <http://localhost:3000>.

### Supabase schema

In your Supabase project's SQL editor, run:

```sql
create table public.papers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  pdf_filename text not null,
  total_pages int not null,
  pdf_path text not null,
  status text not null default 'uploaded',
  annotations jsonb,
  plan jsonb,
  error_message text
);

alter table public.papers enable row level security;
create policy "anon all" on public.papers for all using (true) with check (true);
```

Then create a public-read Storage bucket named `papers`.

## Security

**The Anthropic API key was pasted into the build conversation. Rotate it at
console.anthropic.com after the demo** — see [DECISIONS.md §D8](DECISIONS.md).

`.env` files are gitignored. Never commit them.

## Build status

Phase 1 slices: ✅ Slice 1 (skeleton) — others in progress. See plan at
`~/.claude/plans/deep-wobbling-tarjan.md` (local).
