# Repository Instructions for Coding Agents

These instructions apply to the whole repository. Read the linked design documents before changing authentication, persistence, inference, sandboxing, or deployment behavior.

## Project purpose

Crew is a review-first AI development workbench. Its runtime agents plan frontend work, propose patches in disposable workspaces, and review those patches. Runtime-generated changes must not be applied to the production application.

## Repository map

- `app/` — Next.js App Router pages, UI, and HTTP route handlers
- `lib/` — database, session, provider failover, and isolated workspace helpers
- `migrations/` — forward-only, idempotent PostgreSQL schema changes
- `scripts/` — migration and Serv00 deployment commands
- `docs/` — architecture, workflow, security, operations, and decisions
- `AGENTS.md` — repository-wide agent guidance

## Required practices

1. **Protect secrets.** Never print, commit, or copy values from `.env.local` or `.env.production` into source, logs, or documentation. Keep `.env.example` limited to placeholders.
2. **Preserve the sandbox boundary.** Runtime-generated diffs must remain restricted to the allowlisted UI paths in `lib/agent-workspace.ts`. Do not widen the allowlist to API routes, authentication, configuration, dependencies, or deployment files without an explicit security review.
3. **Keep the human in control.** The runtime workflow may persist and serve a proposed diff, but must not merge it, deploy it, or apply it to the live source tree.
4. **Make database changes forward-only.** Add an idempotent migration and update the migration runner when adding schema changes. Do not edit a migration that has already been applied to production.
5. **Keep API ownership checks.** Every read or write of a run must remain scoped to the authenticated user. Preserve same-origin checks on state-changing routes.
6. **Be precise about verification.** `npm run lint` runs Oxlint on `app/`, `lib/`, and `tests/`, then TypeScript (`tsc --noEmit`). Oxlint is a linter, not a compiler. Do not claim runtime or browser tests unless they were actually run.
7. **Update documentation with behavior.** Provider names, model defaults, circuit-breaker thresholds, sandbox limits, deployment steps, and known limitations must agree with code.
8. **Avoid unrelated changes.** Inspect existing code and user changes before editing. Do not reset, discard, or overwrite unrelated work.
9. **Deployment is an explicit operation.** Do not deploy or modify remote production configuration unless the user requests it.

## Before handing work back

Run the relevant checks:

```bash
npm run lint
npm test
npm run build
```

For database changes, also run the local migration. For provider or agent changes, test provider behavior without printing credentials, and report clearly if a full end-to-end run could not be completed. Use the [Playwright MCP E2E checklist](docs/e2e-playwright-mcp.md) for manual browser acceptance.

## Design references

- [System architecture](docs/architecture.md)
- [Agent workflow](docs/agent-workflow.md)
- [Security model](docs/security.md)
- [Development guide](docs/development.md)
- [Deployment guide](docs/deployment.md)
- [Architecture decisions](docs/decisions.md)
