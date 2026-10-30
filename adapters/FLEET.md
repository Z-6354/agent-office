# Three-server read-only observation

The office keeps its four-role **demo** clearly separate from the real server panel.
`cn1`, `cn2`, `us1` use fixed HTTPS DSH MCP endpoints in `dsh-observer.mjs`.
A probe performs MCP initialize, initialized notification, and tools/list only.
It never calls dsh_run or starts a model. Reachable means authenticated MCP
transport/status capability works; it does not mean an agent is idle or the host
is generally healthy. DSH cannot list runs. Task state is **unknown** unless an
existing run ID is explicitly configured. Terminal states describe only that run.

## Private collector (Node 22+; no extra dependencies)

After explicit approval to persist server credentials on the deployment machine,
put a JSON config outside the public directory, parent directory mode 0700 and file
0600. Its shape is `{ "sources": { "cn1": { "token": "PRIVATE", "runId": "OPTIONAL_EXISTING_RUN", "publicSummaryApproved": true, "publicSummary": "管理员批准的简短工作摘要" } } }`.
Optional cn2/us1 entries have the same shape. Never commit this file or upload it
as a website asset. Raw remote content, errors, prompts and logs are never copied
to the result. Summary is manually curated, explicitly approved, maximum 240
characters; never copy arbitrary remote text or secrets into it.

Run `OFFICE_FLEET_CONFIG=/private/config.json OFFICE_PUBLIC_DIR=/public/site node adapters/fleet-start.mjs`.
Environment variables contain paths only, not keys. Each invocation does one
bounded concurrent pass; use a non-overlapping service timer every 60 seconds for
ongoing observation. Per-request timeout is 15 seconds. Missing credentials yield
unknown, failed connection yields unavailable, bad task payload yields unknown.
The process writes a random temporary file then atomically renames to
`fleet-status.json`. It does not expose a new HTTP port or execution API. The
existing static service must allow GET/HEAD for this exact JSON path and should
set Cache-Control: no-store. Do not expose private adapters/config folders.
Only the frontend dist assets and this strictly projected JSON are public.

Browser reads same-origin `/fleet-status.json` without cookies or tokens every
30 seconds. Records older than 90 seconds (or >5 seconds in the future) display
unknown rather than retaining live working/finished claims. On read failure, the
last timestamp remains visible and ages out; no fallback simulated status is used.

## Release

`npm test && npm run build`; upload reviewed `dist/` assets to the existing site,
then install collector only after private-credential storage approval. No real
DSH requests occur in tests. Deployment remains separate from this source change.
Do not modify the hash-pinned static restart script without coordinating an
explicit authorized service version update and corresponding monitor hashes.
