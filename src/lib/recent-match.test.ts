import { describe, expect, it } from 'vitest';
import type { MatchSummary } from '@/types/match';
import { getRecentMatchWithinDays } from './recent-match';

const now = Date.parse('2026-09-05T12:00:00.000Z');

const makeMatch = (endedAt: number, id = 'match'): MatchSummary => ({
  id,
  myTeamName: 'My Team',
  opponentName: 'Opponent',
  isHome: true,
  myTeamScore: 2,
  opponentScore: 1,
  date: '05/09/2026',
  endedAt,
});

describe('getRecentMatchWithinDays', () => {
  it('returns the latest match within seven days', () => {
    const latest = makeMatch(now - 2 * 24 * 60 * 60 * 1000, 'latest');
    const older = makeMatch(now - 4 * 24 * 60 * 60 * 1000, 'older');

    expect(getRecentMatchWithinDays([older, latest], now)).toEqual(latest);
  });

  it('includes a match completed exactly seven days ago', () => {
    const boundary = makeMatch(now - 7 * 24 * 60 * 60 * 1000, 'boundary');

    expect(getRecentMatchWithinDays([boundary], now)).toEqual(boundary);
  });

  it('returns no match when history is empty or the latest match is too old', () => {
    expect(getRecentMatchWithinDays([], now)).toBeNull();
    expect(getRecentMatchWithinDays([makeMatch(now - 8 * 24 * 60 * 60 * 1000)], now)).toBeNull();
  });
});
