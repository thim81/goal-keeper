import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Match,
  Goal,
  MatchSummary,
  GoalType,
  GameEvent,
  GameEventType,
  Season,
} from '@/types/match';
import {
  closeSeasonAndCreateNext,
  createDefaultSeasonName,
  getSeasonStats,
  migrateLegacyDataToSeasons,
  renameSeason,
  reopenSeasonAsActive,
} from '@/lib/seasons';
import { SyncState } from '@/lib/sync';

const LEGACY_MATCHES_KEY = 'football-tracker-matches';
const LEGACY_FULL_MATCHES_KEY = 'football-tracker-full-matches';
const ACTIVE_MATCH_KEY = 'football-tracker-active-match';
const SEASONS_KEY = 'football-tracker-seasons';
const ACTIVE_SEASON_KEY = 'football-tracker-active-season-id';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function getCurrentTime(): string {
  const now = new Date();
  return now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
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
        status: 'active',
        matches: [],
        fullMatches: {},
      },
    },
    activeSeasonId: seasonId,
  };
}

export function useMatches() {
  const [activeMatch, setActiveMatch] = useState<Match | null>(null);
  const [seasons, setSeasons] = useState<Record<string, Season>>({});
  const [activeSeasonId, setActiveSeasonId] = useState<string | null>(null);

  const activeSeason = useMemo(
    () => (activeSeasonId ? (seasons[activeSeasonId] ?? null) : null),
    [activeSeasonId, seasons],
  );
  const matchHistory = activeSeason?.matches ?? [];

  // Load state on mount (new format first, then legacy migration)
  useEffect(() => {
    const savedActiveMatch = localStorage.getItem(ACTIVE_MATCH_KEY);
    if (savedActiveMatch) {
      setActiveMatch(JSON.parse(savedActiveMatch));
    }

    const savedSeasonsRaw = localStorage.getItem(SEASONS_KEY);
    const savedActiveSeasonId = localStorage.getItem(ACTIVE_SEASON_KEY);

    if (savedSeasonsRaw) {
      const parsedSeasons = JSON.parse(savedSeasonsRaw) as Record<string, Season>;
      const resolvedActiveSeasonId =
        savedActiveSeasonId && parsedSeasons[savedActiveSeasonId]
          ? savedActiveSeasonId
          : (Object.values(parsedSeasons).find((season) => season.status === 'active')?.id ??
            Object.keys(parsedSeasons)[0] ??
            null);

      if (resolvedActiveSeasonId) {
        setSeasons(parsedSeasons);
        setActiveSeasonId(resolvedActiveSeasonId);
        return;
      }
    }

    const legacyHistory = JSON.parse(
      localStorage.getItem(LEGACY_MATCHES_KEY) || '[]',
    ) as MatchSummary[];
    const legacyFullMatches = JSON.parse(
      localStorage.getItem(LEGACY_FULL_MATCHES_KEY) || '{}',
    ) as Record<string, Match>;
    const hasLegacy = legacyHistory.length > 0 || Object.keys(legacyFullMatches).length > 0;
    const migrated = hasLegacy
      ? migrateLegacyDataToSeasons(legacyHistory, legacyFullMatches)
      : createEmptyActiveSeason();
    setSeasons(migrated.seasons);
    setActiveSeasonId(migrated.activeSeasonId);
  }, []);

  useEffect(() => {
    if (activeMatch) {
      localStorage.setItem(ACTIVE_MATCH_KEY, JSON.stringify(activeMatch));
    } else {
      localStorage.removeItem(ACTIVE_MATCH_KEY);
    }
  }, [activeMatch]);

  useEffect(() => {
    if (!activeSeasonId) return;
    localStorage.setItem(SEASONS_KEY, JSON.stringify(seasons));
    localStorage.setItem(ACTIVE_SEASON_KEY, activeSeasonId);

    // Keep legacy keys synced to the active season as a backward-compatible fallback.
    const currentSeason = seasons[activeSeasonId];
    if (currentSeason) {
      localStorage.setItem(LEGACY_MATCHES_KEY, JSON.stringify(currentSeason.matches));
      localStorage.setItem(LEGACY_FULL_MATCHES_KEY, JSON.stringify(currentSeason.fullMatches));
    }
  }, [seasons, activeSeasonId]);

  const startMatch = useCallback(
    (myTeamName: string, opponentName: string, isHome: boolean) => {
      if (!activeSeasonId) return;

      const newMatch: Match = {
        id: generateId(),
        myTeamName: myTeamName || 'My Team',
        opponentName: opponentName || 'Opponent',
        isHome,
        goals: [],
        events: [
          {
            id: generateId(),
            type: 'start',
            label: 'Start Period 1',
            time: getCurrentTime(),
            timestamp: Date.now(),
          },
        ],
        startedAt: Date.now(),
        isActive: true,
        isRunning: true,
        totalPausedTime: 0,
        currentPeriod: 1,
      };

      setActiveMatch(newMatch);
    },
    [activeSeasonId],
  );

  const addGoal = useCallback(
    (team: 'my-team' | 'opponent', scorer?: string, assist?: string, type: GoalType = 'normal') => {
      if (!activeMatch) return;
      const newGoal: Goal = {
        id: generateId(),
        team,
        scorer: team === 'my-team' ? scorer : undefined,
        assist: team === 'my-team' ? assist : undefined,
        type,
        time: getCurrentTime(),
        timestamp: Date.now(),
      };

      setActiveMatch((prev) =>
        prev
          ? {
              ...prev,
              goals: [...prev.goals, newGoal],
            }
          : null,
      );
    },
    [activeMatch],
  );

  const deleteGoal = useCallback(
    (goalId: string) => {
      if (!activeMatch) return;
      setActiveMatch((prev) =>
        prev
          ? {
              ...prev,
              goals: prev.goals.filter((goal) => goal.id !== goalId),
            }
          : null,
      );
    },
    [activeMatch],
  );

  const addEvent = useCallback(
    (
      type: GameEventType,
      label?: string,
      options?: { team?: 'my-team' | 'opponent'; player?: string },
    ) => {
      if (!activeMatch) return;

      const newEvent: GameEvent = {
        id: generateId(),
        type,
        label,
        team: options?.team,
        player: options?.player,
        time: getCurrentTime(),
        timestamp: Date.now(),
      };

      setActiveMatch((prev) =>
        prev
          ? {
              ...prev,
              events: [...prev.events, newEvent],
            }
          : null,
      );
    },
    [activeMatch],
  );

  const deleteEvent = useCallback(
    (eventId: string) => {
      if (!activeMatch) return;
      setActiveMatch((prev) =>
        prev
          ? {
              ...prev,
              events: prev.events.filter((event) => event.id !== eventId),
            }
          : null,
      );
    },
    [activeMatch],
  );

  const startPeriod = useCallback(() => {
    setActiveMatch((prev) => {
      if (!prev) return null;
      const lastEvent = prev.events[prev.events.length - 1];
      const newPeriod =
        lastEvent?.type === 'period-end' ? prev.currentPeriod + 1 : prev.currentPeriod;

      const newEvent: GameEvent = {
        id: generateId(),
        type: 'start',
        label: `Start Period ${newPeriod}`,
        time: getCurrentTime(),
        timestamp: Date.now(),
      };

      const additionalPausedTime = prev.pausedAt ? Date.now() - prev.pausedAt : 0;
      return {
        ...prev,
        isRunning: true,
        pausedAt: undefined,
        totalPausedTime: prev.totalPausedTime + additionalPausedTime,
        currentPeriod: newPeriod,
        events: [...prev.events, newEvent],
      };
    });
  }, []);

  const endPeriod = useCallback(() => {
    setActiveMatch((prev) => {
      if (!prev) return null;

      const newEvent: GameEvent = {
        id: generateId(),
        type: 'period-end',
        label: `End Period ${prev.currentPeriod}`,
        time: getCurrentTime(),
        timestamp: Date.now(),
      };

      return {
        ...prev,
        isRunning: false,
        pausedAt: prev.isRunning ? Date.now() : prev.pausedAt,
        events: [...prev.events, newEvent],
      };
    });
  }, []);

  const toggleTimer = useCallback(() => {
    setActiveMatch((prev) => {
      if (!prev) return null;
      if (prev.isRunning) {
        return { ...prev, isRunning: false, pausedAt: Date.now() };
      }
      const additionalPausedTime = prev.pausedAt ? Date.now() - prev.pausedAt : 0;
      return {
        ...prev,
        isRunning: true,
        pausedAt: undefined,
        totalPausedTime: prev.totalPausedTime + additionalPausedTime,
      };
    });
  }, []);

  const undoLast = useCallback(() => {
    if (!activeMatch) return;

    const lastGoal = activeMatch.goals[activeMatch.goals.length - 1];
    const lastEvent = activeMatch.events[activeMatch.events.length - 1];
    if (!lastGoal && !lastEvent) return;

    if (!lastGoal) deleteEvent(lastEvent.id);
    else if (!lastEvent) deleteGoal(lastGoal.id);
    else if (lastGoal.timestamp > lastEvent.timestamp) deleteGoal(lastGoal.id);
    else deleteEvent(lastEvent.id);
  }, [activeMatch, deleteEvent, deleteGoal]);

  const endMatch = useCallback(() => {
    if (!activeMatch || !activeSeasonId) return;

    const myTeamScore = activeMatch.goals.filter(
      (goal) =>
        (goal.team === 'my-team' && goal.type !== 'own-goal') ||
        (goal.team === 'opponent' && goal.type === 'own-goal'),
    ).length;

    const opponentScore = activeMatch.goals.filter(
      (goal) =>
        (goal.team === 'opponent' && goal.type !== 'own-goal') ||
        (goal.team === 'my-team' && goal.type === 'own-goal'),
    ).length;

    const yellowCardCount = activeMatch.events.filter(
      (event) => event.type === 'yellow-card',
    ).length;
    const redCardCount = activeMatch.events.filter((event) => event.type === 'red-card').length;
    const endedAt = Date.now();

    const summary: MatchSummary = {
      id: activeMatch.id,
      myTeamName: activeMatch.myTeamName,
      opponentName: activeMatch.opponentName,
      isHome: activeMatch.isHome,
      myTeamScore,
      opponentScore,
      yellowCardCount,
      redCardCount,
      date: new Date(activeMatch.startedAt).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
      endedAt,
    };

    const finalMatch: Match = {
      ...activeMatch,
      endedAt,
      isActive: false,
      isRunning: false,
      currentPeriod: 4,
      pausedAt: activeMatch.isRunning ? endedAt : activeMatch.pausedAt,
    };

    setSeasons((prev) => {
      const season = prev[activeSeasonId];
      if (!season) return prev;
      return {
        ...prev,
        [activeSeasonId]: {
          ...season,
          matches: [summary, ...season.matches],
          fullMatches: {
            ...season.fullMatches,
            [finalMatch.id]: finalMatch,
          },
        },
      };
    });

    setActiveMatch(null);
  }, [activeMatch, activeSeasonId]);

  const getSeasonMatchHistory = useCallback(
    (seasonId: string): MatchSummary[] => seasons[seasonId]?.matches ?? [],
    [seasons],
  );

  const getSeasonMatchDetails = useCallback(
    (seasonId: string, matchId: string): Match | null =>
      seasons[seasonId]?.fullMatches[matchId] ?? null,
    [seasons],
  );

  const getMatchDetails = useCallback(
    (matchId: string, seasonId?: string): Match | null => {
      const resolvedSeasonId = seasonId ?? activeSeasonId;
      return resolvedSeasonId ? getSeasonMatchDetails(resolvedSeasonId, matchId) : null;
    },
    [activeSeasonId, getSeasonMatchDetails],
  );

  const deleteMatch = useCallback(
    (matchId: string, seasonId?: string) => {
      const resolvedSeasonId = seasonId ?? activeSeasonId;
      if (!resolvedSeasonId) return;

      setSeasons((prev) => {
        const season = prev[resolvedSeasonId];
        if (!season) return prev;
        const nextFullMatches = { ...season.fullMatches };
        delete nextFullMatches[matchId];
        return {
          ...prev,
          [resolvedSeasonId]: {
            ...season,
            matches: season.matches.filter((match) => match.id !== matchId),
            fullMatches: nextFullMatches,
          },
        };
      });
    },
    [activeSeasonId],
  );

  const renameHistoricalOpponent = useCallback(
    (matchId: string, name: string, seasonId?: string): Match | null => {
      const resolvedSeasonId = seasonId ?? activeSeasonId;
      const trimmedName = name.trim();
      if (!resolvedSeasonId || !trimmedName) return null;

      let updated: Match | null = null;
      setSeasons((prev) => {
        const season = prev[resolvedSeasonId];
        if (!season) return prev;
        const target = season.fullMatches[matchId];
        if (!target) return prev;

        updated = { ...target, opponentName: trimmedName };
        return {
          ...prev,
          [resolvedSeasonId]: {
            ...season,
            matches: season.matches.map((summary) =>
              summary.id === matchId ? { ...summary, opponentName: trimmedName } : summary,
            ),
            fullMatches: {
              ...season.fullMatches,
              [matchId]: updated,
            },
          },
        };
      });

      setActiveMatch((prev) =>
        prev && prev.id === matchId ? { ...prev, opponentName: trimmedName } : prev,
      );
      return updated;
    },
    [activeSeasonId],
  );

  const renameOpponent = useCallback((name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setActiveMatch((prev) => (prev ? { ...prev, opponentName: trimmedName } : null));
  }, []);

  const getScore = useCallback(() => {
    if (!activeMatch) return { myTeam: 0, opponent: 0 };
    const myTeam = activeMatch.goals.filter(
      (goal) =>
        (goal.team === 'my-team' && goal.type !== 'own-goal') ||
        (goal.team === 'opponent' && goal.type === 'own-goal'),
    ).length;
    const opponent = activeMatch.goals.filter(
      (goal) =>
        (goal.team === 'opponent' && goal.type !== 'own-goal') ||
        (goal.team === 'my-team' && goal.type === 'own-goal'),
    ).length;
    return { myTeam, opponent };
  }, [activeMatch]);

  const setAllMatchesState = useCallback((state: SyncState) => {
    if (state.seasons && state.activeSeasonId) {
      setSeasons(state.seasons);
      setActiveSeasonId(state.activeSeasonId);
      setActiveMatch(state.activeMatch);
      return;
    }

    const migrated = migrateLegacyDataToSeasons(state.matches ?? [], state.fullMatches ?? {});
    setSeasons(migrated.seasons);
    setActiveSeasonId(migrated.activeSeasonId);
    setActiveMatch(state.activeMatch);
  }, []);

  const canCloseSeason = !activeMatch;
  const canReopenSeason = !activeMatch;

  const closeAndStartNewSeason = useCallback(
    (options?: { name?: string }): boolean => {
      if (!activeSeasonId || activeMatch) return false;
      const next = closeSeasonAndCreateNext(seasons, activeSeasonId, options?.name);
      setSeasons(next.seasons);
      setActiveSeasonId(next.activeSeasonId);
      return true;
    },
    [activeSeasonId, activeMatch, seasons],
  );

  const reopenSeason = useCallback(
    (seasonId: string): boolean => {
      if (!activeSeasonId || activeMatch) return false;
      const season = seasons[seasonId];
      if (!season || season.status !== 'closed') return false;
      const next = reopenSeasonAsActive(seasons, activeSeasonId, seasonId);
      setSeasons(next.seasons);
      setActiveSeasonId(next.activeSeasonId);
      return true;
    },
    [activeSeasonId, activeMatch, seasons],
  );

  const renameSeasonName = useCallback(
    (seasonId: string, name: string): boolean => {
      const trimmed = name.trim();
      if (!trimmed) return false;
      if (!seasons[seasonId]) return false;
      setSeasons((prev) => renameSeason(prev, seasonId, trimmed));
      return true;
    },
    [seasons],
  );

  const getSeasonSummaries = useCallback(() => {
    return Object.values(seasons)
      .sort((a, b) => {
        if (a.status === 'active' && b.status !== 'active') return -1;
        if (a.status !== 'active' && b.status === 'active') return 1;
        return b.startAt - a.startAt;
      })
      .map((season) => ({
        id: season.id,
        name: season.name,
        status: season.status,
        startAt: season.startAt,
        closedAt: season.closedAt,
        matchCount: season.matches.length,
      }));
  }, [seasons]);

  const getSeasonStatsById = useCallback(
    (seasonId: string) => {
      const season = seasons[seasonId];
      return season ? getSeasonStats(season) : null;
    },
    [seasons],
  );

  return {
    activeMatch,
    activeSeasonId,
    activeSeason,
    seasons,
    matchHistory,
    startMatch,
    addGoal,
    deleteGoal,
    addEvent,
    deleteEvent,
    undoLast,
    endMatch,
    getMatchDetails,
    getSeasonMatchHistory,
    getSeasonMatchDetails,
    deleteMatch,
    renameHistoricalOpponent,
    getScore,
    startPeriod,
    endPeriod,
    toggleTimer,
    setAllMatchesState,
    renameOpponent,
    canCloseSeason,
    canReopenSeason,
    closeAndStartNewSeason,
    reopenSeason,
    renameSeasonName,
    getSeasonSummaries,
    getSeasonStatsById,
  };
}
