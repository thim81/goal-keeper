import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MatchTimer } from './MatchTimer';

describe('MatchTimer', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows elapsed time counting up while running', () => {
    vi.useFakeTimers();
    const startedAt = 1_000_000;
    vi.setSystemTime(startedAt + 65_000);

    render(
      <MatchTimer
        startedAt={startedAt}
        periodsCount={4}
        periodDuration={20}
        isRunning
        totalPausedTime={0}
        currentPeriod={2}
      />,
    );

    expect(screen.getByText('01:05')).toBeInTheDocument();
    expect(screen.getByText('Period 2/4')).toBeInTheDocument();
  });

  it('freezes the elapsed time at pausedAt while paused, even as real time advances', () => {
    vi.useFakeTimers();
    const startedAt = 1_000_000;
    vi.setSystemTime(startedAt + 30_000);

    render(
      <MatchTimer
        startedAt={startedAt}
        periodsCount={4}
        periodDuration={20}
        isRunning={false}
        totalPausedTime={0}
        pausedAt={startedAt + 30_000}
        currentPeriod={1}
      />,
    );

    expect(screen.getByText('00:30')).toBeInTheDocument();

    vi.setSystemTime(startedAt + 90_000);
    vi.advanceTimersByTime(5000);

    expect(screen.getByText('00:30')).toBeInTheDocument();
  });

  it('subtracts accumulated paused time from the running elapsed time', () => {
    vi.useFakeTimers();
    const startedAt = 1_000_000;
    vi.setSystemTime(startedAt + 65_000);

    render(
      <MatchTimer
        startedAt={startedAt}
        periodsCount={4}
        periodDuration={20}
        isRunning
        totalPausedTime={20_000}
        currentPeriod={1}
      />,
    );

    expect(screen.getByText('00:45')).toBeInTheDocument();
  });

  it('shows elapsed playing minutes for the current period', () => {
    vi.useFakeTimers();
    const startedAt = 1_000_000;
    vi.setSystemTime(startedAt + 12 * 60_000 + 30_000);

    render(
      <MatchTimer
        startedAt={startedAt}
        periodsCount={4}
        periodDuration={20}
        isRunning
        totalPausedTime={0}
        currentPeriod={2}
        periodStartedAt={startedAt}
        periodPausedTime={30_000}
      />,
    );

    expect(screen.getByText('12 min')).toBeInTheDocument();
  });

  it('freezes period minutes while paused', () => {
    vi.useFakeTimers();
    const startedAt = 1_000_000;
    const pausedAt = startedAt + 12 * 60_000;
    vi.setSystemTime(pausedAt + 10 * 60_000);

    render(
      <MatchTimer
        startedAt={startedAt}
        periodsCount={4}
        periodDuration={20}
        isRunning={false}
        totalPausedTime={0}
        pausedAt={pausedAt}
        currentPeriod={1}
        periodStartedAt={startedAt}
      />,
    );

    expect(screen.getByText('12 min')).toBeInTheDocument();
  });

  it('highlights the period minutes in orange after the period limit', () => {
    vi.useFakeTimers();
    const startedAt = 1_000_000;
    vi.setSystemTime(startedAt + 20 * 60_000 + 1_000);

    render(
      <MatchTimer
        startedAt={startedAt}
        periodsCount={4}
        periodDuration={20}
        isRunning
        totalPausedTime={0}
        currentPeriod={1}
        periodStartedAt={startedAt}
      />,
    );

    expect(screen.getByText('20 min')).toHaveClass('text-orange-500');
  });
});
