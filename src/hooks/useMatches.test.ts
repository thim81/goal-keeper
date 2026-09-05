// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useMatches } from './useMatches';

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
