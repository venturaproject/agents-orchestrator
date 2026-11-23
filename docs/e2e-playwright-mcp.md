# End-to-End Checks with the Playwright MCP

This guide describes a repeatable, human-operated browser acceptance pass using the Playwright MCP. It complements the automated Vitest suite; it is not a substitute for it.

## Safety and setup

1. Prefer local development at `http://localhost:3000` with the local Docker database.
2. Do not run generated-patch scenarios against production unless explicitly authorized. They call paid/rate-limited model APIs and create persistent run records.
3. Use a dedicated local test account. Public registration is intentionally disabled in the demo.
4. Do not include passwords, session cookies, API keys, or secret-bearing DevTools screenshots in MCP artifacts or reports.
5. Make sure the provider keys are configured locally before testing agent execution. The UI-only checks do not require a model call.

Start the local stack:

```bash
npm run dev
```

The `predev` hook starts local PostgreSQL and applies migrations.

## Playwright MCP interaction loop

Use the MCP's browser navigation, snapshot, click, fill, and evaluate tools. Capture a fresh accessibility snapshot after navigation and after significant state changes; element references can expire after rerenders.

Example tool sequence (tool names may vary slightly by MCP host):

1. Navigate to `http://localhost:3000`.
2. Capture the accessibility snapshot.
3. Interact by accessible role/name rather than brittle CSS selectors.
4. Capture the post-action snapshot and assert visible state.
5. Resize to desktop and mobile viewports and inspect overflow/layout.

Do not use browser evaluation to read or print `HttpOnly` cookies. Avoid screenshots containing account email addresses if they will be shared externally.

## Acceptance checklist

### Login and account controls

- [ ] Login page has a clear “Sign in to your workspace” heading.
- [ ] There is no sign-up link or account-creation form.
- [ ] Password field starts masked; the eye control toggles visibility and its accessible name changes.
- [ ] “Keep me signed in” can be selected and is sent as `rememberMe: true`.
- [ ] With the option off, the session cookie has no persistent `Max-Age`; with it on, it is persistent for 30 days. Inspect only cookie attributes, never copy the token value.
- [ ] A valid login enters the workspace; invalid credentials show an actionable error.
- [ ] `POST /api/auth/register` is unavailable (expected `404`).

### Language and appearance

- [ ] English and Spanish controls work on the login page.
- [ ] The selected language persists after reload and updates the document `<html lang>`.
- [ ] Signed-in account dropdown can switch English/Spanish and light/dark appearance.
- [ ] Language and appearance remain selected after reload.
- [ ] Core headings, navigation, statuses, empty states, and controls use the selected language.

### Header/sidebar account menu

- [ ] Header avatar opens an accessible account popover.
- [ ] Sidebar profile opens the same account controls.
- [ ] Popover exposes appearance, language, and sign-out actions.
- [ ] Escape and clicking outside close the popover.
- [ ] Sign-out clears the session and returns to the login page.

### Workspace and favicon

- [ ] Empty history and task state show useful empty-state copy, not fabricated run data.
- [ ] Dashboard counts reflect persisted runs/tasks.
- [ ] Favicon request for `/icon.svg` succeeds.
- [ ] Desktop layout (e.g. 1440 × 900) and mobile layout (e.g. 390 × 844) have no horizontal overflow.

### Agent workflow (provider-dependent)

Run this only when an end-to-end model call is appropriate:

- [ ] Submit a small, bounded UI-only request in the currently selected language.
- [ ] Confirm Orchestrator, Develop, and Testing progress updates appear.
- [ ] Confirm the resulting patch only contains allowed `app/**/*.tsx` or `app/**/*.css` paths.
- [ ] Confirm Testing output distinguishes the real TypeScript result from the model review.
- [ ] Confirm failed provider calls or invalid patches are shown as failures, not falsely reported as approved.
- [ ] If Testing rejects the change, observe a feedback round; do not expect more than three rounds.
- [ ] Download the patch and verify it is review-only; the deployed source must remain unchanged.
- [ ] Record provider/model, run outcome, and any rate-limit/API error without recording prompts containing sensitive data or any credentials.

## Recording results

For a reviewable acceptance record, capture:

- Date, browser and viewport
- Local or production environment (prefer local)
- Checklist items passed/failed
- Console/network errors with secret values redacted
- A screenshot of the UI only if it contains no private account information
- For an agent run, the final run status, changed file paths, TypeScript outcome, review outcome, and iteration count

Do not describe an agent run as passed solely because a patch was generated. A valid acceptance requires `passed: true`, a successful compiler check, a successful review, and human inspection of the patch.
