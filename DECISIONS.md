# DECISIONS

Non-trivial architectural calls made during the build, with rationale. Append-only — when a
decision is reversed, leave the entry and add a new one referencing it.

## D1 — Frontend owns all persistence via Supabase JS; backend is stateless

The original spec called for FastAPI + SQLModel + Alembic + psycopg writing to Supabase
Postgres. The user pivoted: frontend uses `@supabase/supabase-js` + `@supabase/ssr` directly,
backend has three stateless endpoints (`/api/extract`, `/api/plan`, `/api/prompt`). This
eliminates the entire backend DB layer.

Trade-off: backend can't enforce server-side invariants on the `papers` table. Acceptable
because Phase 1 is single-user (no RLS yet) and the only "validation" we'd do server-side is
type checking already handled by Pydantic at the API boundary.

## D2 — No Alembic; no migrations in this codebase

Schema lives in Supabase, managed via the SQL editor + dashboard. We ship the `create table`
SQL in this README so it can be re-applied to a fresh project.

## D3 — One Claude call for plan + classification (not two)

Spec §6.2 + §6.3 specified two passes (intent classifier first, then planner). User asked
to fold them: the planner's tool-output schema now includes both `classifications` (per-
annotation `reviewer_intent` + reasoning) and `plan` (steps). One Anthropic call total.

## D4 — Sync extractor primitives + `asyncio.to_thread` for concurrency

`extract_page` stays sync (CLI- and pytest-friendly). The FastAPI service wraps calls in
`asyncio.gather([asyncio.to_thread(extract_page, ...)])` with a `Semaphore(6)` for batching.
No async refactor of the extractor.

## D5 — No tenacity dependency; inline retry helper

15-line `_with_backoff` in `app/extractor/extract.py`. Retries on 429 / 5xx /
"rate"/"quota"/"resource_exhausted"/"unavailable" substrings. Exponential 5s → 60s, 5
attempts. Adding tenacity for this would be 5 lines saved + a dep.

## D6 — No SSE; loading spinners

Extraction is the only long pipeline (~60–90s for a 12-page paper at concurrency=6). Spinner
suffices for MVP; plan generation is ~10–20s. SSE is the polish-pass upgrade if needed.

## D7 — Two-tier annotation schema: `RawAnnotation` ⊂ `Annotation`

`RawAnnotation` (in `app/extractor/schema.py`) is what Gemini returns via `response_schema`.
`Annotation` extends it with `id`, `page`, `reviewer_intent` (null until planner runs),
`user_edited`. Keeping Gemini's schema lean avoids the model trying to fill `reviewer_intent`
during extraction.

## D8 — Anthropic API key was pasted into the chat transcript

The key `sk-ant-api03-...` was shared in the conversation. It lives only in
`backend/.env` (gitignored). **Rotate after the demo** at console.anthropic.com.

## D9 — Phase 2 uses Supabase Auth's GitHub provider, not authlib

Spec §9.1 specified custom OAuth via authlib + a GitHub OAuth App + Fernet token encryption.
Supabase Auth already supports GitHub provider OAuth out of the box — `signInWithOAuth`
returns the user's `provider_token` on the session. Cuts ~200 LOC and the whole token-
storage problem.

## D10 — Phase 2 uses tectonic, not texlive-full

Spec §9.3 called for a custom E2B template with `texlive-full` (~4GB). Tectonic is a single
~50MB static binary that compiles 95% of arXiv-style papers. Fallback to `pdflatex` if
present in the sandbox.

## D11 — Phase 2 agent loop is Mode B (Anthropic SDK + tool use), not Claude Code CLI

Spec §9.4 suggested Mode A (Claude Code inside E2B) first. Mode B is simpler in a sandbox:
no CLI to install, no `--auto-confirm` flag, no IPC. Tools: `read_file`, `write_file`,
`bash`, `commit`.

## D12 — Deploy targets: Vercel (frontend), Fly.io (backend), E2B (Phase 2 sandbox)

- **Frontend → Vercel**. Next.js native. Env vars: `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_BACKEND_URL`. Pure static + edge;
  no server-side hits to the backend from Vercel functions — frontend calls the Fly.io
  backend directly from the browser.
- **Backend → Fly.io**. `backend/Dockerfile` + `backend/fly.toml`. Single shared-CPU
  1GiB machine. Long-running extraction request must stay inside Fly's proxy timeout;
  default is fine but if we hit it, switch to SSE in a polish pass.
  Set secrets: `fly secrets set GEMINI_API_KEY=... ANTHROPIC_API_KEY=... FRONTEND_ORIGIN=https://<vercel-domain>`.
- **Phase 2 sandbox → E2B**. Stock `python-3.12` template; install tectonic +
  anthropic on boot. `E2B_API_KEY` set on the Fly backend.

The architecture preserves portability: frontend can run on Cloudflare Pages, backend can
run on any container host, sandbox can be any code-execution service. Vercel/Fly/E2B are
defaults chosen for ease of demo deployment.
