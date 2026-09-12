// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMatches } from './useMatches';

async function setupWithMatch(overrides?: {
  myTeamName?: string;
  opponentName?: string;
  isHome?: boolean;
}) {
  const { result } = renderHook(() => useMatches());
  await waitFor(() => expect(result.current.activeSeasonId).toBeTruthy());
  act(() => {
    result.current.startMatch(
      overrides?.myTeamName ?? 'My Team',
      overrides?.opponentName ?? 'Opponent',
      overrides?.isHome ?? true,
    );
  });
  return result;
}

describe('useMatches period history', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores the actual current period when a match ends', async () => {
    const { result } = renderHook(() => useMatches());

    await waitFor(() => expect(result.current.activeSeasonId).toBeTruthy());

    act(() => {
      result.current.startMatch('My Team', 'Opponent', true);
    });
    act(() => {
      result.current.endPeriod();
    });
    act(() => {
      result.current.endMatch();
    });

    const season = result.current.seasons[result.current.activeSeasonId!];
    const savedMatchId = season.matches[0].id;
    expect(season.fullMatches[savedMatchId].currentPeriod).toBe(1);
  });

  it('allows starting additional periods after the configured count', async () => {
    const { result } = renderHook(() => useMatches());

    await waitFor(() => expect(result.current.activeSeasonId).toBeTruthy());

    act(() => {
      result.current.startMatch('My Team', 'Opponent', true);
      result.current.endPeriod();
    });
    act(() => {
      result.current.startPeriod();
    });

    expect(result.current.activeMatch?.currentPeriod).toBe(2);
    expect(result.current.activeMatch?.isRunning).toBe(true);
  });
});

describe('useMatches goals, events and score', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('tallies normal goals scored by both teams', async () => {
    const result = await setupWithMatch();

    act(() => {
      result.current.addGoal('my-team', 'Alice');
      result.current.addGoal('opponent');
      result.current.addGoal('my-team', 'Bob');
    });

    expect(result.current.getScore()).toEqual({ myTeam: 2, opponent: 1 });
  });

  it('credits own goals to the opposing team', async () => {
    const result = await setupWithMatch();

    act(() => {
      result.current.addGoal('my-team', undefined, undefined, 'own-goal');
      result.current.addGoal('opponent', undefined, undefined, 'own-goal');
    });

    expect(result.current.getScore()).toEqual({ myTeam: 1, opponent: 1 });
  });

  it('removes a specific goal via deleteGoal without touching the others', async () => {
    const result = await setupWithMatch();

    act(() => {
      result.current.addGoal('my-team', 'Alice');
      result.current.addGoal('opponent');
    });
    const [firstGoal] = result.current.activeMatch!.goals;

    act(() => {
      result.current.deleteGoal(firstGoal.id);
    });

    expect(result.current.activeMatch!.goals).toHaveLength(1);
    expect(result.current.activeMatch!.goals[0].team).toBe('opponent');
  });

  it('adds and removes events with team/player metadata', async () => {
    const result = await setupWithMatch();

    act(() => {
      result.current.addEvent('yellow-card', 'Yellow card', {
        team: 'opponent',
        player: 'Carl',
      });
    });
    const cardEvent = result.current.activeMatch!.events.find((e) => e.type === 'yellow-card');
    expect(cardEvent).toMatchObject({ team: 'opponent', player: 'Carl', label: 'Yellow card' });

    act(() => {
      result.current.deleteEvent(cardEvent!.id);
    });
    expect(result.current.activeMatch!.events.some((e) => e.type === 'yellow-card')).toBe(false);
  });
});

describe('useMatches undoLast', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('undoes the most recent goal when it postdates the last event', async () => {
    const { result } = renderHook(() => useMatches());
    await waitFor(() => expect(result.current.activeSeasonId).toBeTruthy());

    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    act(() => {
      result.current.startMatch('My Team', 'Opponent', true);
    });

    vi.setSystemTime(1_000_500);
    act(() => {
      result.current.addGoal('my-team', 'Alice');
    });

    act(() => {
      result.current.undoLast();
    });

    expect(result.current.activeMatch!.goals).toHaveLength(0);
    expect(result.current.activeMatch!.events).toHaveLength(1);
  });

  it('undoes the most recent event when it postdates the last goal', async () => {
    const { result } = renderHook(() => useMatches());
    await waitFor(() => expect(result.current.activeSeasonId).toBeTruthy());

    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    act(() => {
      result.current.startMatch('My Team', 'Opponent', true);
    });

    vi.setSystemTime(1_000_500);
    act(() => {
      result.current.addGoal('my-team', 'Alice');
    });
    vi.setSystemTime(1_001_000);
    act(() => {
      result.current.addEvent('yellow-card', 'Yellow card');
    });

    act(() => {
      result.current.undoLast();
    });

    expect(result.current.activeMatch!.events.some((e) => e.type === 'yellow-card')).toBe(false);
    expect(result.current.activeMatch!.goals).toHaveLength(1);
  });

  it('removes the initial start event when undone with no goals yet, and is a no-op after that', async () => {
    const result = await setupWithMatch();
    expect(result.current.activeMatch!.events).toHaveLength(1);

    act(() => {
      result.current.undoLast();
    });
    expect(result.current.activeMatch!.events).toHaveLength(0);

    act(() => {
      result.current.undoLast();
    });
    expect(result.current.activeMatch!.events).toHaveLength(0);
    expect(result.current.activeMatch!.goals).toHaveLength(0);
  });
});

describe('useMatches timer control', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('accumulates paused time across a pause/resume cycle', async () => {
    const result = await setupWithMatch();

    vi.useFakeTimers();
    vi.setSystemTime(2_000_000);
    act(() => {
      result.current.toggleTimer();
    });
    expect(result.current.activeMatch!.isRunning).toBe(false);
    expect(result.current.activeMatch!.pausedAt).toBe(2_000_000);

    vi.setSystemTime(2_005_000);
    act(() => {
      result.current.toggleTimer();
    });

    expect(result.current.activeMatch!.isRunning).toBe(true);
    expect(result.current.activeMatch!.pausedAt).toBeUndefined();
    expect(result.current.activeMatch!.totalPausedTime).toBe(5000);
  });

  it('marks the match paused and logs a period-end event on endPeriod', async () => {
    const result = await setupWithMatch();

    act(() => {
      result.current.endPeriod();
    });

    expect(result.current.activeMatch!.isRunning).toBe(false);
    expect(
      result.current.activeMatch!.events[result.current.activeMatch!.events.length - 1],
    ).toMatchObject({
      type: 'period-end',
      label: 'End Period 1',
    });
  });
});

describe('useMatches endMatch summary', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('computes the final score and card counts, including own goals, and archives the match', async () => {
    const result = await setupWithMatch({ opponentName: 'Rivals' });

    act(() => {
      result.current.addGoal('my-team', 'Alice');
      result.current.addGoal('opponent');
      result.current.addGoal('my-team', undefined, undefined, 'own-goal');
      result.current.addEvent('yellow-card');
      result.current.addEvent('yellow-card');
      result.current.addEvent('red-card');
    });

    const matchId = result.current.activeMatch!.id;
    act(() => {
      result.current.endMatch();
    });

    expect(result.current.activeMatch).toBeNull();
    const season = result.current.seasons[result.current.activeSeasonId!];
    const summary = season.matches[0];
    expect(summary).toMatchObject({
      id: matchId,
      opponentName: 'Rivals',
      myTeamScore: 1,
      opponentScore: 2,
      yellowCardCount: 2,
      redCardCount: 1,
    });
    expect(season.fullMatches[matchId]).toMatchObject({ isActive: false, isRunning: false });
  });
});

describe('useMatches match management', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('deletes a historical match from the active season', async () => {
    const result = await setupWithMatch();
    act(() => {
      result.current.endMatch();
    });
    const matchId = result.current.seasons[result.current.activeSeasonId!].matches[0].id;

    act(() => {
      result.current.deleteMatch(matchId);
    });

    const season = result.current.seasons[result.current.activeSeasonId!];
    expect(season.matches).toHaveLength(0);
    expect(season.fullMatches[matchId]).toBeUndefined();
  });

  it('renames the opponent on a historical match in both the summary and full record', async () => {
    const result = await setupWithMatch({ opponentName: 'Old Name' });
    act(() => {
      result.current.endMatch();
    });
    const matchId = result.current.seasons[result.current.activeSeasonId!].matches[0].id;

    act(() => {
      result.current.renameHistoricalOpponent(matchId, ' New Name ');
    });

    const season = result.current.seasons[result.current.activeSeasonId!];
    expect(season.matches[0].opponentName).toBe('New Name');
    expect(season.fullMatches[matchId].opponentName).toBe('New Name');
  });

  it('renames the opponent on the live match', async () => {
    const result = await setupWithMatch({ opponentName: 'Old Name' });

    act(() => {
      result.current.renameOpponent(' New Name ');
    });
    expect(result.current.activeMatch!.opponentName).toBe('New Name');

    act(() => {
      result.current.renameOpponent('   ');
    });
    expect(result.current.activeMatch!.opponentName).toBe('New Name');
  });
});

describe('useMatches season lifecycle', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('blocks closing or reopening a season while a match is in progress', async () => {
    const result = await setupWithMatch();

    expect(result.current.canCloseSeason).toBe(false);
    expect(result.current.canReopenSeason).toBe(false);

    let closed = true;
    act(() => {
      closed = result.current.closeAndStartNewSeason();
    });
    expect(closed).toBe(false);

    let reopened = true;
    act(() => {
      reopened = result.current.reopenSeason('any-season-id');
    });
    expect(reopened).toBe(false);
  });

  it('closes the active season and starts a fresh one when no match is active', async () => {
    const { result } = renderHook(() => useMatches());
    await waitFor(() => expect(result.current.activeSeasonId).toBeTruthy());
    const originalSeasonId = result.current.activeSeasonId!;

    expect(result.current.canCloseSeason).toBe(true);

    let created = false;
    act(() => {
      created = result.current.closeAndStartNewSeason({ name: '2027-2028' });
    });

    expect(created).toBe(true);
    expect(result.current.activeSeasonId).not.toBe(originalSeasonId);
    expect(result.current.seasons[originalSeasonId].status).toBe('closed');
    expect(result.current.seasons[result.current.activeSeasonId!]).toMatchObject({
      status: 'active',
      name: '2027-2028',
    });
  });

  it('reopens a closed season and closes the currently active one in its place', async () => {
    const { result } = renderHook(() => useMatches());
    await waitFor(() => expect(result.current.activeSeasonId).toBeTruthy());
    const originalSeasonId = result.current.activeSeasonId!;

    act(() => {
      result.current.closeAndStartNewSeason();
    });
    const newSeasonId = result.current.activeSeasonId!;

    let reopened = false;
    act(() => {
      reopened = result.current.reopenSeason(originalSeasonId);
    });

    expect(reopened).toBe(true);
    expect(result.current.activeSeasonId).toBe(originalSeasonId);
    expect(result.current.seasons[originalSeasonId].status).toBe('active');
    expect(result.current.seasons[newSeasonId].status).toBe('closed');
  });

  it('refuses to reopen a season that is not closed', async () => {
    const { result } = renderHook(() => useMatches());
    await waitFor(() => expect(result.current.activeSeasonId).toBeTruthy());

    let reopened = true;
    act(() => {
      reopened = result.current.reopenSeason(result.current.activeSeasonId!);
    });

    expect(reopened).toBe(false);
  });

  it('lists the active season first regardless of when the other seasons started', async () => {
    const { result } = renderHook(() => useMatches());
    await waitFor(() => expect(result.current.activeSeasonId).toBeTruthy());

    act(() => {
      result.current.closeAndStartNewSeason({ name: 'Newest Season' });
    });

    const summaries = result.current.getSeasonSummaries();
    expect(summaries[0]).toMatchObject({
      id: result.current.activeSeasonId,
      status: 'active',
      name: 'Newest Season',
    });
    expect(summaries).toHaveLength(2);
  });

  it('returns season stats for a known season and null for an unknown one', async () => {
    const result = await setupWithMatch();
    act(() => {
      result.current.addGoal('my-team', 'Alice');
    });
    act(() => {
      result.current.endMatch();
    });

    const stats = result.current.getSeasonStatsById(result.current.activeSeasonId!);
    expect(stats).toMatchObject({ wins: 1, goalsFor: 1, goalsAgainst: 0 });
    expect(result.current.getSeasonStatsById('does-not-exist')).toBeNull();
  });
});
