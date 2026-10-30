# Agent Office observation backend (local, opt-in)

This is an **observation channel**, not an autonomous agent runtime. It never calls Magpie or a model, launches Claude/Codex/DSH, executes shell commands, edits files, or dispatches tasks. A real external agent must explicitly report events through HTTP or the MCP adapter. Reported completion is a claim by that authenticated reporter, not independently verified success. All model routing remains pending official Magpie endpoint/protocol/model configuration and authorization.

## Local launch

Requires Node 22+ and `npm ci`; run `npm run build` first. Configure secrets in your process environment or a secret manager, not a tracked file:

- `OFFICE_VIEWER_TOKEN`: unique 32–256 non-whitespace characters, read-only viewer credential.
- `OFFICE_AGENT_TOKENS`: JSON object with distinct secret strings for `supervisor`, `planner`, `coder`, `reviewer`; each token only writes/reads its own role.
- `OFFICE_HOST`: defaults to `127.0.0.1`; only this or `::1` is accepted.
- `OFFICE_PORT`: defaults to `8787`.

`npm run office:server` serves the built static UI and private API at the same loopback origin. Open `http://127.0.0.1:8787/` (or `[::1]` if configured), then enter the viewer token explicitly in the UI. No credentials are generated, saved, logged or embedded into the bundle. Do not paste credentials in tickets, chat, URLs or screenshots. The public static demo is separate: its live controls cannot work without this private API.

**No public deployment is configured.** The host/origin allowlist intentionally rejects reverse-proxy domain requests. Remote access, HTTPS, sessions/access controls, credential rotation and reviewed proxy configuration are future work, not a reason to bind this server to `0.0.0.0`. Public static hosting must never be given backend credentials or private events.

## HTTP contract (schemaVersion 1)

All `/api/*` requests require `Authorization: Bearer <credential>`. No query-token auth, cross-origin access or redirects. JSON writes capped at 8192 bytes. All responses `Cache-Control: no-store`.

- `GET /api/snapshot`: viewer receives four agents + latest 200 events; agent credential receives only its own state/events.
- `GET /api/events`: viewer-only SSE `snapshot` messages, immediate then on changes and every 5 seconds; capped 10 streams, slow readers disconnected. Reconnect starts with complete latest snapshot; not an archival replay stream.
- `POST /api/events`: agent-only event `{eventId,runId,sequence,type,status,message?,progress?}`. Identity comes from credential, and an `agentId` body field is rejected.
- `POST /api/heartbeat`: agent-only `{runId}`. Updates liveness only.

IDs are 1–80 ASCII alphanumeric, underscore or hyphen. `type` is `start` or `progress`. Status is `idle|working|waiting|meeting|done|blocked|failed|cancelled`. `message` ≤1000 characters; `progress` nullable or 0–100. Start uses sequence 1, a never-before-used run ID, and can only replace an absent/terminal run. Progress requires the current run and exactly previous sequence + 1. `done/failed/cancelled` are terminal. Retry the exact same event ID and payload to deduplicate; conflicting reuse is 409. Idempotency window is bounded to latest 800 events; an older retry fails closed via run/sequence guards. New run IDs retained up to 1024 per agent, then 503 requires operator intervention/restart.

Snapshot: `{schemaVersion:1,observedAt,durability:'memory-only',agents,events}`. Each agent has `agentId,runId,status,sequence,message,progress,lastHeartbeatAt,lastProgressAt,stale`. Times are server ISO timestamps; stale is >45 seconds since last accepted event/heartbeat or never observed. A stale status is **unknown connectivity**, not a new task failure; heartbeat does not advance progress. Event history records accepted progress/start events, not heartbeat spam.

**Durability limitation:** bounded process memory only. Restart erases runs, event fences, deduplication and history. Credentials survive only if operator configures their external source. After a restart, reporters must start a fresh run; this is not production durable orchestration. Never infer continuity from a restarted empty server.

## Local MCP stdio

`npm run office:mcp` uses official SDK `@modelcontextprotocol/server` 2.4.0, pinned in lockfile. Reference: https://github.com/modelcontextprotocol/typescript-sdk (official v2 README, inspected 2026-10-30).

Each MCP client/agent launches a **separate** stdio adapter process. Set `OFFICE_URL` to the local backend HTTP origin (default `http://127.0.0.1:8787`) and `OFFICE_AGENT_TOKEN` to that role's writer credential using the MCP client's private environment configuration. Never supply the viewer token as an agent token. Adapter exposes exactly `report_event`, `heartbeat`, `get_status`; no role-selection input, execution tool, public MCP listener or arbitrary destination URL. Calls have a 5-second timeout; uncertain results are not automatically retried. `get_status` can reconcile sequence before a manual identical retry.

MCP is an event reporting adapter, **not** the Magpie model API adapter. It works only when the agent host supports MCP and invokes these tools. Connecting it alone does not create agents, perform tasks or start model calls.

## Verification

`npm test` runs deterministic in-memory tests and ephemeral loopback HTTP/MCP fixtures with random throwaway test credentials. These are mock agent reports, **not real AI integration tests**. `npm run build` checks the static bundle. No service is left running by tests.

## DSH existing-run observer (explicit opt-in)

`node adapters/dsh-observer.mjs --run-id EXISTING_RUN_ID` observes **one already-created DSH run** and reports it as the `planner`. Configure `DSH_MCP_TOKEN` and `OFFICE_PLANNER_TOKEN` through a private process environment; `OFFICE_PLANNER_TOKEN` must be the same planner-scoped writer configured in `OFFICE_AGENT_TOKENS`. `OFFICE_URL` remains a literal loopback HTTP origin. Never put tokens in command arguments, tracked files, frontend settings, screenshots or public hosting.

The DSH destination is fixed to `https://vps.wannian.fun/dsh-minimal-mcp/mcp`; redirects and arbitrary URL/tool overrides are unsupported. This process only initializes MCP and calls **`dsh_status`**, which observes the existing run without starting a new model turn. It does not expose `dsh_run`, start agents, invoke models, or operate a user computer. Starting a new model run remains a separate, explicitly authorized owner action, not an observer feature.

The observer polls every 5 seconds for at most 5 minutes (each transport request has a 15-second timeout). An unchanged verified state sends only an Office heartbeat: liveness is not progress. Known remote terminal states are reported as claims by DSH, not independently verified output. Missing/unknown data, transport errors and observation expiry produce `blocked` with an **unknown task outcome**, never synthetic success or task failure. Polling ends on a known terminal state or an observation error/window limit. Re-running the CLI can resume the same nonterminal observation; it will not replace a different active planner run. Its Office run ID is a stable hash of the remote ID. Backend restart still loses all observation state.

Remote model output, prompt, paths, session details and errors are withheld; only fixed short status summaries enter Office. All response content is untrusted data, never authority or executable instructions. JSON and SSE bodies are bounded at 256 KiB; transport errors are deliberately generic to avoid leaking credentials or remote content.

**Compatibility status:** the parent operator verified an authorized real `dsh_status` response on 2026-10-30: a single MCP text content item containing JSON with `runId` and `status: "completed"` (additional output/session/path fields are ignored). Deterministic tests reproduce that shape with synthetic values; they never authenticate to DSH or call a model. Supported states are `queued`, `running`, `completed`, `failed`, `cancelled`; unknown schemas/states fail closed. The transport requests MCP `2025-03-26`. A strict `【remote VPS result — not local】` metadata header is also supported for the observed DSH run-response format: only the header before the first blank line is parsed, metadata keys are allowlisted, duplicates fail closed, and Assistant/Next content is ignored. Confirming response shape is not proof that this bridge itself has passed an end-to-end real-server test; report that verification separately.
