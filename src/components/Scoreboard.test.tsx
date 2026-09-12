import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Scoreboard } from './Scoreboard';
import type { Match } from '@/types/match';

function createMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'm1',
    myTeamName: 'My Team',
    opponentName: 'Rivals',
    isHome: true,
    goals: [],
    events: [],
    startedAt: Date.now(),
    isActive: true,
    isRunning: true,
    totalPausedTime: 0,
    currentPeriod: 1,
    ...overrides,
  };
}

describe('Scoreboard', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('places my team on the left with its own score when home', () => {
    const { container } = render(
      <Scoreboard match={createMatch({ isHome: true })} myTeamScore={2} opponentScore={1} />,
    );
    const [leftSide, rightSide] = container.querySelectorAll('.flex-1.basis-0');

    expect(within(leftSide as HTMLElement).getByText('My Team')).toBeInTheDocument();
    expect(within(rightSide as HTMLElement).getByText('Rivals')).toBeInTheDocument();
    expect(within(leftSide as HTMLElement).getByText('My Team').tagName).toBe('P');
    expect(within(rightSide as HTMLElement).getByText('Rivals').tagName).toBe('BUTTON');
  });

  it('places the opponent on the left with its score when away', () => {
    const { container } = render(
      <Scoreboard match={createMatch({ isHome: false })} myTeamScore={2} opponentScore={1} />,
    );
    const [leftSide, rightSide] = container.querySelectorAll('.flex-1.basis-0');

    expect(within(leftSide as HTMLElement).getByText('Rivals').tagName).toBe('BUTTON');
    expect(within(rightSide as HTMLElement).getByText('My Team').tagName).toBe('P');
  });

  it('triggers the long-press callback after holding the opponent name for 500ms', () => {
    vi.useFakeTimers();
    const onOpponentLongPress = vi.fn();
    render(
      <Scoreboard
        match={createMatch({ isHome: true })}
        myTeamScore={0}
        opponentScore={0}
        onOpponentLongPress={onOpponentLongPress}
      />,
    );

    fireEvent.pointerDown(screen.getByText('Rivals'));
    vi.advanceTimersByTime(500);

    expect(onOpponentLongPress).toHaveBeenCalledTimes(1);
  });

  it('does not trigger the long-press callback on a quick tap', () => {
    vi.useFakeTimers();
    const onOpponentLongPress = vi.fn();
    render(
      <Scoreboard
        match={createMatch({ isHome: true })}
        myTeamScore={0}
        opponentScore={0}
        onOpponentLongPress={onOpponentLongPress}
      />,
    );

    const opponentButton = screen.getByText('Rivals');
    fireEvent.pointerDown(opponentButton);
    fireEvent.pointerUp(opponentButton);
    vi.advanceTimersByTime(500);

    expect(onOpponentLongPress).not.toHaveBeenCalled();
  });
});
