# Development Guide

## Prerequisites

- Node.js 20+
- npm
- Docker Desktop / Docker Engine with Compose
- A Groq API key, an NVIDIA NIM API key, or both

## Setup

```bash
npm install
cp .env.example .env.local
```

Edit `.env.local` and provide:

1. A local `DATABASE_URL` matching `compose.db.yml`.
2. A unique `AUTH_SECRET` of at least 32 characters.
3. At least one provider API key.

Start development:

```bash
npm run dev
```

`predev` runs `npm run db:up` and `npm run db:migrate`. If you need to prepare the database without launching Next.js, run those commands individually.

## Useful commands

| Command | Effect |
| --- | --- |
| `npm run dev` | Start local development server; prepares database first |
| `npm run db:up` | Start PostgreSQL in Docker |
| `npm run db:migrate` | Apply the SQL migration files |
| `npm run lint` | Run Oxlint on `app/`, `lib/`, and `tests/`, then `tsc --noEmit` |
| `npm test` | Run unit/component tests with Vitest |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run build` | Build and type-check the production application |
| `npm run deploy:serv00` | Build and deploy to the configured Serv00 host |

Oxlint is a linter, not a compiler. Next.js performs the production compilation in `npm run build`. There is no automated browser-test runner yet; see [the Playwright MCP E2E checklist](e2e-playwright-mcp.md).

## Code map

```text
app/
  api/
    agents/route.ts            # Agent workflow coordinator
    auth/                      # Register, login, session, logout
    runs/                      # Run persistence and patch download
  page.tsx                     # Main client workspace
  globals.css                  # Application styles and themes
lib/
  agent-workspace.ts           # Copy, allowlist, patch, type-check, cleanup
  db.ts                        # PostgreSQL pool
  llm-provider.ts              # Groq/NVIDIA router and circuit breaker
  session.ts                   # Signed cookie sessions and origin validation
migrations/                    # Ordered, idempotent SQL migrations
scripts/
  deploy-serv00.sh             # Production build/sync/restart
  migrate.mjs                  # Local migration runner
docs/                           # Design and operational documentation
```

## Database changes

Add a new, forward-only SQL file named with the next numeric prefix, then add it to the ordered list in `scripts/migrate.mjs`. Prefer idempotent DDL (`IF NOT EXISTS`). Apply locally before deployment and document any manual production step.

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
docker compose --env-file .env.local -f compose.db.yml ps
npm run db:up
npm run db:migrate
```

Confirm the username, password, database, and port in `.env.local` match `compose.db.yml`.

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
