# Architecture and Coding Conventions

These conventions define how current and future code is organized. The business
API migration from Next.js route handlers to NestJS is complete; Next.js now owns
the UI and calls the backend over HTTP.

## Architectural goals

- `frontend/` owns presentation, browser interaction, and calls to the backend API.
- `backend/` owns application use cases, business rules, authentication, persistence,
  inference, and integrations.
- Backend dependencies point inward:

  ```text
  Infrastructure -> Application -> Domain
  ```

- Domain code is independent of NestJS, HTTP, PostgreSQL, and third-party SDKs.
- Keep the architecture proportional to the demo. Do not add microservices, event
  sourcing, generic frameworks, or abstraction layers without a concrete need and
  an Architecture Decision Record (ADR).

## Target repository layout

```text
frontend/
├── app/                           # Next App Router: routes/layouts/composition
│   └── api/                       # No business API handlers; NestJS owns API routes
├── features/
│   └── <feature>/
│       ├── components/            # Feature UI
│       ├── hooks/                 # Feature client hooks
│       ├── schemas/               # Frontend form/input schemas
│       ├── services/              # Calls to backend contracts
│       └── types/                 # Feature-local view and API types
├── shared/
│   ├── components/                # Reusable UI without feature business rules
│   ├── lib/                       # Formatting, browser-safe helpers
│   └── types/
├── lib/                           # Browser-safe utilities and shared API client
├── tests/
├── package.json
└── package-lock.json

backend/
├── src/
│   ├── domain/
│   │   └── <bounded-context>/
│   │       ├── entities/
│   │       ├── value-objects/
│   │       ├── events/
│   │       ├── ports/             # Repository/service contracts
│   │       └── errors/
│   ├── application/
│   │   └── <bounded-context>/
│   │       ├── commands/
│   │       ├── queries/
│   │       ├── ports/             # Use-case-owned integration contracts, if needed
│   │       └── dto/               # Application input/output models, not HTTP DTOs
│   └── infrastructure/
│       ├── http/                  # Nest controllers, guards, pipes, HTTP DTOs
│       ├── persistence/           # SQL/ORM adapters and domain mappers
│       ├── providers/             # Groq, NVIDIA, and other external adapters
│       └── modules/               # Nest dependency wiring / composition root
├── migrations/
├── test/
├── package.json
└── package-lock.json

infrastructure/
├── backend/
├── frontend/
└── compose.db.yml
```

This is the current boundary, not a requirement to create empty directories.
Keep each bounded context small and introduce subfolders only when they contain
real code.

## Backend: DDD and Clean Architecture

### Domain layer

The Domain owns business meaning and invariants:

- Model identity and lifecycle with entities and value objects.
- Keep invariants next to the domain state they protect; do not rely on controllers
  or database constraints as the only business validation.
- Define repository ports in the domain when they represent aggregate persistence.
- Use domain services only when a rule genuinely spans multiple domain objects and
  does not naturally belong to one entity.
- Domain events describe meaningful business facts. They are not a general-purpose
  notification mechanism.
- Do not import NestJS, `pg`, ORM packages, HTTP types, environment access, or
  provider SDKs into Domain.
- Avoid anemic data bags when behavior and invariants belong on the model. Do not
  force behavior onto entities that have no meaningful domain rules.

### Application layer

Application coordinates use cases; it does not implement transport or persistence:

- One use case handles one meaningful application operation.
- Commands represent requested state changes; queries represent reads.
- Application code may depend on Domain contracts and application-owned ports, but
  never on Infrastructure implementations.
- Enforce authorization that depends on application state here (for example,
  verifying a run belongs to the authenticated user), not only in the UI.
- Put transaction boundaries around a complete use case when atomicity is required.
- Keep input/output models explicit. Do not pass Nest request objects, SQL rows,
  ORM entities, or provider SDK responses through the application boundary.

### Infrastructure layer

Infrastructure adapts external mechanisms to inward-facing contracts:

- Nest controllers translate HTTP requests into application inputs and map results
  to HTTP responses. They do not contain business rules or SQL.
- Guards handle transport-level authentication; use cases still enforce
  resource-level ownership and authorization.
- Repository adapters implement ports and map database records to/from domain
  models. Database schemas and ORM decorators stay here.
- Provider adapters encapsulate model APIs, timeouts, retries, and provider-specific
  payloads. Application code depends on a port, not Groq/NVIDIA clients.
- Nest modules are the composition root: bind tokens/ports to concrete adapters
  here. Do not instantiate infrastructure classes manually in Domain/Application.
- Map known application/domain errors to stable HTTP status codes in one HTTP
  boundary; never return SQL errors, stack traces, secrets, or provider internals.

### Dependency rules

Allowed:

```text
domain       -> domain
application  -> application, domain
infrastructure -> application, domain, framework/driver packages
```

Forbidden:

```text
domain       -X-> application, infrastructure, NestJS, database, external SDKs
application  -X-> infrastructure implementations, HTTP, database/ORM, SDKs
frontend     -X-> backend source imports, database, provider credentials/SDKs
```

Share API contracts through documented HTTP schemas/types or generated clients;
do not import backend implementation files into the frontend. Avoid circular
dependencies between bounded contexts. Coordinate contexts through identifiers,
application ports, or explicit events—not by reaching into another context's
repositories or entities.

## CQRS conventions

Use CQRS to make read and write intent explicit, not to introduce distributed
systems:

- A **command** changes state and has one handler/use case. It may return a small
  result needed by the caller, but it is not a query.
- A **query** reads state and must not cause business state changes.
- Keep command and query inputs/results separate. A read model may be shaped for
  the screen and need not be the aggregate/entity shape.
- A command handler owns the use-case flow and delegates persistence/integrations
  through ports. A query handler uses a read-oriented port/adapter where useful.
- Use the Nest CQRS bus only when dispatch/handler registration benefits the
  application. Keep Nest-specific decorators and buses out of Domain; if a bus is
  used, place the framework bridge at the Infrastructure boundary.
- CQRS here does **not** mean event sourcing, separate databases, eventual
  consistency, or a message broker. Add those only through an ADR backed by a
  concrete requirement.
- Do not create one-command-per-line wrappers for trivial behavior. A use case
  should represent an application operation with a meaningful boundary.

Suggested feature layout:

```text
backend/src/
├── domain/agent-run/
│   ├── entities/agent-run.ts
│   ├── value-objects/run-status.ts
│   └── ports/agent-run.repository.ts
├── application/agent-run/
│   ├── commands/start-agent-run.command.ts
│   ├── commands/start-agent-run.handler.ts
│   ├── queries/get-agent-run.query.ts
│   └── queries/get-agent-run.handler.ts
└── infrastructure/
    ├── http/agent-runs/agent-runs.controller.ts
    ├── persistence/postgres/agent-run.repository.ts
    └── modules/agent-runs.module.ts
```

If Nest CQRS decorators are used, put decorated bus handlers in
`infrastructure/cqrs/` and have them delegate to application use cases. The example
file names describe responsibilities; adapt them if a context needs a simpler
shape.

## Frontend conventions

- `frontend/app/` is the route tree and composition layer. Keep pages/layouts thin:
  load data, compose feature components, and define navigation/metadata.
- Put feature behavior in `frontend/features/<feature>/`; put truly generic,
  business-neutral UI and helpers in `frontend/shared/`.
- A feature must not reach into another feature's private files. Expose a small
  public entry point when cross-feature reuse is genuinely needed.
- Prefer Server Components by default. Add `"use client"` only for interactive
  components that need browser state, effects, or event handlers.
- Call backend APIs through feature services or a shared API client. Keep base URLs,
  credentials/cookie behavior, response decoding, and transport errors in that
  boundary rather than scattering `fetch` details through components.
- Frontend schemas validate user input for usability; backend validation remains
  authoritative. Never treat frontend validation as authorization.
- Never put database access, provider keys, password hashing, session signing, or
  business-critical ownership decisions in browser code.
- Do not add business APIs to Next.js. The browser calls NestJS directly in host
  development and through the same-origin Nginx `/api/` proxy in Docker.

## HTTP contracts, errors, and security

- Use resource-oriented, versionable HTTP routes and explicit request/response
  schemas. Keep internal entities and database column names out of public responses.
- Validate path, query, and body input at the HTTP boundary; apply domain validation
  again where invariants require it.
- Preserve same-origin/CSRF protections for cookie-authenticated state changes.
- Derive the authenticated principal from verified server-side credentials; never
  accept an owner/user ID as proof of identity from the browser.
- Scope every read/write of an agent run by authenticated owner. Keep this invariant
  in application use cases, even if guards/controllers also check access.
- Return stable error codes/messages safe for clients. Log useful operational
  context but never secrets, authorization headers, full prompts, or sensitive
  personal data.
- Keep CORS origins explicit per environment. Do not use wildcard origins with
  credentialed requests.

## Persistence and migrations

- Backend owns PostgreSQL access. New Nest use cases must not access the database
  directly from controllers or frontend code.
- Keep SQL/ORM implementation and row mapping in Infrastructure. Do not expose
  persistence entities outside that boundary.
- Add forward-only, idempotent migrations under `backend/migrations/` and register
  them with the migration runner until migration execution is fully owned by Nest.
- Never edit a migration already applied to a shared/production database. Add a
  corrective migration instead.
- Keep queries parameterized. Add indexes/constraints based on access patterns and
  domain invariants; document non-obvious decisions.

## Testing and quality gates

For each new use case, add:

1. Domain unit tests for invariants and value objects.
2. Application tests for command/query behavior using fake ports, including
   authorization and failure cases.
3. Infrastructure integration tests for database/HTTP/provider adapters where
   their behavior is important.
4. API/contract tests when frontend and backend behavior changes together.

Frontend feature tests should cover user-visible behavior and service error/loading
states. Avoid tests that only assert implementation details. Keep network and
database calls out of unit tests; use explicit integration tests for them. A green
TypeScript build is not evidence that HTTP, database, or browser behavior works.

Run `make architecture-check` to enforce backend dependency direction/no cycles
and frontend feature/shared boundaries with dependency-cruiser. `make lint` also
runs these checks after Oxlint and TypeScript. Use Oxlint for fast static source
analysis; it complements, but does not replace, TypeScript or architecture checks.
Before merging architectural changes, run `make lint`, `make test`, `make build`,
and `make build-backend`, plus relevant integration/E2E checks. Do not claim checks
that were not run.

## Migrating a legacy Next.js API capability

Move capabilities one at a time:

1. Identify the current route, ownership/security checks, persistence, and response
   contract. Read `docs/security.md` and the relevant workflow docs first.
2. Add the Nest domain/application/infrastructure implementation and tests while
   preserving existing behavior and ownership boundaries.
3. Introduce/update the HTTP contract and point only that frontend feature to Nest.
4. Run tests/builds and verify cookies, CORS, errors, and owner scoping end to end.
5. Remove the old Next.js handler only after no caller depends on it and the
   replacement has been verified.
6. Update `docs/architecture.md`, security/deployment docs, and migration status.
   Production deployment remains a separate, explicitly authorized action.

## Review checklist

- [ ] Does business logic live in Domain/Application rather than a controller,
  React component, SQL adapter, or provider adapter?
- [ ] Do dependencies point inward? Is the Domain free of framework/driver imports?
- [ ] Are writes commands and reads queries, without accidental CQRS/event-sourcing
  overengineering?
- [ ] Are authentication, owner scoping, same-origin/CORS, and input validation
  enforced on the server?
- [ ] Are persistence/provider failures translated to safe, stable errors?
- [ ] Are migrations forward-only and registered?
- [ ] Are unit/integration/contract tests appropriate to the changed boundary?
- [ ] Are docs and deployment assumptions updated without claiming unfinished
  migrations?
