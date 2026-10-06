# Authoritative workspace sync

Connected writes are explicit commands. React state changes, remote application, cache persistence, token changes, and viewer polling cannot upload a workspace. `useMatches` and `useSettings` remain the state owners. Token-free actions use the same mutation rules locally.

A SQLite Durable Object owns the workspace, revision counters, permanent command deduplication records, and recovery snapshots. Pages authenticates requests before forwarding them to the object. Editor and viewer credentials resolve to the same stable `WORKSPACE_ID`, never a token-derived object ID. The Worker's public fetch handler exposes no workspace API.

## API contract

All new clients send `X-Workspace-Protocol: 2` plus the existing authentication header. Reads and accepted command responses include `X-Workspace-Role`. Missing/incompatible protocol versions receive 426. Legacy `POST /api/state` receives 410 for editors and 403 for viewers. No path writes or deletes legacy KV.

- `GET /api/state`: full `structural` envelope, including workspace state.
- `GET /api/active-match`: partial `live` envelope.
- `POST /api/command`: scope follows `COMMAND_SCOPES` in `src/lib/workspace.ts`. Callers cannot choose response scope.

Live envelopes contain `activeMatch`, `activeSeasonId`, `revision`, `structureRevision`, and `workspaceId`. Structural envelopes contain `state` and the same metadata. Commands also include `commandId`. Automatic player remembering can change `structureRevision` for a live command; it still returns a live envelope, then the client requests the full workspace.

The client tracks live revision, full revision, and the structure revision represented by its complete snapshot separately. A live response never advances full freshness. Older responses are ignored; a full response at the same revision may complete a partial snapshot. Full refresh failures retain cached history/settings. Polling runs every 10 seconds during a match and every 30 seconds while idle, pauses when hidden, and refreshes immediately on visibility. Manual refresh requests the full workspace.

Only one command is submitted per browser at a time. A transport failure gets one automatic retry with the same ID. The explicit Retry action retains the ID and recorded times. Every new submission gets a fresh ID and device time, even when its fields match an earlier failed or accepted submission; duplicate recordings remain separate removable entries. Reads cannot confirm an uncertain command. Offline data stays readable; a cached role cannot grant editor access before current credential confirmation. There is no offline command replay queue.

Commands capture device submission time in `occurredAt` and its displayed clock time in `occurredTime`. Goals, cards, match start, period boundaries and match completion preserve these client values. Pause/resume calculations also use the device timestamp. Every editor and viewer sees the recorded timeline time, including after network delays or retries. The server validates the timestamp and HH:mm label and applies commands in server order; it does not replace valid device times with receipt time. Older commands without these fields fall back to execution time and formatting in the submitted time zone. Explicit retry reuses the complete original command, including its recorded times.

Submission dialogs use `useSubmitAction(action, onSuccess)` for pending state and duplicate-submit protection. They close after confirmation and retain input on failure. Token-free local actions remain immediate. Undo deletes the last displayed timeline entry by its ID; it never reverses an edit.

Deleting a goal or event that is already absent from the targeted live match succeeds without changing state or revisions. Commands still reject missing target IDs, a different active match, or an ended match. Competing Undo actions therefore cannot leave an error banner or an unusable Retry action merely because the first editor already removed the item.

The cache stores a complete workspace plus separate revision metadata. Raw legacy browser storage is preserved once under `football-tracker-legacy-recovery`. Browser credentials and theme remain device-local. Remote state and recovery snapshots contain shared settings only.

## Local verification

```sh
npm ci
npm ci --prefix worker/test-runtime
npx playwright install chromium
npm run lint
npm run typecheck
npm run typecheck:worker
npm run test:coverage
npm run test:workers
npm run test:worker-restart
npm run build:worker
npm run test:e2e
```

The application keeps Vite 8 and Vitest 5. The official Cloudflare test plugin currently supports Vitest 4. The actual Vitest 5 Workers probe failed before test execution; the equivalent isolated Vitest 4 runtime test passed. Workers tests use `worker/test-runtime` with its own lockfile and dependencies. A separate real workerd restart check disposes and recreates the runtime against temporary persisted SQLite, then verifies deduplication after restart. Frontend coverage gates require at least 90% branch coverage per new mutation engine and rewritten sync coordinator.

The Playwright acceptance test launches actual local Pages Functions and a separate Durable Object Worker. It uses temporary storage, isolated browser contexts, and synthetic credentials. It runs goal/card arrival in both orders, checks polling, archiving, later polling, and reload reconstruction. Every mutation uses the UI. Viewer commands and whole-workspace uploads are forbidden by assertions. Production credentials and resources are never used by the test.

## Production cutover checklist

1. Choose a window outside a live match. Pause shared editing. Export the exact legacy `goal-keeper-state` KV value and local backups from both editors. Retain them unchanged.
2. Verify the intended snapshot: seasons, active season, historical matches, scores, timeline items, roster, and shared settings. Resolve disagreement before initializing production storage.
3. Replace `worker/wrangler.jsonc`'s placeholder legacy KV namespace ID with the existing production namespace ID. Keep `ALLOW_EMPTY_WORKSPACE` false. Set the same stable `WORKSPACE_ID` on Worker and Pages. Preview resources must use a separate Worker/namespace, with empty initialization explicitly enabled only for synthetic previews.
4. Deploy the separate SQLite Worker. Bind Pages `WORKSPACES` to class `Workspace` in Worker `goal-keeper-workspace`. Preserve Pages `AUTH_TOKEN`, `VIEWER_TOKEN`, and calendar bindings. Configure the Worker with read access to the original `GOALKEEPER_KV` namespace. See [Pages Durable Object bindings](https://developers.cloudflare.com/pages/functions/bindings/#durable-objects).
5. Validate bootstrap against isolated preview resources first. Initialization is guarded and transactional. Invalid, missing, or oversized production source returns 503 and blocks bootstrap. Existing DO storage prevents reimport, including after restart. The original KV value is never changed or removed.
6. Deploy Pages Functions and the new frontend together while writes remain paused. Never deploy DO reads alongside legacy KV writes. Old reads require upgrade; old uploads are rejected.
7. Verify the full authoritative state against the approved migration snapshot before reopening writes. Bootstrap adds only shared-setting defaults and legacy season normalization; credentials/theme are excluded. Check both editors and the viewer, including the complete three-session scenario, and check token-free local mode separately.
8. Reopen editing only after the acceptance gate passes in both arrival orders. Retain original KV and recovery exports permanently.

Deployment is an operator action; local builds/tests do not deploy anything.

## Recovery and rollback

Before any recovery or rollback, export the current DO workspace with `GET /api/state` using an editor credential and protocol header. Preserve newer DO data, revision metadata, and accepted events. Never fall back to old KV uploads or switch only one side of the read/write pair. A frontend rollback must retain the authoritative command API or keep shared writes paused.

Backup import is an explicit replacement command with `confirmed: true` and the current expected revision. Revision conflicts require refreshing and confirming again. The previous authoritative workspace is saved transactionally in the object's `recovery` table. Imported theme and credentials do not replace device-local preferences. Recovery inspection and restoration require controlled operator access to the DO; no public recovery endpoint is exposed.

Monitor token-free logs for command ID/type/scope, revisions, conflicts, migration failures, and storage errors. Investigate a migration failure before retrying initialization. Never log authentication headers or tokens.

Deferred: unified workspace ownership, WebSockets, semantic duplicate-goal detection, offline command replay.
