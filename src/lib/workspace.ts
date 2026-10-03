import type { AppSettings, GameEvent, Goal, Match, MatchSummary, Season } from "../types/match";
import { DEFAULT_SETTINGS } from "../types/match";
import { createDefaultSeasonName, migrateLegacyDataToSeasons } from "./seasons";
import type { SyncState } from "./sync";

export const COMMAND_SCOPES = {
  "start-match": "structural",
  "end-match": "structural",
  "update-settings": "structural",
  "add-player": "structural",
  "remove-player": "structural",
  "close-season": "structural",
  "reopen-season": "structural",
  "rename-season": "structural",
  "delete-historical-match": "structural",
  "rename-historical-opponent": "structural",
  "import-backup": "structural",
  "add-goal": "live",
  "update-goal": "live",
  "delete-goal": "live",
  "add-event": "live",
  "update-event-time": "live",
  "delete-event": "live",
  "pause-match": "live",
  "resume-match": "live",
  "start-period": "live",
  "end-period": "live",
  "rename-opponent": "live",
} as const;

export type WorkspaceCommandType = keyof typeof COMMAND_SCOPES;
export interface WorkspaceCommand {
  id: string;
  type: WorkspaceCommandType;
  matchId?: string;
  seasonId?: string;
  expectedRevision?: number;
  payload?: Record<string, unknown>;
  timeZone?: string;
  occurredAt?: number;
}

export interface LiveResponse {
  scope: "live";
  workspaceId: string;
  revision: number;
  structureRevision: number;
  activeMatch: Match | null;
  activeSeasonId: string | null;
  commandId?: string;
}

export interface StructuralResponse {
  scope: "structural";
  workspaceId: string;
  revision: number;
  structureRevision: number;
  state: SyncState;
  commandId?: string;
}

export type WorkspaceResponse = LiveResponse | StructuralResponse;
export type CommandResponse = WorkspaceResponse & { commandId: string };

const object = (value: unknown): value is Record<string, any> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const string = (value: unknown): value is string => typeof value === "string";
const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const required: (condition: unknown, label: string) => asserts condition = (condition, label) => {
  if (!condition) throw new Error(`Invalid workspace ${label}`);
};

function validGoal(value: unknown): value is Goal {
  return (
    object(value) &&
    string(value.id) &&
    (value.team === "my-team" || value.team === "opponent") &&
    ["normal", "penalty", "own-goal", "head"].includes(value.type) &&
    string(value.time) &&
    finite(value.timestamp) &&
    (value.scorer === undefined || string(value.scorer)) &&
    (value.assist === undefined || string(value.assist))
  );
}

function validEvent(value: unknown): value is GameEvent {
  return (
    object(value) &&
    string(value.id) &&
    [
      "start",
      "pause",
      "resume",
      "half-time",
      "full-time",
      "period-end",
      "yellow-card",
      "red-card",
    ].includes(value.type) &&
    string(value.time) &&
    finite(value.timestamp) &&
    (value.label === undefined || string(value.label)) &&
    (value.team === undefined || value.team === "my-team" || value.team === "opponent") &&
    (value.player === undefined || string(value.player))
  );
}

function validMatch(value: unknown): value is Match {
  if (!object(value)) return false;
  const requiredNumbers = ["startedAt", "totalPausedTime", "currentPeriod"];
  const optionalNumbers = ["endedAt", "pausedAt", "periodStartedAt", "periodPausedTime"];
  return (
    string(value.id) &&
    string(value.myTeamName) &&
    string(value.opponentName) &&
    typeof value.isHome === "boolean" &&
    Array.isArray(value.goals) &&
    value.goals.every(validGoal) &&
    Array.isArray(value.events) &&
    value.events.every(validEvent) &&
    requiredNumbers.every((key) => finite(value[key])) &&
    optionalNumbers.every((key) => value[key] === undefined || finite(value[key])) &&
    typeof value.isActive === "boolean" &&
    typeof value.isRunning === "boolean"
  );
}

function validSummary(value: unknown): value is MatchSummary {
  return (
    object(value) &&
    string(value.id) &&
    string(value.myTeamName) &&
    string(value.opponentName) &&
    typeof value.isHome === "boolean" &&
    finite(value.myTeamScore) &&
    finite(value.opponentScore) &&
    string(value.date) &&
    finite(value.endedAt) &&
    (value.yellowCardCount === undefined || finite(value.yellowCardCount)) &&
    (value.redCardCount === undefined || finite(value.redCardCount))
  );
}

type SharedSettings = Omit<AppSettings, "theme" | "syncToken">;

export function normalizeSharedSettings(value: unknown): SharedSettings {
  required(object(value), "settings");
  const settings = {
    teamName: value.teamName ?? DEFAULT_SETTINGS.teamName,
    calendarUrl: value.calendarUrl ?? DEFAULT_SETTINGS.calendarUrl,
    calendarTeamName: value.calendarTeamName ?? DEFAULT_SETTINGS.calendarTeamName,
    players: value.players ?? DEFAULT_SETTINGS.players,
    periodsCount: value.periodsCount ?? DEFAULT_SETTINGS.periodsCount,
    periodDuration: value.periodDuration ?? DEFAULT_SETTINGS.periodDuration,
    debug: value.debug ?? DEFAULT_SETTINGS.debug,
  };
  required(
    string(settings.teamName) && string(settings.calendarUrl) && string(settings.calendarTeamName),
    "settings strings",
  );
  required(Array.isArray(settings.players) && settings.players.every(string), "players");
  required(
    finite(settings.periodsCount) &&
      finite(settings.periodDuration) &&
      typeof settings.debug === "boolean",
    "settings values",
  );
  return settings;
}

function normalizeMatch(value: unknown): Match | null {
  if (value === null) return null;
  required(validMatch(value), "active match");
  return { ...value, periodPausedTime: value.periodPausedTime ?? 0 };
}

function validateSeasonMap(value: unknown): asserts value is Record<string, Season> {
  required(object(value) && Object.keys(value).length > 0, "seasons");
  for (const [id, season] of Object.entries(value)) {
    required(
      object(season) &&
        season.id === id &&
        string(season.name) &&
        finite(season.startAt) &&
        (season.status === "active" || season.status === "closed") &&
        Array.isArray(season.matches) &&
        season.matches.every(validSummary) &&
        object(season.fullMatches) &&
        Object.values(season.fullMatches).every(validMatch) &&
        (season.closedAt === undefined || finite(season.closedAt)),
      "season",
    );
  }
}

export function normalizeWorkspace(body: unknown): SyncState {
  required(
    object(body) &&
      Array.isArray(body.matches) &&
      body.matches.every(validSummary) &&
      object(body.fullMatches) &&
      Object.values(body.fullMatches).every(validMatch),
    "state",
  );
  const activeMatch = normalizeMatch(body.activeMatch ?? null);
  let seasons: Record<string, Season>;
  let activeSeasonId: string;
  if (body.seasons === undefined) {
    ({ seasons, activeSeasonId } = migrateLegacyDataToSeasons(body.matches, body.fullMatches));
  } else {
    validateSeasonMap(body.seasons);
    required(
      string(body.activeSeasonId) && body.seasons[body.activeSeasonId]?.status === "active",
      "active season reference",
    );
    required(
      Object.values(body.seasons).filter((season) => season.status === "active").length === 1,
      "active season",
    );
    seasons = body.seasons;
    activeSeasonId = body.activeSeasonId;
  }
  return {
    matches: body.matches,
    fullMatches: body.fullMatches,
    activeMatch,
    seasons,
    activeSeasonId,
    settings: normalizeSharedSettings(body.settings),
  };
}

export function createEmptyWorkspace(now = Date.now()): SyncState {
  const id = `${now.toString(36)}${Math.random().toString(36).slice(2)}`;
  const season: Season = {
    id,
    name: createDefaultSeasonName(now),
    startAt: now,
    status: "active",
    matches: [],
    fullMatches: {},
  };
  return {
    matches: [],
    fullMatches: {},
    activeMatch: null,
    seasons: { [id]: season },
    activeSeasonId: id,
    settings: normalizeSharedSettings(DEFAULT_SETTINGS),
  };
}

export function assertResponse(value: unknown): WorkspaceResponse {
  required(
    object(value) &&
      (value.scope === "live" || value.scope === "structural") &&
      string(value.workspaceId) &&
      Number.isInteger(value.revision) &&
      value.revision >= 0 &&
      Number.isInteger(value.structureRevision) &&
      value.structureRevision >= 0 &&
      value.structureRevision <= value.revision &&
      (value.commandId === undefined || string(value.commandId)),
    "response envelope",
  );
  if (value.scope === "live") {
    required(
      (value.activeMatch === null || validMatch(value.activeMatch)) &&
        (value.activeSeasonId === null || string(value.activeSeasonId)),
      "live response",
    );
    return value as LiveResponse;
  }
  required(object(value.state), "structural response");
  normalizeWorkspace(value.state);
  return value as StructuralResponse;
}

export function workspaceTimeline(
  goals: Goal[],
  events: GameEvent[],
): ({ kind: "goal"; data: Goal } | { kind: "event"; data: GameEvent })[] {
  return [
    ...goals.map((data) => ({ kind: "goal" as const, data })),
    ...events.map((data) => ({ kind: "event" as const, data })),
  ].sort((a, b) => a.data.timestamp - b.data.timestamp);
}
