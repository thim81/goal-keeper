import { useState, useEffect, useCallback, useMemo } from "react";
import { Match, MatchSummary, Season, DEFAULT_SETTINGS } from "@/types/match";
import { createDefaultSeasonName, getSeasonStats, migrateLegacyDataToSeasons } from "@/lib/seasons";
import type { SyncState } from "@/lib/sync";
import { readWorkspaceCache, assembleWorkspace, preserveLegacyCache } from "@/lib/workspace-cache";
import { normalizeWorkspace } from "@/lib/workspace";

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
  const state = normalizeWorkspace(
    assembleWorkspace(seasons, activeSeasonId, activeMatch, DEFAULT_SETTINGS),
  );
  return { activeMatch: state.activeMatch, seasons, activeSeasonId };
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
    setSeasons(migrated.seasons);
    setActiveSeasonId(migrated.activeSeasonId);
    setActiveMatch(state.activeMatch);
  }, []);
  const getSeasonMatchHistory = useCallback((id: string) => seasons[id]?.matches ?? [], [seasons]);
  const getSeasonMatchDetails = useCallback(
    (id: string, matchId: string) => seasons[id]?.fullMatches[matchId] ?? null,
    [seasons],
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
  return {
    activeMatch,
    activeSeasonId,
    seasons,
    matchHistory,
    setAllMatchesState,
    setActiveMatchState: setActiveMatch,
    getSeasonMatchHistory,
    getSeasonMatchDetails,
    getScore,
    getSeasonStatsById,
    getSeasonSummaries,
    canCloseSeason: !activeMatch,
    canReopenSeason: !activeMatch,
  };
}
