# Testing locally

## Start the app and API

Run this from the repository directory, after installing dependencies with `npm install` if needed:

```sh
npm run dev:pages
```

The script builds the frontend into `dist`, then starts both the local Durable Object Worker and Wrangler's Pages server with the API functions. Open `http://127.0.0.1:8790`. Use this exact address in all browser sessions. Restart the same command after source changes; it rebuilds automatically. Stop it with Ctrl+C.

Local test credentials are built in:

- `e2e-editor` gives editors read and write access.
- `e2e-viewer` gives viewers read-only access.

`npm run dev` starts only the frontend, with hot reload, for token-free local mode. `npm run e2e:serve` is the browser-test launcher: it serves the existing build and discards its temporary server storage when stopped. Use `dev:pages` for manual testing that should retain server data across restarts.

## Where the data lives

The frontend, Pages API functions, Durable Object, and legacy KV binding run on your computer. This command does not deploy anything or read or write production resources. No production tokens are needed.

Local shared state is stored in SQLite under `.wrangler/local-workspace`. Restarting `dev:pages` retains this workspace. The `.wrangler` directory is ignored by Git. The local server initializes an empty workspace on first use. To copy test data into it, use the app's explicit backup import, which replaces the local shared workspace after confirmation. Cached browser data is never uploaded automatically.

Each browser session also stores settings, credentials, theme, and cached app data in localStorage for the local origin. Browser storage and server storage are independent. Private browsing keeps browser storage separate from your regular session and normally discards it when the private session closes.

The app's sync runs locally with this command. Installing dependencies and fetching a configured public calendar through `/api/calendar` can require internet access. This setup checks the actual local Pages and Durable Object runtimes; production deployment and migration are described in [the sync cutover guide](docs/durable-object-sync.md).

## Test editor and viewer access

1. Open the local address in a regular browser window. In Settings, enter `e2e-editor` in Cloud Sync. Wait for the title badge to show **Editor**. The shared workspace is read from the local Durable Object.
2. Set a recognizable team name, add players, and create a test match. Actions submit commands in the background; the authoritative response updates the editor. Use the sync button to refresh manually.
3. In Settings, choose **Share link**. Open that link in a private window or a separate browser profile. Two ordinary tabs share browser storage, so use isolated sessions to keep credentials independent.
4. Confirm the second session shows **Viewer**, and the token disappears from the address bar after validation. Alternatively, open the local app in the private session and enter `e2e-viewer` manually.
5. Confirm viewers can see the live scoreboard, timeline, history, seasons, statistics, read-only team name in Settings, and upcoming fixtures from the configured public calendar. Calendar rows and refresh are read-only; selecting a fixture cannot start a match. Creation, goal/event actions, timer controls, undo, renaming, deletion, season management, editable workspace settings, backup tools, calendar configuration, and sharing controls should be absent or inactive.
6. Keep the viewer visible while the editor changes a live match. Allow the editor command to complete, then up to ten seconds for the next viewer refresh. Check score and event changes. Finish the match and confirm it appears in viewer history. Without a live match, viewer polling runs every thirty seconds.
7. Open a historical match in the viewer. Edit or delete it in the editor and refresh the viewer. Details should update, and a deleted match should no longer remain displayed.
8. Switch the viewer to a background tab, then return. Polling should pause while hidden and refresh on return. Manual refresh should also work.

## Test sharing and local preferences

1. From the editor, choose **Share link**. Confirm the view-only link is copied to the clipboard.
2. If clipboard permissions block copying, the app should report the failure. If the link needs to be reloaded, the same button click should load and copy it.
3. Open a valid viewer link in the already-connected editor session. It should retain editor access.
4. Open an invalid link, for example `http://127.0.0.1:8790/#viewer=wrong-token`, in a connected session. Existing credentials and data should stay intact; the hash should be removed after validation.
5. Choose different themes in editor and viewer sessions. Sync must preserve each session's own light, dark, or system preference.
6. In an isolated session, leave the token empty. The badge should show **Local only**, and local editing should remain available.
7. Create a local match in that session, then open a viewer link or enter its token in Settings. Confirm the app offers a backup before replacing local matches. Cancel and check that the local match remains; accept only after downloading a backup if you want to keep it.

## Test failures and credential changes

1. Stop the local server while leaving a loaded viewer open. Refresh it. Cached match data and the last successful refresh time should remain visible. Restart with the same command and refresh again to recover.
2. With the server running, enter an invalid token in an isolated session. Confirm an access error and blocked editing. Replace it with a valid token and confirm recovery.
3. Change between editor and viewer tokens. Editing should be blocked while access is being checked. Responses from the previous credential must not replace current data.
4. In browser developer tools, inspect `/api/state`, `/api/active-match`, and `/api/command`. Viewers issue only GET requests. Editors POST individual actions to `/api/command`; no session should upload a whole workspace to `/api/state`.

Cached data remains viewable offline. Shared edits require server confirmation and are not replayed automatically after reconnecting. Token-free local editing remains immediate. Revoked-token and stale-credential response cases are also covered by the automated tests.

Optional API permission checks, using the server address printed in your terminal:

```sh
# Viewer read: 200 with authoritative state; role header is viewer.
curl -i -H 'Authorization: Bearer e2e-viewer' -H 'X-Workspace-Protocol: 2' http://127.0.0.1:8790/api/state

# Viewer write: 403, with no workspace modification.
curl -i -X POST -H 'Authorization: Bearer e2e-viewer' -H 'X-Workspace-Protocol: 2' -H 'Content-Type: application/json' --data '{}' http://127.0.0.1:8790/api/command

# Invalid credential: 401.
curl -i -H 'Authorization: Bearer wrong-token' http://127.0.0.1:8790/api/state

# Editor can retrieve the viewer token; viewer access to this endpoint is rejected.
curl -i -H 'Authorization: Bearer e2e-editor' http://127.0.0.1:8790/api/share
curl -i -H 'Authorization: Bearer e2e-viewer' http://127.0.0.1:8790/api/share
```

## Reset local test data

Stop the server, then delete or rename this repository's `.wrangler/local-workspace` directory to reset local server storage. Clear site data for `http://127.0.0.1:8790` in each browser session, or close the private session, to reset browser storage too. Restart `npm run dev:pages` for a fresh local workspace. Clear both stores for a completely empty start.

This reset only affects local data.

## Automated checks

```sh
npm ci --prefix worker/test-runtime
npm run test:coverage
npm run test:workers
npm run test:worker-restart
npm run typecheck
npm run typecheck:worker
npm run lint
npm run build:worker
npm run test:e2e
```

`test:e2e` builds the frontend, starts disposable local runtimes, and runs the three-session acceptance test with two editors and one viewer in both goal/card arrival orders. Stop `dev:pages` first because the browser tests use the same ports. The manual steps above additionally check clipboard and sharing behavior.
