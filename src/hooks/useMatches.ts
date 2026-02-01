import { useState, useEffect, useCallback } from 'react';
import { Match, Goal, MatchSummary, GoalType, GameEvent, GameEventType } from '@/types/match';

const STORAGE_KEY = 'football-tracker-matches';
const ACTIVE_MATCH_KEY = 'football-tracker-active-match';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function getCurrentTime(): string {
  const now = new Date();
  return now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function useMatches() {
  const [activeMatch, setActiveMatch] = useState<Match | null>(null);
  const [matchHistory, setMatchHistory] = useState<MatchSummary[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    const savedActive = localStorage.getItem(ACTIVE_MATCH_KEY);
    const savedHistory = localStorage.getItem(STORAGE_KEY);

    if (savedActive) {
      setActiveMatch(JSON.parse(savedActive));
    }
    if (savedHistory) {
      setMatchHistory(JSON.parse(savedHistory));
    }
  }, []);

  // Save active match to localStorage
  useEffect(() => {
    if (activeMatch) {
      localStorage.setItem(ACTIVE_MATCH_KEY, JSON.stringify(activeMatch));
    } else {
      localStorage.removeItem(ACTIVE_MATCH_KEY);
    }
  }, [activeMatch]);

  // Save history to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(matchHistory));
  }, [matchHistory]);

  const startMatch = useCallback((myTeamName: string, opponentName: string, isHome: boolean) => {
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
  }, []);

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
              goals: prev.goals.filter((g) => g.id !== goalId),
            }
          : null,
      );
    },
    [activeMatch],
  );

  const addEvent = useCallback(
    (type: GameEventType, label?: string) => {
      if (!activeMatch) return;

      const newEvent: GameEvent = {
        id: generateId(),
        type,
        label,
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
              events: prev.events.filter((e) => e.id !== eventId),
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
      const isInitialStart = prev.events.length === 1 && prev.events[0].type === 'start';

      // If the last event was already a start event (e.g. from startMatch), don't increment period yet
      // but ensure it's running. Actually, startMatch already sets currentPeriod: 1 and adds the event.
      // If we are calling startPeriod manually, it's usually after an endPeriod.

      const newPeriod =
        lastEvent?.type === 'period-end' ? prev.currentPeriod + 1 : prev.currentPeriod;

      const newEvent: GameEvent = {
        id: generateId(),
        type: 'start',
        label: `Start Period ${newPeriod}`,
        time: getCurrentTime(),
        timestamp: Date.now(),
      };

      let additionalPausedTime = 0;
      if (prev.pausedAt) {
        additionalPausedTime = Date.now() - prev.pausedAt;
      }

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
    // If we call endPeriod multiple times or when not running, we might still want to log it if it's the last action
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
        // Pause
        return {
          ...prev,
          isRunning: false,
          pausedAt: Date.now(),
        };
      } else {
        // Resume
        const additionalPausedTime = prev.pausedAt ? Date.now() - prev.pausedAt : 0;
        return {
          ...prev,
          isRunning: true,
          pausedAt: undefined,
          totalPausedTime: prev.totalPausedTime + additionalPausedTime,
        };
      }
    });
  }, []);

  const undoLast = useCallback(() => {
    if (!activeMatch) return;

    const lastGoal = activeMatch.goals[activeMatch.goals.length - 1];
    const lastEvent = activeMatch.events[activeMatch.events.length - 1];

    // Find which one is more recent and remove it
    if (!lastGoal && !lastEvent) return;

    if (!lastGoal) {
      deleteEvent(lastEvent.id);
    } else if (!lastEvent) {
      deleteGoal(lastGoal.id);
    } else if (lastGoal.timestamp > lastEvent.timestamp) {
      deleteGoal(lastGoal.id);
    } else {
      deleteEvent(lastEvent.id);
    }
  }, [activeMatch, deleteGoal, deleteEvent]);

  const endMatch = useCallback(() => {
    setActiveMatch((prev) => {
      if (!prev) return null;

      const myTeamScore = prev.goals.filter(
        (g) =>
          (g.team === 'my-team' && g.type !== 'own-goal') ||
          (g.team === 'opponent' && g.type === 'own-goal'),
      ).length;

      const opponentScore = prev.goals.filter(
        (g) =>
          (g.team === 'opponent' && g.type !== 'own-goal') ||
          (g.team === 'my-team' && g.type === 'own-goal'),
      ).length;

      const summary: MatchSummary = {
        id: prev.id,
        myTeamName: prev.myTeamName,
        opponentName: prev.opponentName,
        isHome: prev.isHome,
        myTeamScore,
        opponentScore,
        date: new Date(prev.startedAt).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
        endedAt: Date.now(),
      };

      // Save full match data for detail view
      const fullMatches = JSON.parse(localStorage.getItem('football-tracker-full-matches') || '{}');
      fullMatches[prev.id] = {
        ...prev,
        endedAt: Date.now(),
        isActive: false,
        isRunning: false,
        currentPeriod: 4,
        pausedAt: prev.isRunning ? Date.now() : prev.pausedAt,
      };
      localStorage.setItem('football-tracker-full-matches', JSON.stringify(fullMatches));

      setMatchHistory((history) => [summary, ...history]);
      return null;
    });
  }, []);

  const getMatchDetails = useCallback((matchId: string): Match | null => {
    const fullMatches = JSON.parse(localStorage.getItem('football-tracker-full-matches') || '{}');
    return fullMatches[matchId] || null;
  }, []);

  const deleteMatch = useCallback((matchId: string) => {
    setMatchHistory((prev) => prev.filter((m) => m.id !== matchId));
    const fullMatches = JSON.parse(localStorage.getItem('football-tracker-full-matches') || '{}');
    delete fullMatches[matchId];
    localStorage.setItem('football-tracker-full-matches', JSON.stringify(fullMatches));
  }, []);

  const getScore = useCallback(() => {
    if (!activeMatch) return { myTeam: 0, opponent: 0 };

    const myTeam = activeMatch.goals.filter(
      (g) =>
        (g.team === 'my-team' && g.type !== 'own-goal') ||
        (g.team === 'opponent' && g.type === 'own-goal'),
    ).length;

    const opponent = activeMatch.goals.filter(
      (g) =>
        (g.team === 'opponent' && g.type !== 'own-goal') ||
        (g.team === 'my-team' && g.type === 'own-goal'),
    ).length;

    return { myTeam, opponent };
  }, [activeMatch]);

  const setAllMatchesState = useCallback(
    (history: MatchSummary[], active: Match | null, fullMatches: Record<string, Match>) => {
      setMatchHistory(history);
      setActiveMatch(active);
      localStorage.setItem('football-tracker-full-matches', JSON.stringify(fullMatches));
    },
    [],
  );

  return {
    activeMatch,
    matchHistory,
    startMatch,
    addGoal,
    deleteGoal,
    addEvent,
    deleteEvent,
    undoLast,
    endMatch,
    getMatchDetails,
    deleteMatch,
    getScore,
    startPeriod,
    endPeriod,
    toggleTimer,
    setAllMatchesState,
  };
}
