# Testing locally

## Start the app and API

Run this from the repository directory, after installing dependencies with `npm install` if needed:

```sh
npm run dev:pages -- --kv=GOALKEEPER_KV --binding=AUTH_TOKEN=local-editor --binding=VIEWER_TOKEN=local-viewer
```

The script builds the frontend into `dist`, then starts Wrangler's local Pages server with the API functions. Open the address printed in the terminal, normally `http://localhost:8788`. Use the same address in both browser sessions. Restart this command after changing source files so the frontend is rebuilt. Stop it with Ctrl+C.

The arguments after `--` are passed to Wrangler:

- `--kv=GOALKEEPER_KV` supplies the local KV binding used by the API.
- `AUTH_TOKEN=local-editor` gives editors read and write access.
- `VIEWER_TOKEN=local-viewer` gives viewers read-only access. The two tokens must differ.

## Where the data lives

The frontend, API functions, and KV storage run on your computer. This command does not deploy anything, create a Cloudflare KV namespace, or read or write your production KV. No production tokens are needed.

Wrangler persists local server data under `.wrangler/state` in this repository, normally in its `v3/kv` subdirectory. The API stores the shared workspace under the key `goal-keeper-state`. Restarting the server retains that local workspace. The `.wrangler` directory is ignored by Git. See Cloudflare's [Pages command reference](https://developers.cloudflare.com/workers/wrangler/commands/pages/) for local persistence options.

Each browser session also stores settings, credentials, theme, and cached app data in browser localStorage for the localhost origin. Clearing browser data does not clear local KV, and clearing local KV does not clear browser data. Private browsing keeps this separate from your regular session and normally discards it when the private session closes.

The app's sync runs entirely locally with this command. Initial tool downloads through `npm` or `npx`, and optional external calendar subscriptions, can still need internet access. Local testing does not reproduce Cloudflare's production KV propagation delays.

## Test editor and viewer access

1. Open the local address in a regular browser window. In Settings, enter `local-editor` in Cloud Sync. Wait for the title badge to show **Editor**. An empty local workspace is initialized from that browser's local app data.
2. Set a recognizable team name, add players, and create a test match. Changes automatically upload after about two seconds; use the sync button to refresh manually.
3. In Settings, choose **Copy Link**. Open that link in a private window or a separate browser profile. Two ordinary tabs share browser storage, so use isolated sessions to keep credentials independent.
4. Confirm the second session shows **Viewer**, and the token disappears from the address bar after validation. Alternatively, open the local app in the private session and enter `local-viewer` manually.
5. Confirm viewers can see the live scoreboard, timeline, history, seasons, statistics, and the read-only team name in Settings. Creation, goal/event actions, timer controls, undo, renaming, deletion, season management, editable workspace settings, backup tools, calendar features, and sharing controls should be absent or inactive.
6. Keep the viewer visible while the editor changes a live match. Allow the editor upload, then up to ten seconds for the next viewer refresh. Check score and event changes. Finish the match and confirm it appears in viewer history. Without a live match, viewer polling runs every thirty seconds.
7. Open a historical match in the viewer. Edit or delete it in the editor and refresh the viewer. Details should update, and a deleted match should no longer remain displayed.
8. Switch the viewer to a background tab, then return. Polling should pause while hidden and refresh on return. Manual refresh should also work.

## Test sharing and local preferences

1. From the editor, try **Share workspace**. Where supported, the browser opens native sharing; otherwise it copies the link. Canceling native sharing should not show an error.
2. Check **Copy Link** independently. If browser permissions block sharing or copying, the app should report the failure. A slow retry that first reloads the link may need a second tap in Safari.
3. Open a valid viewer link in the already-connected editor session. It should retain editor access.
4. Open an invalid link, for example `http://localhost:8788/#viewer=wrong-token`, in a connected session. Existing credentials and data should stay intact; the hash should be removed after validation.
5. Choose different themes in editor and viewer sessions. Sync must preserve each session's own light, dark, or system preference.
6. In an isolated session, leave the token empty. The badge should show **Local only**, and local editing should remain available.

## Test failures and credential changes

1. Stop the local server while leaving a loaded viewer open. Refresh it. Cached match data and the last successful refresh time should remain visible. Restart with the same command and refresh again to recover.
2. With the server running, enter an invalid token in an isolated session. Confirm an access error and blocked editing. Replace it with a valid token and confirm recovery.
3. Change between editor and viewer tokens. Editing should be blocked while access is being checked. Responses from the previous credential must not replace current data.
4. To simulate viewer revocation, restart with `--binding=VIEWER_TOKEN=local-viewer-rotated` instead of `local-viewer`. Existing viewer credentials and links should fail on their next request, while editor access still works. Copy a new link from the editor to reconnect. Previously downloaded data cannot be retracted.
5. In browser developer tools, inspect Network requests filtered to `/api/state`. A viewer should only issue GET requests, never POST, including after failures or local preference changes. Editors issue POST requests for workspace changes.

Optional API permission checks, using the server address printed in your terminal:

```sh
# Viewer read: 200 with data, or 204 for an empty workspace; role header is viewer.
curl -i -H 'Authorization: Bearer local-viewer' http://localhost:8788/api/state

# Viewer write: 403, with no workspace modification.
curl -i -X POST -H 'Authorization: Bearer local-viewer' -H 'Content-Type: application/json' --data '{}' http://localhost:8788/api/state

# Invalid credential: 401.
curl -i -H 'Authorization: Bearer wrong-token' http://localhost:8788/api/state

# Editor can retrieve the viewer token; viewer access to this endpoint is rejected.
curl -i -H 'Authorization: Bearer local-editor' http://localhost:8788/api/share
curl -i -H 'Authorization: Bearer local-viewer' http://localhost:8788/api/share
```

If you rotated the viewer token, use its new value in these checks.

## Reset local test data

Stop the server, then delete or rename this repository's `.wrangler/state` directory to reset server storage. Clear site data for the exact localhost address in each browser session, or close the private session, to reset browser storage too. Restart with the original command for a fresh test. Clear both stores if you want a completely empty start; otherwise an editor can seed empty KV from its existing browser data.

This reset only affects local data. See Cloudflare's [local data guide](https://developers.cloudflare.com/workers/local-development/local-data/) for details.

## Automated checks

```sh
npm test
npm run lint
npm run build
```

These cover the automated suite and build validation. The browser steps above additionally check the two-session experience and native sharing behavior.
