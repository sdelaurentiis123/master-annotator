# master-annotator

Upload a hand-annotated PDF of an academic paper. Get a pull request on your repo with
the reviewer's edits applied to the LaTeX source.

- **Gemini 3.1 Pro Preview** extracts every mark from every page (handwriting, strikes,
  arrows, margin notes) into structured JSON with bounding boxes.
- **Claude Opus 4.7** organizes them into an ordered Claude Code prompt addressing each
  edit in turn.
- **The agent** (Claude Opus 4.7 + tool-use, sandboxed in **E2B**) clones your GitHub
  repo, applies the edits, runs a `tectonic` compile check, commits, pushes, and opens
  the PR.

Live progress streams to the browser via SSE the whole way: per-page extraction tiles,
per-turn agent trace log, final PR link.

## Live

- **Frontend** -- <https://master-annotator-stan-ds-projects.vercel.app>
- **Backend**  -- <https://master-annotator-backend.fly.dev>

## What the UX looks like

Three-step workflow per paper:

```
Sign in with GitHub  ->  upload PDF  ->  /paper/[id]
                                              |
                +-----------------+-----------+-----------+-----------------+
                |   step 1        |   step 2              |   step 3        |
                |   Extract       |   Plan                |   Apply         |
                +-----------------+-----------------------+-----------------+
                | live per-page   | scrollable Claude     | Option A: copy  |
                | progress bar    | Code prompt accordion | the prompt      |
                | (Gemini calls)  | (one Claude call)     | Option B: pick  |
                |                 |                       | repo + open PR  |
                | bbox overlays   |                       | via E2B agent   |
                | on the PDF      |                       | (live trace log)|
                +-----------------+-----------------------+-----------------+
```

## Architecture

```
+----------------+        +------------------+       +-------------------+
|  Browser       |<--RSC->|  Vercel (Next 16)|<-SQL->|  Supabase         |
|                |        |  master-annotator|       |  - papers table   |
|                |   SSE  +-------+----------+       |  - papers bucket  |
|                |<-------+       | fetch (browser)  |  - GitHub OAuth   |
|                |               v                   +-------------------+
|                |        +------------------+
|                |        |  Fly.io (FastAPI)|        +-----------------+
|                |        |  - /api/extract  |<--SDK->|  Gemini 3.1 Pro |
|                |        |  - /api/plan     |        +-----------------+
|                |        |  - /api/papers/  |        +-----------------+
|                |        |    :id/execute   |<--SDK->|  Claude Opus 4.7|
|                |        |  - SessionBus    |        +-----------------+
+----------------+        +------+-----------+        +-----------------+
                                 | spawn              |  api.github.com |
                                 v                    +-----------------+
                          +------------------+               ^
                          |  E2B sandbox     |               | httpx
                          |  /home/user/     |---git clone---+
                          |    workspace/    |---git push----+
                          |  tectonic + git  |
                          +------------------+
```

Backend is stateless. Supabase is the source of truth for paper rows + PDFs. The
SessionBus is a per-paper in-memory pub-sub for live streaming.

See [DECISIONS.md](DECISIONS.md) for the choices made along the way (Supabase JS for
all CRUD, one Claude call instead of two, E2B over a custom Docker template, etc.).

## Layout

```
master-annotator/
|-- backend/                         FastAPI app, stateless
|   |-- pyproject.toml               uv-managed, Python 3.12
|   |-- fly.toml + Dockerfile        Fly.io deploy
|   `-- app/
|       |-- main.py                  CORS + route mounts
|       |-- config.py                pydantic-settings (.env)
|       |-- bus.py                   SessionBus (SSE pub-sub)
|       |-- api/
|       |   |-- extract.py           POST /api/extract  (Gemini, multipart)
|       |   |-- plan.py              POST /api/plan     (Claude streaming)
|       |   `-- execute.py           POST /api/papers/:id/execute
|       |                            GET  /api/papers/:id/stream
|       |-- services/
|       |   |-- extraction.py        batched per-page Gemini, publishes bus events
|       |   |-- planner.py           one Claude streaming call -> markdown prompt
|       |   |-- agent_runner.py      tool-use loop, push, open PR
|       |   |-- agent_tools.py       5 tools: read/write/bash/commit/done
|       |   |-- agent_workspace.py   LocalWorkspace (/tmp filesystem)
|       |   |-- sandbox_workspace.py SandboxWorkspace (E2B)
|       |   `-- github_client.py     httpx -> api.github.com /pulls
|       |-- extractor/               (Gemini PDF -> structured Annotation list)
|       `-- prompts/
|           |-- planner.md
|           `-- agent.md
|-- frontend/                        Next.js 16, App Router, Tailwind v4, shadcn
|   `-- components/
|       |-- workspace-tabs.tsx       3-step ribbon (Extract / Plan / Apply)
|       |-- pdf-viewer.tsx           react-pdf + bbox overlays
|       |-- extract-progress.tsx     live per-page tile bar (SSE)
|       |-- comment-sidebar.tsx      per-page filtered comments
|       |-- plan-review.tsx          collapsible markdown prompt
|       |-- path-chooser.tsx         Option A (copy) vs Option B (agent + PR)
|       |-- repo-selector.tsx        GitHub /user/repos browser-side
|       `-- agent-run.tsx            inline trace log (SSE)
|-- supabase/
|   `-- schema.sql                   table + RLS + bucket
|-- DECISIONS.md                     non-trivial architectural calls
`-- .env.example                     variables for both apps
```

## Local setup

### Backend (Python 3.12 + uv)

```bash
cd backend
uv sync
cp ../.env.example .env       # fill GEMINI_API_KEY + ANTHROPIC_API_KEY
                              # (optional) E2B_API_KEY + AGENT_WORKSPACE=sandbox
uv run pytest                 # 11 smoke tests
uv run uvicorn app.main:app --reload --port 8001
```

Health check: `curl http://localhost:8001/api/health`

`AGENT_WORKSPACE=local` (default) runs the agent against `/tmp/master-annotator-runs/`
using your local `git`. Set to `sandbox` (and provide `E2B_API_KEY`) to run agent
inside an E2B microVM, like production does.

### Frontend (Next.js 16 + pnpm)

```bash
cd frontend
pnpm install                  # postinstall copies the pdf.js worker into public/
cp ../.env.example .env.local # fill NEXT_PUBLIC_SUPABASE_* + BACKEND_URL
pnpm dev
```

Then open <http://localhost:3000>.

## One-time platform setup

### Supabase schema

In your Supabase project's SQL editor, paste [`supabase/schema.sql`](supabase/schema.sql).
That creates the `papers` table with phase-2 columns (`user_id`,
`connected_repo_full_name`, `pr_url`, `pr_number`), enables RLS keyed on `auth.uid()`,
and creates the `papers` storage bucket with an authenticated-read-write policy.

### Supabase GitHub OAuth provider

1. Create a **GitHub OAuth App** at <https://github.com/settings/applications/new>:
   - Homepage URL: your production frontend URL
   - Authorization callback URL: `https://<your-project>.supabase.co/auth/v1/callback`
   - Copy the Client ID, generate a Client Secret
2. Supabase dashboard -> Authentication -> Providers -> **GitHub**:
   - Enable, paste Client ID + Secret
   - Scopes: `repo read:user`
3. Supabase dashboard -> Authentication -> URL Configuration -> **Redirect URLs**:
   - Add `https://<your-frontend-url>/auth/callback`
   - Add `http://localhost:3000/auth/callback` for local dev

## Deploy

### Frontend -> Vercel

```bash
cd frontend
vercel link
# Set env vars (or paste them in the Vercel dashboard):
echo "<your-supabase-url>"        | vercel env add NEXT_PUBLIC_SUPABASE_URL production
echo "<your-supabase-anon-key>"   | vercel env add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY production
echo "https://<your-fly-app>.fly.dev" | vercel env add NEXT_PUBLIC_BACKEND_URL production
vercel --prod
```

### Backend -> Fly.io

```bash
cd backend
fly launch --no-deploy --copy-config        # one-time
fly secrets set \
  GEMINI_API_KEY=...                        \
  ANTHROPIC_API_KEY=...                     \
  E2B_API_KEY=...                           \
  AGENT_WORKSPACE=sandbox                   \
  FRONTEND_ORIGIN=https://<your-frontend>
fly deploy
```

`backend/fly.toml` is preconfigured for shared-CPU, 1 GiB, 2 machines. See
[DECISIONS.md §D12](DECISIONS.md) for the deploy rationale.

## Security

`.env` and `.env.local` are gitignored. Never commit them.

API keys + secrets that were pasted into the build conversation and should be rotated
post-demo:

- Anthropic API key (`console.anthropic.com`)
- Gemini API key (`ai.studio`)
- Supabase Management API token (`supabase.com/dashboard/account/tokens`)
- E2B API key (`e2b.dev/dashboard`)
- GitHub OAuth App Client Secret (regenerate in the OAuth App settings)

## Build status

All 14 phase-1 + phase-2 slices complete:

| | |
|---|---|
| Phase 1 | upload, extract (batched + live progress), plan, edit comments, accept, copy prompt |
| Phase 2 | Supabase GitHub OAuth, per-user RLS, Path A/B chooser, repo picker, SSE bus, agent loop, E2B sandbox, PR opening |

End-to-end verified in production: sign in -> upload -> extract -> plan -> pick repo
-> agent run in sandbox -> PR opened on the user's GitHub repo.
