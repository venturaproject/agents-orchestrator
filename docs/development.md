# Development Guide

## Prerequisites

- Node.js 22.22.3+ (or 24.15+; required by the NestJS 12 toolchain)
- npm
- Docker Desktop / Docker Engine with Compose
- A Groq API key, an NVIDIA NIM API key, or both

## Setup

```bash
npm ci --prefix frontend
npm ci --prefix backend
cp .env.example .env.local
```

Edit `.env.local` and provide:

1. A local `DATABASE_URL` matching `infrastructure/compose.db.yml`.
2. A unique `AUTH_SECRET` of at least 32 characters.
3. At least one provider API key.

Start development:

```bash
make dev
```

`make dev` starts PostgreSQL, runs the migration, and launches Next.js. In a
second terminal, run `make dev-backend` to start NestJS and serve the API. If you
need to prepare the database without launching Next.js,
run `make db-up` and `make db-migrate` individually.
The local PostgreSQL container uses `restart: "no"`, so starting Docker Desktop will not start it automatically. `make dev` still starts it explicitly.

## Run the application with Docker Compose

The repository has a `frontend/` (Next.js 16) and `backend/` (NestJS 12).
Business APIs are served by NestJS; local Docker routes browser traffic through
Nginx. Production remains on its previous topology until a separately authorized
deployment.

1. Copy `.env.docker.example` to `.env.docker`.
2. Set a local PostgreSQL password, set the same password in `DATABASE_URL`, create a local `AUTH_SECRET`, and optionally configure provider keys. URL-encode special characters in the `DATABASE_URL` password.
3. Run:

   ```bash
   make docker-up
   ```

The command builds both app images, starts PostgreSQL, runs the idempotent migrations, then starts the app. Open `http://localhost:8088` (Nginx routes `/api/` to NestJS). Useful commands:

| Command | Effect |
| --- | --- |
| `make docker-ps` | Show Compose service status |
| `make docker-logs` | Follow application logs |
| `make docker-down` | Stop/remove containers and network; preserve named volumes |

Compose binds app and PostgreSQL ports to localhost and sets `restart: "no"`; Docker Desktop startup will not automatically start these services. Starting the app explicitly with `make docker-up` will. Compose reuses the existing local PostgreSQL volume when run from this repository with its default project name.

## Useful commands

| Command | Effect |
| --- | --- |
| `make dev` | Start local development server; prepares database first |
| `make dev-backend` | Start the NestJS backend in watch mode |
| `make db-up` | Start PostgreSQL in Docker |
| `make db-migrate` | Apply the SQL migration files |
| `make docker-up` | Build and start the full local Docker Compose stack |
| `make docker-down` | Stop the Compose stack without deleting its data volume |
| `make docker-logs` | Follow the containerized app logs |
| `make docker-ps` | Show the Compose service status |
| `make lint` | Oxlint, dependency-cruiser checks, and frontend TypeScript |
| `make test` | Run frontend Vitest and backend unit tests |
| `make build` | Build and type-check the Next.js frontend |
| `make build-backend` | Build NestJS |
| `make deploy` | Build and deploy to the configured Serv00 host |

Oxlint is a linter, not a compiler. Next.js performs the production compilation in `make build`. There is no automated browser-test runner yet; see [the Playwright MCP E2E checklist](e2e-playwright-mcp.md).

## Code map and architecture

The target DDD/Clean Architecture, CQRS, API-contract, testing, and migration
conventions are specified in [architecture-conventions.md](architecture-conventions.md).
Use those rules for all backend capabilities. NestJS owns authentication,
agent-run persistence, patch downloads, and agent orchestration.

```text
frontend/
  package.json                 # Next.js app manifest and commands
  package-lock.json            # Frontend dependency lock
  app/                         # Next.js UI
  components/                  # Shared React UI
  features/auth/services/      # Frontend calls to the NestJS auth API
  lib/                         # Frontend utilities and API client
  tests/                       # Frontend unit/component tests
  vitest.config.mts            # Frontend test configuration
  app.js                       # Next.js server entrypoint
backend/
  package.json                 # NestJS 12 workspace manifest
  src/                         # NestJS API and DDD/Clean Architecture layers
  app.js                       # NestJS Passenger entrypoint
  scripts/migrate.mjs          # Ordered idempotent migration runner
infrastructure/
  backend/Dockerfile           # NestJS container
  compose.db.yml               # PostgreSQL for host-run development
  frontend/Dockerfile          # Next.js container
backend/migrations/            # Ordered, idempotent SQL migrations
scripts/
  deploy-serv00.sh             # Production build/sync/restart
docs/                           # Design and operational documentation
```

For host-run development, `make dev` starts Next.js and `make dev-backend` starts
NestJS independently on port `3001`. `.env.local` sets
`NEXT_PUBLIC_BACKEND_URL=http://localhost:3001`; the frontend then sends all API
requests directly to NestJS. For the integrated Docker setup, leave that URL
unset and use Nginx at `http://localhost:8088`.

## Database changes

Add a new, forward-only SQL file named with the next numeric prefix under `backend/migrations/`, then add it to the ordered list in `backend/scripts/migrate.mjs`. Prefer idempotent DDL (`IF NOT EXISTS`). Apply locally before deployment and document any manual production step.

The local Docker database uses port `55433`. The production Serv00 database is accessed by the deployed application from the host; local SSH port forwarding is unavailable in this setup.

## Provider configuration

`GROQ_MODEL` and `NVIDIA_MODEL` can override defaults for local experiments. Confirm a selected model is currently available to the configured account before changing the default. Keep output behavior compatible with the workflow:

- Orchestrator and Testing must return parseable JSON.
- Develop must return a unified diff matching the server allowlist.
- Responses must fit the configured per-role output token budget.

See [agent-workflow.md](agent-workflow.md) for failover and retry details.

## Troubleshooting

### Local database connection errors

```bash
docker compose --env-file .env.local -f infrastructure/compose.db.yml ps
make db-up
make db-migrate
```

Confirm the username, password, database, and port in `.env.local` match `infrastructure/compose.db.yml`.

### Missing or invalid provider key

Check locally that the expected variable is present, without printing its value. For example:

```bash
node --env-file=.env.local -e 'console.log(Boolean(process.env.GROQ_API_KEY || process.env.NVIDIA_API_KEY))'
```

Production variables must be provisioned separately on Serv00. A local key is not uploaded by the deployment script.

### Inconsistent Next.js `.next` output

Stop other Next.js processes before building. Run the build after the development server is stopped if the cache appears inconsistent. Avoid deleting user data or unrelated build/workspace directories as a troubleshooting shortcut.

### Failed agent run

Inspect the persisted run status, task details, result error, and provider logs. Do not interpret a generated diff as successful until the run reports approval and a human has reviewed it.
