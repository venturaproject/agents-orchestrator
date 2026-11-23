# Serv00 Deployment

## Production topology

- Domain: `demo.prostiner.serv00.net`
- Runtime: Node.js application managed by Passenger
- Entrypoint: `app.js`
- Database: PostgreSQL hosted by Serv00
- TLS: Let's Encrypt certificate managed through Serv00
- Remote app directory: `/usr/home/prostiner/domains/demo.prostiner.serv00.net/public_nodejs`
- Workspace root: `/usr/home/prostiner/domains/demo.prostiner.serv00.net/agent-workspaces`
- SSH alias used by scripts: `prostiner-serv00`

No credential values belong in this document or in the repository.

## Required production environment

The remote `.env.production` must contain:

```dotenv
NODE_ENV=production
DATABASE_URL=postgresql://...
AUTH_SECRET=<unique production secret, at least 32 characters>
GROQ_API_KEY=<optional if NVIDIA is configured>
GROQ_MODEL=openai/gpt-oss-20b
NVIDIA_API_KEY=<optional if Groq is configured>
NVIDIA_MODEL=nvidia/nemotron-3-nano-omni-30b-a3b-reasoning
AGENT_WORKSPACE_ROOT=/usr/home/prostiner/domains/demo.prostiner.serv00.net/agent-workspaces
```

At least one provider key is required. Set file permissions to `600` and the containing workspace directory to be accessible only to the app account.

## Deploy

The deploy script (`scripts/deploy-serv00.sh`):

1. Confirms that the remote `.env.production` exists.
2. Builds locally with `npm run build`.
3. Syncs the application using `rsync`, excluding `.env*`, `.git`, `node_modules`, and local-only directories.
4. Runs `npm ci --omit=dev` remotely.
5. Restarts the Serv00 Node.js application with `devil www restart`.

Run:

```bash
npm run deploy:serv00
```

The deployment script does not provision secrets and does not apply the SQL migrations to production. Apply required migrations using the approved database access procedure before deploying code that depends on them.

## GitHub Actions deployment

The repository includes:

- `CI` — runs lint/type-check, Vitest, and the production build for pull requests and pushes to `main`.
- `Deploy production` — manually deploys the selected `main` revision after the same checks pass. It does not deploy pull requests or run on every push.

The deployment workflow uses GitHub-hosted Ubuntu runners and does not perform `git pull` on Serv00. It builds a fresh artifact, syncs source/build output while excluding `.env*` and local state, installs production dependencies remotely, then restarts Passenger. It never prints or transfers the remote `.env.production`.

### Configure deployment credentials

Create a dedicated SSH key for GitHub Actions rather than reusing a personal SSH key. The private key belongs in GitHub Actions secrets only; install the matching public key in the Serv00 account's `~/.ssh/authorized_keys`.

Add these repository secrets under **Settings → Secrets and variables → Actions** (preferably scoped to the `production` environment):

| Secret | Value |
| --- | --- |
| `SERV00_SSH_PRIVATE_KEY` | Dedicated deploy private key, including its PEM/OpenSSH header and footer |
| `SERV00_KNOWN_HOSTS` | Verified `known_hosts` entry for `s16.serv00.com` |

Verify the SSH host fingerprint against Serv00's trusted documentation or support before adding it. Do not use `ssh-keyscan` output without validating the fingerprint out of band. The workflow currently targets the Serv00 account and application directory shown in the production topology above.

Then run **Actions → Deploy production → Run workflow**, selecting `main`. To add a human approval gate, configure required reviewers for the `production` environment in the repository settings. Keep deployment manual until the workflow has been validated; only then consider automatic deployment after protected merges to `main`.

The workflow intentionally does not run migrations. Any future schema migration must be applied through the approved production database procedure before deploying dependent code.

## Database migrations

Migrations are idempotent SQL files in `migrations/`. `scripts/migrate.mjs` applies the ordered list for local development. The current production schema includes:

- `001_initial.sql` — `app_users`, `agent_runs`, ownership index
- `002_agent_results.sql` — persisted JSONB `result`

For future migrations, add the new SQL filename to the runner and run it against production before the dependent deployment. Do not edit an already-applied migration.

## Operational notes

- Local development uses Docker PostgreSQL; direct SSH port forwarding to the hosted database is blocked in this environment.
- The deployed application connects to PostgreSQL from Serv00.
- `.env.production` is not part of the synced application payload.
- Each agent run creates a temporary workspace and attempts cleanup in a `finally` block. After an abrupt process termination, inspect and clean stale run directories deliberately.
- There is no automated rollback mechanism in the deploy script. Preserve a known-good deployment artifact or backup before production changes.
