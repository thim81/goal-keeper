import type { GameEvent, Goal, GoalType, Match, MatchSummary, Season } from "../types/match";
import { COMMAND_SCOPES, normalizeWorkspace, type WorkspaceCommand, type WorkspaceCommandType } from "./workspace";
import { parseClockTime } from "./clock-time";
import type { SyncState } from "./sync";

export class WorkspaceError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "WorkspaceError";
  }
}

type Result = { state: SyncState; changed: boolean; structureChanged: boolean };
type RecordValue = Record<string, unknown>;
const own = (value: unknown): value is RecordValue => value !== null && typeof value === "object" && !Array.isArray(value);
const nonempty = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
function fail(status: number, message: string): never { throw new WorkspaceError(status, message); }

function payloadOf(command: WorkspaceCommand): RecordValue {
  if (command.payload === undefined) return {};
  if (!own(command.payload)) fail(400, "Command payload must be an object");
  return command.payload;
}

function text(payload: RecordValue, key: string, optional = false): string | undefined {
  const value = payload[key];
  if (optional && value === undefined) return undefined;
  if (!nonempty(value)) fail(400, `Invalid ${key}`);
  return value.trim();
}

function flag(payload: RecordValue, key: string): boolean {
  if (typeof payload[key] !== "boolean") fail(400, `Invalid ${key}`);
  return payload[key] as boolean;
}

function timeLabel(now: number, command: WorkspaceCommand): string {
  if (command.occurredTime !== undefined) return command.occurredTime;
  try {
    return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: command.timeZone }).format(now);
  } catch {
    fail(400, "Invalid time zone");
  }
}

function setClockTime(timestamp: number, time: string, timeZone?: string): number {
  const clock = parseClockTime(time)!;
  if (!timeZone) {
    const date = new Date(timestamp);
    date.setHours(clock.hours, clock.minutes, 0, 0);
    return date.getTime();
  }
  try {
    const parts = (instant: number) => Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    }).formatToParts(instant).map((part) => [part.type, part.value]));
    const original = parts(timestamp);
    const desired = Date.UTC(Number(original.year), Number(original.month) - 1, Number(original.day), clock.hours, clock.minutes);
    let result = desired;
    for (let attempt = 0; attempt < 2; attempt++) {
      const local = parts(result);
      const localAsUtc = Date.UTC(Number(local.year), Number(local.month) - 1, Number(local.day), Number(local.hour), Number(local.minute), Number(local.second));
      result = desired - (localAsUtc - result);
    }
    return result;
  } catch {
    fail(400, "Invalid time zone");
  }
}

function dateLabel(timestamp: number, timeZone?: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone }).format(timestamp);
  } catch {
    fail(400, "Invalid time zone");
  }
}

function lastPeriodBoundary(match: Match): GameEvent | undefined {
  return [...match.events].reverse().find((event) => event.type === "start" || event.type === "period-end");
}

function targetMatch(state: SyncState, command: WorkspaceCommand): Match {
  if (!nonempty(command.matchId)) fail(400, "matchId required");
  if (!state.activeMatch || state.activeMatch.id !== command.matchId) fail(409, "Active match changed");
  if (!state.activeMatch.isActive || state.activeMatch.endedAt !== undefined) fail(409, "Match has ended");
  return state.activeMatch;
}

function targetSeason(state: SyncState, command: WorkspaceCommand): Season {
  if (!nonempty(command.seasonId)) fail(400, "seasonId required");
  const season = state.seasons?.[command.seasonId];
  if (!season) fail(404, "Season not found");
  return season;
}

function rememberPlayers(state: SyncState, ...values: Array<string | undefined>): void {
  const players: string[] = [...state.settings.players];
  for (const value of values) {
    const player = value?.trim();
    if (player && !players.includes(player)) players.push(player);
  }
  state.settings = { ...state.settings, players };
}

function score(match: Match): { myTeamScore: number; opponentScore: number } {
  let myTeamScore = 0;
  let opponentScore = 0;
  for (const goal of match.goals) {
    if ((goal.team === "my-team" && goal.type !== "own-goal") || (goal.team === "opponent" && goal.type === "own-goal")) myTeamScore++;
    else opponentScore++;
  }
  return { myTeamScore, opponentScore };
}

function canonicalize(state: SyncState): void {
  const activeSeason = state.seasons![state.activeSeasonId!];
  state.matches = activeSeason.matches;
  state.fullMatches = activeSeason.fullMatches;
}

function validGoalType(value: unknown): value is GoalType {
  return value === "normal" || value === "penalty" || value === "own-goal" || value === "head";
}

function validTeam(value: unknown): value is Goal["team"] {
  return value === "my-team" || value === "opponent";
}

function addGoal(state: SyncState, command: WorkspaceCommand, payload: RecordValue, now: number): void {
  const match = targetMatch(state, command);
  const team = payload.team;
  const type = payload.goalType ?? payload.type ?? "normal";
  if (!validTeam(team) || !validGoalType(type)) fail(400, "Invalid goal");
  if ((payload.scorer !== undefined && typeof payload.scorer !== "string") || (payload.assist !== undefined && typeof payload.assist !== "string")) fail(400, "Invalid goal players");
  const scorer = team === "my-team" ? (typeof payload.scorer === "string" ? payload.scorer.trim() : undefined) : undefined;
  const assist = team === "my-team" ? (typeof payload.assist === "string" ? payload.assist.trim() : undefined) : undefined;
  const id = `${command.id}:goal`;
  const goal: Goal = { id, team, scorer: scorer || undefined, assist: assist || undefined, type, time: timeLabel(now, command), timestamp: now };
  match.goals = [...match.goals, goal];
  if (team === "my-team") rememberPlayers(state, scorer, assist);
}

function addEvent(state: SyncState, command: WorkspaceCommand, payload: RecordValue, now: number): void {
  const match = targetMatch(state, command);
  const type = payload.eventType;
  const allowed = ["start", "pause", "resume", "half-time", "full-time", "period-end", "yellow-card", "red-card"];
  if (typeof type !== "string" || !allowed.includes(type)) fail(400, "Invalid event type");
  if (payload.team !== undefined && !validTeam(payload.team)) fail(400, "Invalid event team");
  if (payload.player !== undefined && typeof payload.player !== "string") fail(400, "Invalid event player");
  if (payload.label !== undefined && typeof payload.label !== "string") fail(400, "Invalid event label");
  const id = `${command.id}:event`;
  const event: GameEvent = {
    id, type: type as GameEvent["type"], time: timeLabel(now, command), timestamp: now,
    ...(typeof payload.label === "string" ? { label: payload.label } : {}),
    ...(validTeam(payload.team) ? { team: payload.team } : {}),
    ...(typeof payload.player === "string" && payload.player.trim() ? { player: payload.player.trim() } : {}),
  };
  match.events = [...match.events, event];
  if ((event.type === "yellow-card" || event.type === "red-card") && event.team === "my-team") rememberPlayers(state, event.player);
}

function mutate(state: SyncState, command: WorkspaceCommand, now: number): void {
  const payload = payloadOf(command);
  switch (command.type as WorkspaceCommandType) {
    case "start-match": {
      const id = `${command.id}:match`;
      if (state.activeMatch) fail(409, "Match already active");
      canonicalize(state);
      const myTeamName = text(payload, "myTeamName", true) || state.settings.teamName || "My Team";
      const opponentName = text(payload, "opponentName", true) || "Opponent";
      const isHome = flag(payload, "isHome");
      state.activeMatch = {
        id, myTeamName, opponentName, isHome, goals: [],
        events: [{ id: `${command.id}:start`, type: "start", label: "Start Period 1", time: timeLabel(now, command), timestamp: now }],
        startedAt: now, isActive: true, isRunning: true, totalPausedTime: 0, currentPeriod: 1,
        periodStartedAt: now, periodPausedTime: 0,
      };
      return;
    }
    case "end-match": {
      const match = targetMatch(state, command);
      if (command.seasonId !== undefined && command.seasonId !== state.activeSeasonId) fail(409, "Active season changed");
      const season = targetSeason(state, { ...command, seasonId: command.seasonId ?? state.activeSeasonId ?? undefined });
      const matchScore = score(match);
      const summary: MatchSummary = {
        id: match.id, myTeamName: match.myTeamName, opponentName: match.opponentName, isHome: match.isHome,
        ...matchScore, yellowCardCount: match.events.filter((event) => event.type === "yellow-card").length,
        redCardCount: match.events.filter((event) => event.type === "red-card").length,
        date: dateLabel(match.startedAt, command.timeZone),
        endedAt: now,
      };
      const finalMatch: Match = {
        ...match,
        events: match.isRunning ? [...match.events, { id: `${command.id}:period-end`, type: "period-end", label: `End Period ${match.currentPeriod}`, time: timeLabel(now, command), timestamp: now }] : match.events,
        endedAt: now, isActive: false, isRunning: false, pausedAt: match.isRunning ? now : match.pausedAt,
      };
      season.matches = [summary, ...season.matches.filter((item) => item.id !== match.id)];
      season.fullMatches = { ...season.fullMatches, [match.id]: finalMatch };
      state.activeMatch = null;
      canonicalize(state);
      return;
    }
    case "add-goal": addGoal(state, command, payload, now); return;
    case "add-event": addEvent(state, command, payload, now); return;
    case "delete-goal": {
      const match = targetMatch(state, command);
      const id = text(payload, "goalId");
      match.goals = match.goals.filter((goal) => goal.id !== id);
      return;
    }
    case "update-goal": {
      const match = targetMatch(state, command);
      const id = text(payload, "goalId");
      const changes = payload.changes;
      if (!own(changes) || typeof changes.time !== "string" || !validGoalType(changes.type)) fail(400, "Invalid goal changes");
      const clock = parseClockTime(changes.time);
      if (!clock) fail(400, "Invalid goal time");
      const goal = match.goals.find((item) => item.id === id);
      if (!goal) fail(404, "Goal not found");
      if (goal.team === "my-team" && !nonempty(changes.scorer)) fail(400, "Scorer required");
      const timestamp = goal.time === changes.time ? goal.timestamp : setClockTime(goal.timestamp, changes.time, command.timeZone);
      match.goals = match.goals.map((item) => item.id !== id ? item : {
        ...item, type: changes.type as GoalType, time: changes.time as string, timestamp,
        scorer: item.team === "my-team" ? (typeof changes.scorer === "string" ? changes.scorer.trim() || undefined : undefined) : undefined,
        assist: item.team === "my-team" ? (typeof changes.assist === "string" ? changes.assist.trim() || undefined : undefined) : undefined,
      });
      const updated = match.goals.find((item) => item.id === id)!;
      if (updated.team === "my-team") rememberPlayers(state, updated.scorer, updated.assist);
      return;
    }
    case "delete-event": {
      const match = targetMatch(state, command);
      const id = text(payload, "eventId");
      match.events = match.events.filter((event) => event.id !== id);
      return;
    }
    case "update-event-time": {
      const match = targetMatch(state, command);
      const id = text(payload, "eventId");
      const time = text(payload, "time");
      const clock = parseClockTime(time!);
      if (!clock) fail(400, "Invalid event time");
      const event = match.events.find((item) => item.id === id);
      if (!event) fail(404, "Event not found");
      if (event.type !== "start" && event.type !== "period-end") fail(409, "Event time cannot be changed");
      const timestamp = setClockTime(event.timestamp, time!, command.timeZone);
      event.time = time!;
      event.timestamp = timestamp;
      const firstStart = match.events.find((item) => item.type === "start");
      const lastStart = [...match.events].reverse().find((item) => item.type === "start");
      if (event.type === "start" && firstStart?.id === id) match.startedAt = event.timestamp;
      if (event.type === "start" && lastStart?.id === id) match.periodStartedAt = event.timestamp;
      return;
    }
    case "pause-match": {
      const match = targetMatch(state, command);
      if (!match.isRunning) fail(409, "Match already paused");
      match.isRunning = false; match.pausedAt = now;
      return;
    }
    case "resume-match": {
      const match = targetMatch(state, command);
      if (match.isRunning) fail(409, "Match already running");
      if (lastPeriodBoundary(match)?.type === "period-end") fail(409, "Start next period before resuming");
      const pauseDuration = match.pausedAt ? Math.max(0, now - match.pausedAt) : 0;
      match.isRunning = true; match.pausedAt = undefined;
      match.totalPausedTime += pauseDuration;
      match.periodPausedTime = match.periodPausedTime! + pauseDuration;
      return;
    }
    case "end-period": {
      const match = targetMatch(state, command);
      if (!Number.isInteger(payload.expectedPeriod) || (payload.expectedPeriod as number) < 1) fail(400, "expectedPeriod required");
      if (payload.expectedPeriod !== match.currentPeriod) fail(409, "Period changed");
      if (lastPeriodBoundary(match)?.type === "period-end") fail(409, "Period already ended");
      const pausedAt = match.isRunning ? now : match.pausedAt;
      match.events = [...match.events, { id: `${command.id}:event`, type: "period-end", label: `End Period ${match.currentPeriod}`, time: timeLabel(now, command), timestamp: now }];
      match.isRunning = false; match.pausedAt = pausedAt;
      return;
    }
    case "start-period": {
      const match = targetMatch(state, command);
      if (!Number.isInteger(payload.expectedPeriod) || (payload.expectedPeriod as number) < 1) fail(400, "expectedPeriod required");
      if (payload.expectedPeriod !== match.currentPeriod) fail(409, "Period changed");
      if (match.isRunning) fail(409, "Period already running");
      const boundary = lastPeriodBoundary(match);
      if (boundary?.type !== "period-end") fail(409, "End current period before starting next");
      const nextPeriod = match.currentPeriod + 1;
      const pauseDuration = match.pausedAt ? Math.max(0, now - match.pausedAt) : 0;
      match.isRunning = true; match.pausedAt = undefined; match.totalPausedTime += pauseDuration;
      match.periodStartedAt = now; match.periodPausedTime = 0; match.currentPeriod = nextPeriod;
      match.events = [...match.events, { id: `${command.id}:event`, type: "start", label: `Start Period ${nextPeriod}`, time: timeLabel(now, command), timestamp: now }];
      return;
    }
    case "rename-opponent": {
      const match = targetMatch(state, command);
      match.opponentName = text(payload, "name")!;
      return;
    }
    case "update-settings": {
      const source = payload.settings;
      if (!own(source)) fail(400, "settings object required");
      const allowed = ["teamName", "calendarUrl", "calendarTeamName", "players", "periodsCount", "periodDuration", "debug"];
      if (Object.keys(source).some((key) => !allowed.includes(key))) fail(400, "Unsupported setting");
      const settings = { ...state.settings, ...source };
      if (!nonempty(settings.teamName) || typeof settings.calendarUrl !== "string" || typeof settings.calendarTeamName !== "string" ||
        !Array.isArray(settings.players) || !settings.players.every(nonempty) || !finite(settings.periodsCount) || settings.periodsCount < 1 ||
        !finite(settings.periodDuration) || settings.periodDuration <= 0 || typeof settings.debug !== "boolean") fail(400, "Invalid settings");
      state.settings = { teamName: settings.teamName.trim(), calendarUrl: settings.calendarUrl.trim(), calendarTeamName: settings.calendarTeamName.trim(),
        players: settings.players.map((player: string) => player.trim()), periodsCount: settings.periodsCount, periodDuration: settings.periodDuration, debug: settings.debug };
      return;
    }
    case "add-player": case "remove-player": {
      const name = text(payload, "player")!;
      const players: string[] = [...state.settings.players];
      state.settings = { ...state.settings, players: command.type === "add-player"
        ? players.includes(name) ? players : [...players, name]
        : players.filter((player) => player !== name) };
      return;
    }
    case "close-season": {
      if (state.activeMatch) fail(409, "Cannot close season during active match");
      const current = targetSeason(state, command);
      const nextId = `${command.id}:season`;
      if (current.id !== state.activeSeasonId || current.status !== "active") fail(409, "Season is not active");
      const name = text(payload, "name", true);
      if (state.seasons![nextId]) fail(409, "Season already exists");
      state.seasons![current.id] = { ...current, status: "closed", closedAt: now };
      state.seasons![nextId] = { id: nextId, name: name || `${new Date(now).getFullYear()}-${new Date(now).getFullYear() + 1}`,
        startAt: now, status: "active", matches: [], fullMatches: {} };
      state.activeSeasonId = nextId; canonicalize(state);
      return;
    }
    case "reopen-season": {
      if (state.activeMatch) fail(409, "Cannot reopen season during active match");
      const target = targetSeason(state, command);
      if (target.status !== "closed") fail(409, "Season is already active");
      const active = state.activeSeasonId ? state.seasons![state.activeSeasonId] : undefined;
      if (!active || active.status !== "active") fail(409, "Active season missing");
      state.seasons![active.id] = { ...active, status: "closed", closedAt: now };
      state.seasons![target.id] = { ...target, status: "active", closedAt: undefined };
      state.activeSeasonId = target.id; canonicalize(state);
      return;
    }
    case "rename-season": {
      const season = targetSeason(state, command);
      season.name = text(payload, "name")!;
      canonicalize(state);
      return;
    }
    case "delete-historical-match": {
      const season = targetSeason(state, command);
      const id = command.matchId;
      if (!nonempty(id)) fail(400, "matchId required");
      if (!season.fullMatches[id] && !season.matches.some((item) => item.id === id)) fail(404, "Historical match not found");
      const { [id]: _deleted, ...fullMatches } = season.fullMatches;
      season.fullMatches = fullMatches;
      season.matches = season.matches.filter((item) => item.id !== id);
      canonicalize(state);
      return;
    }
    case "rename-historical-opponent": {
      const season = targetSeason(state, command);
      if (!nonempty(command.matchId)) fail(400, "matchId required");
      const name = text(payload, "name")!;
      const match = season.fullMatches[command.matchId];
      if (!match) fail(404, "Historical match not found");
      season.fullMatches = { ...season.fullMatches, [match.id]: { ...match, opponentName: name } };
      season.matches = season.matches.map((summary) => summary.id === match.id ? { ...summary, opponentName: name } : summary);
      if (state.activeMatch?.id === match.id) state.activeMatch = { ...state.activeMatch, opponentName: name };
      canonicalize(state);
      return;
    }
    case "import-backup": {
      if (payload.confirmed !== true) fail(400, "Backup import confirmation required");
      if (!own(payload.state)) fail(400, "Backup state required");
      try {
        const imported = normalizeWorkspace(payload.state);
        Object.assign(state, structuredClone(imported));
      } catch {
        fail(400, "Invalid backup state");
      }
      canonicalize(state);
      return;
    }
  }
}

export function applyWorkspaceCommand(state: SyncState, command: WorkspaceCommand, now = Date.now()): Result {
  if (!own(command) || !nonempty(command.id) || !Object.prototype.hasOwnProperty.call(COMMAND_SCOPES, command.type)) fail(400, "Invalid command");
  if (command.occurredAt !== undefined && (!finite(command.occurredAt) || command.occurredAt < 0 || command.occurredAt > 8_640_000_000_000_000)) fail(400, "Invalid occurredAt");
  if (command.occurredTime !== undefined && (typeof command.occurredTime !== "string" || !parseClockTime(command.occurredTime))) fail(400, "Invalid occurredTime");
  let normalized: SyncState;
  try {
    normalized = normalizeWorkspace(state);
  } catch {
    fail(400, "Invalid workspace state");
  }
  const next = structuredClone(normalized);
  const before = JSON.stringify(next);
  const structureBefore = JSON.stringify({ matches: next.matches, fullMatches: next.fullMatches, seasons: next.seasons, activeSeasonId: next.activeSeasonId, settings: next.settings });
  mutate(next, command, command.occurredAt ?? now);
  const structural = COMMAND_SCOPES[command.type];
  if (structural === "structural") canonicalize(next);
  const changed = JSON.stringify(next) !== before;
  const structureChanged = (structural === "structural" && changed) || structureBefore !== JSON.stringify({
    matches: next.matches, fullMatches: next.fullMatches, seasons: next.seasons, activeSeasonId: next.activeSeasonId, settings: next.settings,
  });
  return { state: next, changed, structureChanged };
}
