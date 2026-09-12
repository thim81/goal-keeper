// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Match } from '@/types/match';
import { MatchDetail } from './MatchDetail';

const awayMatch: Match = {
  id: 'match-1',
  myTeamName: 'IPU15',
  opponentName: 'Opponent',
  isHome: false,
  goals: [],
  events: [
    { id: 'my-yellow', type: 'yellow-card', team: 'my-team', time: '10:00', timestamp: 600 },
    { id: 'opponent-yellow-1', type: 'yellow-card', team: 'opponent', time: '11:00', timestamp: 660 },
    { id: 'opponent-yellow-2', type: 'yellow-card', team: 'opponent', time: '12:00', timestamp: 720 },
    { id: 'opponent-yellow-3', type: 'yellow-card', team: 'opponent', time: '13:00', timestamp: 780 },
  ],
  startedAt: Date.parse('2026-09-05T12:00:00.000Z'),
  endedAt: Date.parse('2026-09-05T13:00:00.000Z'),
  isActive: false,
  isRunning: false,
  totalPausedTime: 0,
  currentPeriod: 4,
};

describe('MatchDetail', () => {
  it('renders yellow cards in home-away order for away matches', () => {
    const { container } = render(<MatchDetail match={awayMatch} onBack={vi.fn()} />);
    const scoreboard = container.querySelector('.scoreboard-gradient');
    const yellowCards = scoreboard?.querySelectorAll('span.bg-yellow-400');

    expect(yellowCards).toHaveLength(2);
    expect(yellowCards?.[0].parentElement).toHaveTextContent('3');
    expect(yellowCards?.[1].parentElement).toHaveTextContent('1');
  });
});
