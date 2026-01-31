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
      events: [],
      startedAt: Date.now(),
      isActive: true,
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
    if (!activeMatch) return;

    const myTeamScore = activeMatch.goals.filter(
      (g) =>
        (g.team === 'my-team' && g.type !== 'own-goal') ||
        (g.team === 'opponent' && g.type === 'own-goal'),
    ).length;

    const opponentScore = activeMatch.goals.filter(
      (g) =>
        (g.team === 'opponent' && g.type !== 'own-goal') ||
        (g.team === 'my-team' && g.type === 'own-goal'),
    ).length;

    const summary: MatchSummary = {
      id: activeMatch.id,
      myTeamName: activeMatch.myTeamName,
      opponentName: activeMatch.opponentName,
      isHome: activeMatch.isHome,
      myTeamScore,
      opponentScore,
      date: new Date(activeMatch.startedAt).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
      endedAt: Date.now(),
    };

    // Save full match data for detail view
    const fullMatches = JSON.parse(localStorage.getItem('football-tracker-full-matches') || '{}');
    fullMatches[activeMatch.id] = { ...activeMatch, endedAt: Date.now(), isActive: false };
    localStorage.setItem('football-tracker-full-matches', JSON.stringify(fullMatches));

    setMatchHistory((prev) => [summary, ...prev]);
    setActiveMatch(null);
  }, [activeMatch]);

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
  };
}
