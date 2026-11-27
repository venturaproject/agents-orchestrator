<p align="center">
  <img src="docs/header.png" alt="Crew — AI development workbench. Plan, build and review with AI agents." width="100%">
</p>

# Crew — AI Agent Workbench

> A review-first AI development workflow: an Orchestrator plans the work, Develop proposes a constrained patch, and Testing checks it before a human decides what to do next.

Crew uses a Next.js frontend and a NestJS backend, with PostgreSQL-backed run history, isolated patch workspaces, and provider failover between Groq and NVIDIA NIM. Authentication, run management, patch downloads, and agent orchestration are served by NestJS.

**Live demo:** [demo.prostiner.serv00.net](https://demo.prostiner.serv00.net)

## Why Crew

- **Three clear responsibilities:** plan, implement, and independently review.
- **Human-controlled changes:** generated changes are shown and downloadable; they are never applied to the live application.
- **Bounded iteration:** Testing feedback can send Develop back for up to three rounds.
- **Provider resilience:** Groq is primary; NVIDIA NIM is the optional fallback, guarded by an in-process circuit breaker.
- **Observable work:** run status, task status, review feedback, type-check output, and the final diff are persisted and shown in the UI.
- **Private by default:** credentials stay in environment files, and each run uses a temporary workspace.
- **Demo-ready access:** account registration is disabled, sign-in supports a password visibility toggle and an optional remembered session.
- **Bilingual interface:** English and Spanish, with language and light/dark appearance persisted per browser.

## How a run works

```mermaid
sequenceDiagram
    actor User
    participant UI as Next.js UI
    participant API as Transitional Next.js API
    participant DB as PostgreSQL
    participant LLM as Groq / NVIDIA
    participant Sandbox as Isolated workspace

    User->>UI: Submit a development request
    UI->>API: PUT /api/runs
    API->>DB: Create run
    UI->>API: POST /api/agents { runId }
    API->>DB: Verify ownership and persist progress
    API->>Sandbox: Copy allowed project files
    API->>LLM: Orchestrator returns plan and target files
    loop Up to 3 review rounds
        API->>LLM: Develop returns a unified diff
        API->>Sandbox: Validate and apply diff
        API->>Sandbox: Run tsc --noEmit
        API->>LLM: Testing reviews diff and compiler output
        alt Testing requests changes
            API->>LLM: Send feedback to Develop
        else Approved or iteration limit reached
            API->>DB: Persist result, diff, and status
        end
    end
    UI->>API: Poll persisted run status
    API->>DB: Read owner-scoped progress
    User->>UI: Review or download patch
    API->>Sandbox: Remove temporary workspace
```

See [docs/architecture.md](docs/architecture.md) and [docs/agent-workflow.md](docs/agent-workflow.md) for implementation detail.

## Architecture conventions

New backend capabilities follow DDD and Clean Architecture (`Infrastructure -> Application -> Domain`), with separate command/write and query/read use cases. The frontend is organized by feature and consumes backend HTTP contracts; existing Next.js API routes are transitional and should not gain new business logic. CQRS does not imply event sourcing or separate databases. See the [architecture and coding conventions](docs/architecture-conventions.md) before adding or migrating features.

## Tech stack

| Area | Choice |
| --- | --- |
| Web application | Next.js 16 App Router, React 19, TypeScript |
| Backend API | NestJS 12 |
| Database | PostgreSQL 16, `pg` connection pool |
| Authentication | scrypt password hashes, signed JWT session cookie |
| Primary inference | Groq OpenAI-compatible Chat Completions API |
| Optional fallback | NVIDIA NIM OpenAI-compatible Chat Completions API |
| Change validation | `git apply` checks and `tsc --noEmit` |
| Hosting | Serv00 Node.js / Passenger |

## Local development

### Prerequisites

- Node.js 22.22.3 or newer (Node 24.15+ is also supported by the Nest toolchain)
- npm
- Docker Desktop (for local PostgreSQL)
- At least one inference key: Groq or NVIDIA NIM

### Start the application

```bash
npm ci --prefix frontend
npm ci --prefix backend
cp .env.example .env.local
```

Set the local database password, `AUTH_SECRET`, and at least one provider key in `.env.local`. Then start the app:

```bash
make dev
```

`make dev` starts PostgreSQL, applies SQL migrations, and launches Next.js. In a
second terminal run `make dev-backend` to start the NestJS API. `.env.local`
configures the frontend to call it at `http://localhost:3001`. The local database
is exposed on `127.0.0.1:55433`.

### Run the whole app in Docker

To run the Next.js frontend, NestJS backend, and PostgreSQL together in Compose:

```bash
cp .env.docker.example .env.docker
# Set local credentials, AUTH_SECRET, and optional provider keys in .env.docker.
# Keep LOCAL_PG_PASSWORD and the password in DATABASE_URL in sync.
make docker-up
```

Open the full application through Nginx at `http://localhost:8088`; it serves
the frontend and proxies `/api/` to NestJS. Next.js and NestJS listen on internal
container ports `3000` and `3001`. Use `make docker-logs` to follow service logs
and `make docker-down` to stop the containers; the database volume is preserved.
Production has not yet been migrated or deployed.

To run the setup steps separately:

```bash
make db-up
make db-migrate
```

See [docs/development.md](docs/development.md) for environment variables, file map, and troubleshooting.

## Configuration

Copy `.env.example` to `.env.local`. Never commit `.env.local` or production secrets.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `AUTH_SECRET` | Yes | HMAC signing secret; at least 32 characters |
| `NEXT_PUBLIC_BACKEND_URL` | Local split-service mode | NestJS base URL for migrated frontend calls; keep unset in production until the backend is deployed |
| `GROQ_API_KEY` | One provider required | Groq primary API key |
| `GROQ_MODEL` | No | Defaults to `openai/gpt-oss-20b` |
| `NVIDIA_API_KEY` | No | NVIDIA NIM fallback API key |
| `NVIDIA_MODEL` | No | Defaults to `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` |
| `AGENT_WORKSPACE_ROOT` | No | Workspace parent directory; defaults to `.agent-workspaces` |
| `PGSSL` | No | Set to `true` to enable certificate-verified PostgreSQL TLS |

The provider order, retries, breaker behavior, and current limitations are documented in [docs/agent-workflow.md](docs/agent-workflow.md).

## Commands and verification

```bash
make dev              # Start local app (also starts DB and migrates)
make dev-backend      # Start NestJS backend
make lint             # Lint frontend/backend and type-check frontend
make test             # Vitest unit/component tests
make build            # Build Next.js frontend
make build-backend    # Build NestJS backend
make db-up            # Start local PostgreSQL container
make db-migrate       # Apply SQL migrations
make deploy           # Build and deploy to Serv00
```

Oxlint provides fast static source analysis; it does not compile the app. `make lint` runs Oxlint and dependency-cruiser rules for both applications, then type-checks the frontend. `make test` runs frontend and backend unit tests. There is not yet an automated browser-test runner. Testing in the agent workflow runs the TypeScript compiler and performs an LLM-based diff review; it does not execute generated application code or claim runtime correctness. See [the Playwright MCP E2E checklist](docs/e2e-playwright-mcp.md) for manual browser acceptance.

## Deployment

Production uses Serv00 Node.js / Passenger and PostgreSQL. The deploy script builds locally, syncs the application while excluding environment files, installs production dependencies, and restarts the site.

```bash
make deploy
```

The script expects an SSH alias named `prostiner-serv00`, a configured Serv00 Node.js domain, and an existing remote `.env.production`. Production secrets are stored in that file with mode `600`; `.env*` files are excluded from `rsync`.

GitHub Actions also runs CI for pull requests and pushes to `main`. Production deployment is available as a manual workflow after configuring dedicated SSH secrets; see [the deployment guide](docs/deployment.md#github-actions-deployment).

Deployment topology, required setup, migrations, and operational notes are in [docs/deployment.md](docs/deployment.md).

## Current verification status

- Production build and TypeScript checks pass.
- Authentication and PostgreSQL persistence have been exercised locally and against production.
- NVIDIA API authentication and Groq-to-NVIDIA fallback have been verified without exposing either key.
- The full generated-patch workflow has **not yet passed a repeatable end-to-end acceptance run**. Provider limits and inconsistent model-generated diffs have caused failed smoke runs. The application records these failures; this README does not present them as successful tests.
- The downloaded patch remains review-only and is never applied to production.

See [docs/agent-workflow.md](docs/agent-workflow.md#verification-and-known-limitations) for the exact boundary between implemented behavior and verified behavior.

## AI-assisted development disclosure

This project has been developed with **OpenCode** assistance. The separate evaluation requirement to perform and document a verifiable iteration using Claude Code or Codex remains outstanding; it is not claimed as completed. See [docs/AI_USAGE.md](docs/AI_USAGE.md).

## Documentation map

- [Documentation index](docs/README.md)
- [Architecture](docs/architecture.md)
- [Architecture and coding conventions](docs/architecture-conventions.md)
- [Agent workflow and provider resilience](docs/agent-workflow.md)
- [Security and trust boundaries](docs/security.md)
- [Local development](docs/development.md)
- [Serv00 deployment](docs/deployment.md)
- [Architecture decisions](docs/decisions.md)
- [AI tool usage disclosure](docs/AI_USAGE.md)
- [End-to-end checklist with Playwright MCP](docs/e2e-playwright-mcp.md)
- [Contributor / agent instructions](AGENTS.md)
