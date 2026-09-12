// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
    {
      id: 'opponent-yellow-1',
      type: 'yellow-card',
      team: 'opponent',
      time: '11:00',
      timestamp: 660,
    },
    {
      id: 'opponent-yellow-2',
      type: 'yellow-card',
      team: 'opponent',
      time: '12:00',
      timestamp: 720,
    },
    {
      id: 'opponent-yellow-3',
      type: 'yellow-card',
      team: 'opponent',
      time: '13:00',
      timestamp: 780,
    },
  ],
  startedAt: Date.parse('2026-09-05T12:00:00.000Z'),
  endedAt: Date.parse('2026-09-05T13:00:00.000Z'),
  isActive: false,
  isRunning: false,
  totalPausedTime: 0,
  currentPeriod: 4,
};

const homeMatch: Match = {
  id: 'match-2',
  myTeamName: 'My Team',
  opponentName: 'Rivals FC',
  isHome: true,
  goals: [
    {
      id: 'g1',
      team: 'my-team',
      scorer: 'Alice',
      assist: 'Bob',
      type: 'normal',
      time: '10:00',
      timestamp: 1,
    },
    { id: 'g2', team: 'my-team', scorer: 'Alice', type: 'normal', time: '20:00', timestamp: 2 },
    {
      id: 'g3',
      team: 'my-team',
      scorer: 'Cara',
      assist: 'Bob',
      type: 'normal',
      time: '30:00',
      timestamp: 3,
    },
    { id: 'g4', team: 'opponent', type: 'normal', time: '40:00', timestamp: 4 },
    { id: 'g5', team: 'my-team', type: 'own-goal', time: '50:00', timestamp: 5 },
  ],
  events: [
    { id: 'e1', type: 'yellow-card', team: 'my-team', time: '15:00', timestamp: 1.5 },
    { id: 'e2', type: 'yellow-card', team: 'opponent', time: '25:00', timestamp: 2.5 },
    { id: 'e3', type: 'red-card', team: 'opponent', time: '35:00', timestamp: 3.5 },
  ],
  startedAt: Date.parse('2026-09-05T12:00:00.000Z'),
  endedAt: Date.parse('2026-09-05T13:50:00.000Z'),
  isActive: false,
  isRunning: false,
  totalPausedTime: 0,
  currentPeriod: 4,
};

describe('MatchDetail', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders yellow cards in home-away order for away matches', () => {
    const { container } = render(<MatchDetail match={awayMatch} onBack={vi.fn()} />);
    const scoreboard = container.querySelector('.scoreboard-gradient');
    const yellowCards = scoreboard?.querySelectorAll('span.bg-yellow-400');

    expect(yellowCards).toHaveLength(2);
    expect(yellowCards?.[0].parentElement).toHaveTextContent('3');
    expect(yellowCards?.[1].parentElement).toHaveTextContent('1');
  });

  it('computes the score (counting own goals for the other side) and the result label', () => {
    const { container } = render(<MatchDetail match={homeMatch} onBack={vi.fn()} />);
    const scoreboard = container.querySelector('.scoreboard-gradient') as HTMLElement;

    expect(within(scoreboard).getByText('3')).toBeInTheDocument();
    expect(within(scoreboard).getByText('2')).toBeInTheDocument();
    expect(within(scoreboard).getByText('Victory!')).toBeInTheDocument();
  });

  it('splits yellow/red card totals between the home and away columns', () => {
    const { container } = render(<MatchDetail match={homeMatch} onBack={vi.fn()} />);
    const scoreboard = container.querySelector('.scoreboard-gradient') as HTMLElement;
    const [homeCards, awayCards] = scoreboard.querySelectorAll('.mt-4.grid > div');

    expect(homeCards).toHaveTextContent('1');
    expect(homeCards.querySelectorAll('span.bg-red-500')).toHaveLength(0);
    expect(awayCards.querySelectorAll('span.bg-yellow-400')).toHaveLength(1);
    expect(awayCards.querySelectorAll('span.bg-red-500')).toHaveLength(1);
  });

  it('ranks top scorers and assisters by goal/assist count', () => {
    render(<MatchDetail match={homeMatch} onBack={vi.fn()} />);

    const scorerNames = screen.getAllByText(/Alice|Cara/).map((el) => el.textContent);
    expect(scorerNames.indexOf('Alice')).toBeLessThan(scorerNames.indexOf('Cara'));
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('renames the opponent after a long press on the editable side, and Cancel discards edits', () => {
    vi.useFakeTimers();
    const onRenameOpponent = vi.fn();
    render(<MatchDetail match={homeMatch} onBack={vi.fn()} onRenameOpponent={onRenameOpponent} />);

    const opponentButton = screen.getByTitle('Rivals FC (long press to edit)');
    fireEvent.pointerDown(opponentButton);
    act(() => {
      vi.advanceTimersByTime(500);
    });

    const nameInput = screen.getByPlaceholderText('Opponent name');
    fireEvent.change(nameInput, { target: { value: 'New Rivals' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(onRenameOpponent).toHaveBeenCalledWith('New Rivals');
    expect(screen.queryByPlaceholderText('Opponent name')).not.toBeInTheDocument();
  });

  it('discards the draft without renaming when the dialog is cancelled', () => {
    vi.useFakeTimers();
    const onRenameOpponent = vi.fn();
    render(<MatchDetail match={homeMatch} onBack={vi.fn()} onRenameOpponent={onRenameOpponent} />);

    fireEvent.pointerDown(screen.getByTitle('Rivals FC (long press to edit)'));
    act(() => {
      vi.advanceTimersByTime(500);
    });

    const nameInput = screen.getByPlaceholderText('Opponent name');
    fireEvent.change(nameInput, { target: { value: 'Discarded Name' } });
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onRenameOpponent).not.toHaveBeenCalled();
    expect(screen.queryByPlaceholderText('Opponent name')).not.toBeInTheDocument();
  });
});
