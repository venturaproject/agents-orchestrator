# Security and Trust Boundaries

This document describes the current controls and the remaining risks. It is not a security certification.

## Assets and boundaries

| Asset | Boundary / control |
| --- | --- |
| Provider API keys and database credentials | Server environment only; `.env*` excluded from Git and deployment sync |
| User passwords | Salted `scrypt` hashes stored in PostgreSQL |
| Session | Signed HS256 token in `HttpOnly`, `SameSite=Lax`, `Secure`-in-production cookie |
| Run history and patches | Every API read/write is scoped to the authenticated owner |
| Production source tree | Never writable by the runtime agent |
| Temporary source copy | Per-run directory; file allowlist, Git patch validation, cleanup in `finally` |

## Authentication and request protections

- Public registration is disabled for the demo. Existing accounts can sign in; account creation is an administrative operation.
- Password hashes use a random salt and Node.js `scrypt`; login comparison uses `timingSafeEqual`.
- Sessions are signed with `AUTH_SECRET` (minimum 32 characters). They expire after 12 hours by default; “Keep me signed in” extends the token and persistent cookie to 30 days.
- State-changing auth and run APIs require a same-origin request.
- Run IDs are validated and database queries use parameterized values.
- Run reads, status updates, and patch downloads require session ownership.
- NestJS verifies the existing `crew_session` HS256 token using `AUTH_SECRET`.
  Credentialed CORS and state-changing origin checks use explicit
  `FRONTEND_ORIGIN` values. Production must use the frontend HTTPS origin and a
  parent cookie domain shared with the API subdomain.

## Agent patch boundary

The runtime workflow is intentionally not a general-purpose shell agent:

- It accepts a run ID associated with the authenticated user; it does not accept a local path.
- Orchestrator selects limited UI paths under `frontend/app/`.
- Patch validation allows only TSX/CSS UI files and rejects API routes, layout, traversal, mode changes, renames, and binary patches.
- Patches are checked and applied only inside a copied workspace.
- The workflow invokes Git and the TypeScript compiler; it does not start the generated application.
- The generated diff is returned to the user for review and is not automatically deployed.

The workspace is **not** an OS-level sandbox. It shares the application's Node.js runtime and dependencies (inside the app container when using Docker). Do not treat it as safe for arbitrary untrusted code execution or broaden the patch/command permissions without a stronger isolation design (for example, a restricted container or disposable VM).

## Provider keys and deployment secrets

- Use `.env.local` for local secrets. It is ignored by Git.
- Store production values only in the remote `.env.production`, with restrictive file permissions (`600`).
- The deployment script excludes `.env*` files from `rsync`.
- Never add a real key to `.env.example`, documentation, screenshots, test output, or logs.
- Rotate any key that has accidentally been disclosed.

## Known security gaps

The current prototype does not include:

- Login/registration rate limiting or account lockout
- Email verification, password reset, MFA, or session revocation
- A persistent/distributed circuit breaker or inference quota accounting
- A hardened OS/container sandbox for model-generated code
- Automated dependency, SAST, or DAST scanning in CI

These limitations should be addressed before using the application for sensitive code or production engineering workflows.
