# Architecture Decision Records

These short records capture the choices that shape the current prototype.

## ADR 001 — Next.js App Router

**Decision:** Use one Next.js application for UI and server routes.

**Why:** The assignment needs an observable web interface and a server-side agent workflow. A single deployment keeps authentication, run history, and UI progress updates in one application.

**Trade-off:** Long-running inference calls share the web request lifecycle. A durable queue/worker may be needed as usage grows.

## ADR 002 — PostgreSQL on Serv00

**Decision:** Use PostgreSQL both locally (Docker) and in production (Serv00).

**Why:** Persistent user/run data is required, PostgreSQL is available on the selected host, and the same SQL model can be exercised locally.

**Trade-off:** There is no migration framework with a migration ledger; migrations are explicitly ordered and idempotent in `scripts/migrate.mjs`.

## ADR 003 — Review-only patches in isolated copies

**Decision:** Generate and validate diffs in a per-run source copy, then return the diff for human review. Do not apply it to the live source tree.

**Why:** The web app runs on a remote host and must not turn user prompts into automatic production code changes.

**Trade-off:** The current copy is a filesystem-scoped workspace, not a hardened container. It supports only a narrow UI file allowlist.

## ADR 004 — Groq primary, NVIDIA NIM fallback

**Decision:** Use Groq as primary and NVIDIA NIM as an optional fallback behind one provider adapter.

**Why:** This provides a second provider path when the primary API is unavailable or rate-limited, while keeping both server-side and OpenAI-compatible.

**Trade-off:** Model output formats and limits differ. The adapter is best-effort; generated output still requires validation and review. The in-memory circuit state is per process, not distributed.

## ADR 005 — TypeScript check plus independent model review

**Decision:** Testing runs `tsc --noEmit` on the modified workspace and asks a separate model call to review the diff.

**Why:** This gives an executable static check without launching generated code on the shared host.

**Trade-off:** TypeScript success and LLM review do not prove runtime correctness, accessibility, security, or visual quality. Browser/runtime tests remain future work.

## ADR 006 — Honest AI development provenance

**Decision:** Document which coding assistants were actually used and leave uncompleted evaluation requirements clearly marked.

**Why:** Tool-use claims are part of the technical evaluation and should be verifiable.

**Trade-off:** A required Claude Code or Codex iteration must still be performed and recorded before claiming that requirement is met.
