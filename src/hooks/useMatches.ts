import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Match,
  GoalEdit,
  MatchSummary,
  GoalType,
  GameEventType,
  Season,
  DEFAULT_SETTINGS,
} from "@/types/match";
import { createDefaultSeasonName, getSeasonStats, migrateLegacyDataToSeasons } from "@/lib/seasons";
import type { SyncState } from "@/lib/sync";
import { readWorkspaceCache, assembleWorkspace, preserveLegacyCache } from "@/lib/workspace-cache";
import { applyWorkspaceCommand } from "@/lib/workspace-mutations";
import {
  workspaceTimeline,
  type WorkspaceCommand,
  type WorkspaceCommandType,
} from "@/lib/workspace";

const LEGACY_MATCHES_KEY = "football-tracker-matches";
const LEGACY_FULL_MATCHES_KEY = "football-tracker-full-matches";
const ACTIVE_MATCH_KEY = "football-tracker-active-match";
const SEASONS_KEY = "football-tracker-seasons";
const ACTIVE_SEASON_KEY = "football-tracker-active-season-id";

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function createEmptyActiveSeason(now: number = Date.now()): {
  seasons: Record<string, Season>;
  activeSeasonId: string;
} {
  const seasonId = generateId();
  return {
    seasons: {
      [seasonId]: {
        id: seasonId,
        name: createDefaultSeasonName(now),
        startAt: now,
        status: "active",
        matches: [],
        fullMatches: {},
      },
    },
    activeSeasonId: seasonId,
  };
}

function validateSavedMatches(
  activeMatch: Match | null,
  seasons: Record<string, Season>,
  activeSeasonId: string,
) {
  assembleWorkspace(seasons, activeSeasonId, activeMatch, DEFAULT_SETTINGS);
  return { activeMatch, seasons, activeSeasonId };
}

function loadMatches() {
  preserveLegacyCache();
  try {
    const cache = readWorkspaceCache();
    if (cache?.state.seasons && cache.state.activeSeasonId)
      return {
        activeMatch: cache.state.activeMatch,
        seasons: cache.state.seasons,
        activeSeasonId: cache.state.activeSeasonId,
      };
    const savedActiveMatch = localStorage.getItem(ACTIVE_MATCH_KEY);
    const activeMatch = savedActiveMatch ? JSON.parse(savedActiveMatch) : null;

    const savedSeasonsRaw = localStorage.getItem(SEASONS_KEY);
    const savedActiveSeasonId = localStorage.getItem(ACTIVE_SEASON_KEY);

    if (savedSeasonsRaw) {
      const parsedSeasons = JSON.parse(savedSeasonsRaw) as Record<string, Season>;
      const resolvedActiveSeasonId =
        savedActiveSeasonId && parsedSeasons[savedActiveSeasonId]
          ? savedActiveSeasonId
          : (Object.values(parsedSeasons).find((season) => season.status === "active")?.id ??
            Object.keys(parsedSeasons)[0] ??
            null);

      if (resolvedActiveSeasonId) {
        return validateSavedMatches(activeMatch, parsedSeasons, resolvedActiveSeasonId);
      }
    }

    const legacyHistory = JSON.parse(
      localStorage.getItem(LEGACY_MATCHES_KEY) || "[]",
    ) as MatchSummary[];
    const legacyFullMatches = JSON.parse(
      localStorage.getItem(LEGACY_FULL_MATCHES_KEY) || "{}",
    ) as Record<string, Match>;
    const hasLegacy = legacyHistory.length > 0 || Object.keys(legacyFullMatches).length > 0;
    const migrated = hasLegacy
      ? migrateLegacyDataToSeasons(legacyHistory, legacyFullMatches)
      : createEmptyActiveSeason();
    return validateSavedMatches(activeMatch, migrated.seasons, migrated.activeSeasonId);
  } catch {
    try {
      localStorage.setItem(
        "football-tracker-match-recovery",
        JSON.stringify({
          seasons: localStorage.getItem(SEASONS_KEY),
          activeMatch: localStorage.getItem(ACTIVE_MATCH_KEY),
        }),
      );
    } catch {
      /* Storage can be unavailable. */
    }
    return { activeMatch: null, ...createEmptyActiveSeason() };
  }
}

export function useMatches() {
  const [initial] = useState(loadMatches);
  const [activeMatch, setActiveMatch] = useState<Match | null>(initial.activeMatch);
  const [seasons, setSeasons] = useState<Record<string, Season>>(initial.seasons);
  const [activeSeasonId, setActiveSeasonId] = useState<string | null>(initial.activeSeasonId);
  const activeSeason = useMemo(
    () => (activeSeasonId ? (seasons[activeSeasonId] ?? null) : null),
    [seasons, activeSeasonId],
  );
  const matchHistory = activeSeason?.matches ?? [];
  const current = useRef({ activeMatch, seasons, activeSeasonId });
  current.current = { activeMatch, seasons, activeSeasonId };
  useEffect(() => {
    try {
      if (activeMatch) localStorage.setItem(ACTIVE_MATCH_KEY, JSON.stringify(activeMatch));
      else localStorage.removeItem(ACTIVE_MATCH_KEY);
    } catch {}
  }, [activeMatch]);
  useEffect(() => {
    try {
      if (!activeSeasonId) return;
      localStorage.setItem(SEASONS_KEY, JSON.stringify(seasons));
      localStorage.setItem(ACTIVE_SEASON_KEY, activeSeasonId);
      const season = seasons[activeSeasonId];
      if (season) {
        localStorage.setItem(LEGACY_MATCHES_KEY, JSON.stringify(season.matches));
        localStorage.setItem(LEGACY_FULL_MATCHES_KEY, JSON.stringify(season.fullMatches));
      }
    } catch {}
  }, [seasons, activeSeasonId]);
  const setAllMatchesState = useCallback((state: SyncState) => {
    const migrated =
      state.seasons && state.activeSeasonId
        ? { seasons: state.seasons, activeSeasonId: state.activeSeasonId }
        : migrateLegacyDataToSeasons(state.matches ?? [], state.fullMatches ?? {});
    current.current = { ...migrated, activeMatch: state.activeMatch };
    setSeasons(migrated.seasons);
    setActiveSeasonId(migrated.activeSeasonId);
    setActiveMatch(state.activeMatch);
  }, []);
  // Local hook actions use the same rules as authoritative commands. Index dispatches shared actions explicitly.
  const mutate = useCallback(
    (
      type: WorkspaceCommandType,
      payload: Record<string, unknown> = {},
      targets: Pick<WorkspaceCommand, "matchId" | "seasonId"> = {},
    ) => {
      const local = current.current;
      try {
        const state = assembleWorkspace(
          local.seasons,
          local.activeSeasonId,
          local.activeMatch,
          DEFAULT_SETTINGS,
        );
        const result = applyWorkspaceCommand(state, {
          id: generateId(),
          type,
          payload,
          matchId: local.activeMatch?.id,
          seasonId: local.activeSeasonId ?? undefined,
          ...targets,
        });
        setAllMatchesState(result.state);
        return true;
      } catch {
        return false;
      }
    },
    [setAllMatchesState],
  );
  const getSeasonMatchHistory = useCallback((id: string) => seasons[id]?.matches ?? [], [seasons]);
  const getSeasonMatchDetails = useCallback(
    (id: string, matchId: string) => seasons[id]?.fullMatches[matchId] ?? null,
    [seasons],
  );
  const getMatchDetails = useCallback(
    (matchId: string, seasonId?: string) =>
      getSeasonMatchDetails(seasonId ?? activeSeasonId, matchId),
    [getSeasonMatchDetails, activeSeasonId],
  );
  const getScore = useCallback(() => {
    const goals = activeMatch?.goals ?? [];
    const myTeam = goals.filter(
      (goal) => (goal.team === "my-team") !== (goal.type === "own-goal"),
    ).length;
    return { myTeam, opponent: goals.length - myTeam };
  }, [activeMatch]);
  const getSeasonStatsById = useCallback(
    (id: string) => (seasons[id] ? getSeasonStats(seasons[id]) : null),
    [seasons],
  );
  const getSeasonSummaries = useCallback(
    () =>
      Object.values(seasons)
        .sort((a, b) =>
          a.status !== b.status ? (a.status === "active" ? -1 : 1) : b.startAt - a.startAt,
        )
        .map((season) => ({ ...season, matchCount: season.matches.length })),
    [seasons],
  );
  const deleteGoal = (goalId: string) => mutate("delete-goal", { goalId });
  const deleteEvent = (eventId: string) => mutate("delete-event", { eventId });
  const undoLast = () => {
    const match = current.current.activeMatch;
    const items = workspaceTimeline(match?.goals ?? [], match?.events ?? []);
    const last = items[items.length - 1];
    return last
      ? last.kind === "goal"
        ? deleteGoal(last.data.id)
        : deleteEvent(last.data.id)
      : false;
  };
  return {
    activeMatch,
    activeSeasonId,
    activeSeason,
    seasons,
    matchHistory,
    setAllMatchesState,
    setActiveMatchState: setActiveMatch,
    getSeasonMatchHistory,
    getSeasonMatchDetails,
    getMatchDetails,
    getScore,
    getSeasonStatsById,
    getSeasonSummaries,
    canCloseSeason: !activeMatch,
    canReopenSeason: !activeMatch,
    startMatch: (myTeamName: string, opponentName: string, isHome: boolean) =>
      mutate("start-match", { myTeamName, opponentName, isHome }),
    addGoal: (
      team: "my-team" | "opponent",
      scorer?: string,
      assist?: string,
      type: GoalType = "normal",
    ) => mutate("add-goal", { team, scorer, assist, type }),
    updateGoal: (goalId: string, changes: GoalEdit) => mutate("update-goal", { goalId, changes }),
    deleteGoal,
    addEvent: (
      eventType: GameEventType,
      label?: string,
      options?: { team?: "my-team" | "opponent"; player?: string },
    ) => mutate("add-event", { eventType, label, ...options }),
    deleteEvent,
    updateEventTime: (eventId: string, time: string) =>
      mutate("update-event-time", { eventId, time }),
    undoLast,
    startPeriod: () =>
      mutate("start-period", { expectedPeriod: current.current.activeMatch?.currentPeriod }),
    endPeriod: () =>
      mutate("end-period", { expectedPeriod: current.current.activeMatch?.currentPeriod }),
    toggleTimer: () =>
      mutate(current.current.activeMatch?.isRunning ? "pause-match" : "resume-match"),
    endMatch: () => mutate("end-match"),
    deleteMatch: (matchId: string, seasonId?: string) =>
      mutate(
        "delete-historical-match",
        {},
        { matchId, seasonId: seasonId ?? current.current.activeSeasonId },
      ),
    renameHistoricalOpponent: (matchId: string, name: string, seasonId?: string) => {
      const id = seasonId ?? current.current.activeSeasonId;
      if (!mutate("rename-historical-opponent", { name }, { matchId, seasonId: id })) return null;
      return current.current.seasons[id]?.fullMatches[matchId] ?? null;
    },
    renameOpponent: (name: string) => mutate("rename-opponent", { name }),
    closeAndStartNewSeason: (options?: { name?: string }) =>
      mutate("close-season", { name: options?.name }),
    reopenSeason: (seasonId: string) =>
      current.current.seasons[seasonId]?.status === "closed" &&
      mutate("reopen-season", {}, { seasonId }),
    renameSeasonName: (seasonId: string, name: string) =>
      mutate("rename-season", { name }, { seasonId }),
  };
}
