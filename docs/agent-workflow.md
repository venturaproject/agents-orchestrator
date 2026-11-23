# Agent Workflow and Provider Resilience

## Roles

| Agent | Input | Output | Responsibility |
| --- | --- | --- | --- |
| **Orchestrator** | User request and candidate UI file list | Summary, 1–4 tasks, 1–3 target files | Break the request into a bounded plan |
| **Develop** | Request, plan, target file contents, prior feedback | Unified diff | Implement only within the selected UI files |
| **Testing** | Request, plan, diff, actual TypeScript result | Pass/fail, summary, corrective feedback | Review requirements and code independently |

The labels describe separate prompts and responsibilities; the roles are calls to a configured language model, not separate processes or independently hosted models.

## Run lifecycle

`POST /api/agents` accepts a persisted `runId`, not an arbitrary source tree. It verifies same-origin and session ownership before calling a provider. Each progress update is written to PostgreSQL and scoped by both run ID and user ID.

### Planning

- Orchestrator sees a list of files under `app/`, excluding API routes and `layout.tsx`.
- Its target paths are validated against the UI allowlist.
- If the required target file list is missing or malformed, the planner is asked to repair the plan once.

### Patch generation and sandbox checks

- Develop receives at most three target files with a bounded context size.
- Allowed changes are `.tsx` and `.css` files under `app/`, excluding `app/api/**` and `app/layout.tsx`.
- The API permits at most two generation attempts for a malformed or disallowed patch per iteration.
- The server checks the patch path and structure, then uses `git apply --check` and `git apply` in the temporary workspace.
- `tsc --noEmit` compiles the copy; the generated application code is not launched.
- The resulting diff is stored and made available to the run owner as a downloadable `.patch`.

### Testing feedback loop

Testing receives the actual compiler result. Approval requires both a passing TypeScript check and an affirmative review. Rejected work is sent back to Develop, with a maximum of three full review rounds. At the limit, the run is marked failed and the latest diff and feedback remain visible for human inspection.

## Provider routing

The provider adapter is `lib/llm-provider.ts`.

| Order | Provider | Default model | API |
| --- | --- | --- | --- |
| Primary | Groq | `openai/gpt-oss-20b` | `https://api.groq.com/openai/v1/chat/completions` |
| Fallback | NVIDIA NIM | `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` | `https://integrate.api.nvidia.com/v1/chat/completions` |

Both providers use OpenAI-compatible Chat Completions payloads. For the NVIDIA Nemotron model, the adapter sets `chat_template_kwargs.enable_thinking=false` so reasoning tokens do not consume the response budget intended for the agent output.

### Failover and circuit breaker

1. A configured Groq key makes Groq the primary; NVIDIA is optional. NVIDIA alone is supported if Groq is not configured.
2. HTTP errors, timeouts, network failures, or empty model responses count as provider failures.
3. A failed primary request falls back to the next configured provider for that same agent call.
4. After two consecutive failures for a provider in the current Node.js process, its circuit opens for 60 seconds.
5. While Groq's circuit is open, NVIDIA is tried first. Once the interval expires, the next request probes Groq again.
6. A successful request resets that provider's failure counter and circuit state.
7. HTTP 429 responses are retried up to two times using the provider's suggested delay when available; after that, failover is attempted.

Circuit state is in memory, so each Serv00 process has its own breaker. It is not a distributed rate limiter. Logs identify provider failure and fallback transitions but must never include API keys or prompt contents.

## Trust and human review

- Model output is untrusted. Paths are validated before patch application.
- The runtime agent cannot modify API handlers, authentication, database code, dependencies, configuration, or deployment scripts.
- The sandbox copy is deleted when the request finishes; process termination can leave stale copies for manual cleanup.
- A proposed patch is never applied to the deployed source tree. The user downloads and reviews it.
- `Testing` is an LLM review, not a formal proof or a replacement for human code review.

## Verification and known limitations

Verified:

- Provider credentials are read from environment variables and are never sent to the browser.
- The NVIDIA endpoint/model responded successfully.
- A controlled invalid-Groq-key test caused the provider adapter to use NVIDIA and receive a response.
- TypeScript checks and the production build pass.

Not yet verified as a repeatable acceptance test:

- A complete Orchestrator → Develop → Testing run ending in `passed: true`.
- Runtime behavior or visual quality of a generated patch.
- Multi-process circuit-breaker behavior.

Previous live smoke runs encountered rate limits and malformed/out-of-scope model diffs. The workflow persists errors and rejects unsafe diffs, but those safeguards do not guarantee generated output quality.
