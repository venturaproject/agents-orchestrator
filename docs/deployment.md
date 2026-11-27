# Serv00 Deployment

Production deployment is deliberately separate from local verification. Nothing
in this guide has been executed against production as part of the migration.

## Target topology

| Role | Domain / process |
| --- | --- |
| Frontend | `demo.prostiner.serv00.net`, Node.js 26.12.1 Passenger, Next.js 16 |
| Backend API | `api.demo.prostiner.serv00.net`, Node.js 26.12.1 Passenger, NestJS 12 |
| Database | Existing PostgreSQL database on Serv00; keep the existing `app_users` data |
| Frontend directory | `/usr/home/prostiner/domains/demo.prostiner.serv00.net/public_nodejs` |
| Backend directory | `/usr/home/prostiner/domains/api.demo.prostiner.serv00.net/public_nodejs` |
| Agent workspace | A private writable directory outside both deployed source directories |
| SSH host | `s16.serv00.com` (alias `prostiner-serv00` for local deploys) |

Both services now use Node.js 26.12.1 in Passenger. The API was changed from
22.23.4 to 26.12.1 and restarted after the NestJS 12 build and tests passed on
that version. CI and Docker use 26.12.1 for both apps. The API subdomain was previously provisioned as
a proxy to reserved port `27087`; before using the Passenger deployment workflow,
change that site to **Node.js** type and configure its entrypoint as
`public_nodejs/app.js`. Keep the port reservation until the conversion and API
health check are complete; this repository does not change Serv00 configuration.
The frontend site's Passenger entrypoint is `public_nodejs/app.js`.

The browser calls the API at `https://api.demo.prostiner.serv00.net`. Cookies
must be shared by both subdomains using `SESSION_COOKIE_DOMAIN=.prostiner.serv00.net`.
Nest CORS and state-changing origin validation must allow exactly
`https://demo.prostiner.serv00.net`.

## Backend environment

Provision a separate `.env.production` inside the API site's `public_nodejs`
directory. Restrict it to the application account (`chmod 600`). It is not
committed or copied from this repository:

```dotenv
NODE_ENV=production
DATABASE_URL=postgresql://...
AUTH_SECRET=<unique secret of at least 32 characters>
FRONTEND_ORIGIN=https://demo.prostiner.serv00.net
SESSION_COOKIE_DOMAIN=.prostiner.serv00.net
FRONTEND_APP_ROOT=/usr/home/prostiner/domains/demo.prostiner.serv00.net/public_nodejs
AGENT_WORKSPACE_ROOT=/usr/home/prostiner/domains/demo.prostiner.serv00.net/agent-workspaces
GROQ_API_KEY=<optional if NVIDIA is configured>
GROQ_MODEL=openai/gpt-oss-20b
NVIDIA_API_KEY=<optional if Groq is configured>
NVIDIA_MODEL=nvidia/nemotron-3-nano-omni-30b-a3b-reasoning
```

At least one provider key is required for agent execution. Use the same existing
`DATABASE_URL` and `AUTH_SECRET` contract as the current account/session data.
The deploy process never prints or uploads these values. The backend Passenger
entrypoint loads this file before Nest starts. The frontend receives only the
public API URL at build time; it does not receive database or provider secrets.

## Pre-deploy checklist

Before the first production release:

1. Confirm both domain directories exist and both sites use Node.js 26.12.1 Passenger.
2. Reconfigure the existing API proxy site to Node.js Passenger and set its app
   directory/entrypoint to the API domain's `public_nodejs/app.js`.
3. Confirm valid TLS for both domains and verify the API subdomain resolves.
4. Move server-only values from the previous frontend deployment environment into
   the API site's `.env.production` using a server-side secure procedure. Preserve
   a protected backup first; do not print or copy values to a workstation. Remove
   database/provider/session secrets and workspace paths from the frontend
   `.env.production` and Passenger environment so the UI process no longer receives
   backend credentials.
5. Provision the backend `.env.production` above with restrictive permissions.
6. Confirm `FRONTEND_APP_ROOT` and `AGENT_WORKSPACE_ROOT` exist and are writable
   only where required. The backend needs read access to the frontend and write
   access only to the workspace directory.
7. Take a database backup using the approved Serv00 procedure. The deployment
   does not recreate users or replace the database.
8. Confirm the production schema already contains the current idempotent
   migrations. The deploy script deliberately does not run migrations.
9. Configure the GitHub Actions secrets listed below, or use the local SSH
   alias. Validate the Serv00 SSH host fingerprint through a trusted channel.

The migration leaves the SQL model and existing `app_users` rows intact; no schema
migration is needed for the frontend/backend split.

## Deploy

The deploy command builds and verifies both applications, syncs frontend and
backend to their separate Passenger directories, installs production
dependencies, restarts the backend, checks `/api/health`, then restarts the
frontend and performs an HTTP smoke check on `/`:

```bash
make deploy
```

For a local deploy, `prostiner-serv00` must be configured in SSH. The optional
environment variables `SERV00_SSH_TARGET`, `SERV00_SSH_KEY_FILE`,
`SERV00_FRONTEND_DOMAIN`, and `SERV00_BACKEND_DOMAIN` can override the defaults.
The workflow builds the frontend with
`NEXT_PUBLIC_BACKEND_URL=https://api.demo.prostiner.serv00.net`.

The script requires the backend environment file and checks that required
variables are present without printing their values. It never runs a production
migration, deletes the existing database, or syncs `.env*` files. If the API
health check fails, it does not restart the frontend; if the frontend smoke check
fails, the deployment exits non-zero for operator follow-up.

## GitHub Actions deployment

- `CI` runs lint/type checks, architecture checks, tests, and both builds on pull
  requests and pushes to `main`.
- `Deploy production` is manual (`workflow_dispatch`), only deploys `main`, and
  repeats verification before invoking the same dual-service deploy script.
- Required Actions secrets: `SERV00_SSH_PRIVATE_KEY` and verified
  `SERV00_KNOWN_HOSTS`. The workflow uses the `production` environment; configure
  required reviewers there if an approval gate is desired.
- The workflow does not provision domains, TLS, environment files, or database
  backups. It does not deploy pull requests or run on every push.

Do not run this workflow until every pre-deploy item is verified and a production
deployment is explicitly authorized.

## Database migrations

Forward-only, idempotent migrations live in `backend/migrations/` and are applied
by `backend/scripts/migrate.mjs`. The current schema is:

- `001_initial.sql` — `app_users`, `agent_runs`, ownership index
- `002_agent_results.sql` — persisted JSONB `result`

Apply any future production migration through the approved database procedure
before deploying code that depends on it. Never edit a migration already applied
to production.

## Operational limitations

- No automatic rollback is implemented. Preserve a known-good release/backup
  before deployment.
- Each agent run creates a temporary workspace and attempts cleanup in `finally`;
  abrupt termination can leave stale directories.
- Agent orchestration and provider failover run in-process; there is no durable
  queue or distributed circuit breaker.
- Direct SSH database port forwarding is unavailable in the current environment.
