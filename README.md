# ⚽ Goal Keeper

A Progressive Web App (PWA) for tracking football match goals and events in real-time. 
Ideal for parents, who want to keep track of the goals during their kids matches.

## Screenshots

| Home Screen | Live Match | Match Score | Match History |
|-------------|------------|---------------|---------------|
| ![Home](./public/assets/goal_keeper_home.png) | ![Live](./public/assets/goal_keeper_match.png) | ![Score](./public/assets/goal_keeper_add_score.png) | ![History](./public/assets/goal_keeper_match_history.png) |

## Features

### Core Functionality
- **Live Match Tracking**: Record goals and events during matches with real-time scoring
- **Goal Types**: Support for normal goals, penalties, own goals, and headers
- **Player Management**: Track scorers and assists with autocomplete from your player list
- **Match Timer**: Period-based timing with pause/resume functionality
- **Timeline View**: Chronological view of all goals and match events
- **Match History**: View and manage past matches with detailed statistics
- **Player Statistics**: See top scorers and assist leaders for each match

### Match Configuration
- Customizable match format (1-6 periods)
- Flexible period duration (10-45 minutes)
- Home/Away team designation
- Custom team names

### Progressive Web App
- iOS home screen installation support
- Optimized for standalone mode (no browser UI)
- Proper viewport height handling for iOS PWA
- Works offline after initial load
- Native app-like experience

### Settings & Customization
- **Team Management**: Set your team name
- **Player Database**: Maintain a list of players for quick goal entry
- **Theme Support**: Light, Dark, and System themes
- **Cloud Sync**: Sync matches across devices using a Cloudflare Durable Object (token required)
- **Debug Mode**: Viewport debugging overlay for development

## Technology Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Routing**: React Router v6
- **State Management**: React Hooks (Custom hooks for matches, settings, sync)
- **Storage**: LocalStorage for persistence
- **Cloud Sync**: Cloudflare Durable Object (optional); legacy KV is retained for migration
- **UI Components**: Radix UI primitives

## Installation

### Prerequisites
- Node.js 22 and npm

### Setup

1. Clone the repository:
```bash
cd goal-keeper
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

For local sync testing, start both Cloudflare Pages Functions and the Durable Object Worker:

```bash
npm run dev:pages
```

Open `http://127.0.0.1:8790`. In Settings, use `e2e-editor` as the sync token.
Use a separate browser/profile with `e2e-viewer` to test viewing, or open the
editor's Share link. These are local test credentials; no production resources
are used. Server data is retained under `.wrangler/local-workspace` across restarts.

Restart `npm run dev:pages` after source changes. It rebuilds the frontend
automatically before starting both services, so a separate `npm run build` is
unnecessary. `npm run dev` remains the fast frontend-only server with hot reload.

`npm run e2e:serve` starts the same services for automated browser tests, using
fresh temporary storage that is removed on exit. It serves the existing `dist`
build; `npm run test:e2e` builds first. See [the local testing guide](testing.md)
for editor/viewer checks, persistence, and resetting test data.

### Cloud Sync and View-only Sharing

The app uses one Cloudflare Pages deployment and a separate SQLite Durable
Object Worker. Bind Pages `WORKSPACES` to the Worker's `Workspace` class.
Editors and viewers use the same stable `WORKSPACE_ID` and authoritative state.
Configure distinct `AUTH_TOKEN` and `VIEWER_TOKEN` secrets on Pages. The editor
can submit commands; viewers can read, and the server rejects their commands.
Shared links contain the viewer token in the URL fragment.

Connected actions require server confirmation. State updates and cache saves do
not upload data. Live commands return only live state; structural commands
return the full workspace. Polling and separate revision metadata keep cached
history/settings from claiming freshness after a partial response. Cached data
remains readable offline; token-free local editing stays available.

Viewer responses include the public calendar URL and team name for upcoming
fixtures. Calendar configuration remains editor-only. Fixture refreshes never
write workspace state. Missing or matching viewer credentials disable sharing.

Legacy KV is read once during guarded initialization and retained permanently
unchanged. Remote state excludes device-local theme and credentials. New clients
use protocol version 2; old reads require an upgrade, and whole-workspace
uploads are rejected. Follow [the sync architecture and cutover guide](docs/durable-object-sync.md)
for isolated local verification, deployment bindings, migration, and recovery.

To revoke viewer links, replace `VIEWER_TOKEN` with a new random value in the
Pages environment and deploy the updated secret. Previously copied links then
stop authenticating. Copy a new **Share link** from Settings. When rotating both
credentials, update both secrets as one deployment so the app never runs with
matching values. Editors can replace their saved token in Settings on each
device. The sync status there shows the last successful refresh time.

4. Build for production:
```bash
npm run build
```

## Usage

### Starting a Match

1. Tap "Start New Match" on the home screen
2. Enter your team name and opponent name
3. Select Home or Away
4. Tap "Start Match"

### During a Match

- **Start Period**: Begin timing a period
- **Add Goal**: Record goals for your team with optional scorer, assist, and goal type
- **Opponent Goal**: Quickly record opponent goals
- **Add Event**: Add match events (pause, resume, period end)
- **End Period**: Mark the end of a period
- **Undo**: Remove the last goal or event
- **End Match**: Complete the match and save to history

### Match History

- View all completed matches
- See scores, dates, and match results
- Tap a match to see detailed timeline and statistics
- Delete matches by tapping the trash icon

### Settings

- **Team Name**: Set your default team name
- **Players**: Add players to your roster for autocomplete
- **Match Format**: Configure periods and duration
- **Appearance**: Choose light, dark, or system theme
- **Cloud Sync**: Enter a token to sync across devices
- **Debug Mode**: Enable viewport debugging overlay

## iOS PWA Installation

1. Open the app in Safari
2. Tap the Share button
3. Scroll down and tap "Add to Home Screen"
4. Tap "Add"
5. Launch from your home screen for full-screen experience

The app includes special viewport handling to ensure proper display in iOS standalone mode, eliminating white space issues common in iOS PWAs.

## Development

### Project Structure

```
src/
├── components/          # React components
│   ├── LiveMatchLayout.tsx    # Main live match layout with viewport handling
│   ├── MatchActions.tsx       # Action buttons during match
│   ├── Scoreboard.tsx         # Score display
│   ├── GoalTimeline.tsx       # Timeline of goals/events
│   ├── MatchHistory.tsx       # Match history list
│   ├── MatchDetail.tsx        # Match detail view with statistics
│   ├── SettingsScreen.tsx     # Settings interface
│   └── ...
├── hooks/               # Custom React hooks
│   ├── useMatches.ts          # Match state management
│   ├── useSettings.ts         # Settings persistence
│   ├── useSync.ts             # Cloud sync logic
│   └── useTheme.ts            # Theme management
├── lib/                 # Utilities and libraries
│   └── sync.ts                # Cloudflare KV sync implementation
├── types/               # TypeScript type definitions
│   └── match.ts               # Match, Goal, Event types
├── pages/               # Page components
│   └── Index.tsx              # Main app page
├── main.tsx             # Entry point with iOS viewport fix
└── index.css            # Global styles and theme variables
```

### Key Technical Details

#### iOS PWA Viewport Fix
The app implements multiple timing strategies in `main.tsx` to handle iOS PWA viewport expansion:
- Immediate calculation on load
- Delayed calculations (100ms, 500ms) for PWA launch
- Event listeners for resize, orientation change, visibility change
- Custom CSS variable `--vh` for accurate viewport height

#### Theme System
Three theme modes using CSS custom properties:
- Light theme
- Dark theme
- System theme (follows OS preference)

#### Data Persistence
- Match history and settings stored in localStorage
- Optional cloud sync via Cloudflare KV
- Automatic save on state changes

## License

MIT

## Author

Built for tracking football matches with friends and family.
