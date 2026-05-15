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

Open your Supabase project's SQL editor and paste the contents of
[`supabase/schema.sql`](supabase/schema.sql). It creates the `papers` table + the
Phase-1 RLS policy.

Then in Supabase → Storage, create a bucket named **`papers`** (public). The schema
file includes a SQL alternative for creating the bucket via the storage table.

If you haven't run the SQL yet, the home page will show a clear "Supabase: Could not
find the table 'public.papers'..." error on the recent-papers list.

## Deploy

### Frontend → Vercel

1. Push to GitHub.
2. Import the repo into Vercel, set the **Root Directory** to `frontend/`.
3. Add env vars in the Vercel dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `NEXT_PUBLIC_BACKEND_URL` → the Fly.io URL once the backend is deployed
4. Vercel auto-detects Next.js + pnpm. Default build settings work.

### Backend → Fly.io

```bash
cd backend
fly launch --no-deploy --copy-config        # one-time
fly secrets set \
  GEMINI_API_KEY=... \
  ANTHROPIC_API_KEY=... \
  FRONTEND_ORIGIN=https://<your-vercel-domain>
fly deploy
```

`backend/fly.toml` is preconfigured for shared-CPU, 1 GiB. See
[DECISIONS.md §D12](DECISIONS.md) for the deploy architecture rationale.

## Security

**The Anthropic API key was pasted into the build conversation. Rotate it at
console.anthropic.com after the demo** — see [DECISIONS.md §D8](DECISIONS.md).

`.env` files are gitignored. Never commit them.

## Build status

Phase 1 slices: ✅ Slice 1 (skeleton) — others in progress. See plan at
`~/.claude/plans/deep-wobbling-tarjan.md` (local).
