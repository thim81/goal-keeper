// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useUpcomingMatches } from '@/hooks/useUpcomingMatches';

const url = 'https://club.prosoccerdata.com/api/v2/members/ics/file?id=1&uuid=x';
const games = [
  {
    id: 'game|1',
    start: '2026-09-19T11:15:00.000Z',
    homeTeam: 'IPU15',
    awayTeam: 'Opponent U15',
  },
];

describe('useUpcomingMatches', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('loads normalized games and detects the calendar team', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ games }))));
    const onDetectedTeamName = vi.fn();
    const { result } = renderHook(() => useUpcomingMatches(url, '', onDetectedTeamName));

    await waitFor(() => expect(result.current.matches).toHaveLength(1));

    expect(result.current.matches[0]).toMatchObject({ opponentName: 'Opponent U15', isHome: true });
    expect(onDetectedTeamName).toHaveBeenCalledWith('IPU15');
  });

  it('hides matches when the calendar request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const { result } = renderHook(() => useUpcomingMatches(url, 'IPU15'));

    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(result.current.matches).toEqual([]);
  });

  it('does not fetch when no subscription URL is configured', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useUpcomingMatches('', 'IPU15'));

    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.matches).toEqual([]);
  });

  it('can refresh the current subscription', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ games })));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useUpcomingMatches(url, 'IPU15'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.refresh();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not refetch when detection updates the configured team name', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ games })));
    vi.stubGlobal('fetch', fetchMock);
    let detectedTeamName = '';
    const onDetectedTeamName = vi.fn((teamName: string) => {
      detectedTeamName = teamName;
    });
    const { result, rerender } = renderHook(
      ({ teamName }) => useUpcomingMatches(url, teamName, onDetectedTeamName),
      { initialProps: { teamName: '' } },
    );

    await waitFor(() => expect(result.current.matches).toHaveLength(1));
    rerender({ teamName: detectedTeamName });
    await waitFor(() => expect(result.current.matches).toHaveLength(1));

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('uses a fresh local cache instead of fetching on mount', async () => {
    localStorage.setItem(
      `football-tracker-calendar-cache:${url}`,
      JSON.stringify({ fetchedAt: Date.now(), games }),
    );
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useUpcomingMatches(url, 'IPU15'));

    await waitFor(() => expect(result.current.matches).toHaveLength(1));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches again when the local cache is older than 24 hours', async () => {
    const now = Date.now();
    localStorage.setItem(
      `football-tracker-calendar-cache:${url}`,
      JSON.stringify({ fetchedAt: now - 24 * 60 * 60 * 1000, games }),
    );
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ games })));
    vi.stubGlobal('fetch', fetchMock);

    renderHook(() => useUpcomingMatches(url, 'IPU15'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });

  it('keeps showing the already-loaded matches while a manual refresh is in flight', async () => {
    let resolveSecondFetch: (response: Response) => void;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ games })))
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveSecondFetch = resolve;
          }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useUpcomingMatches(url, 'IPU15'));
    await waitFor(() => expect(result.current.matches).toHaveLength(1));

    let refreshPromise: Promise<void>;
    act(() => {
      refreshPromise = result.current.refresh();
    });

    // The second fetch hasn't resolved yet, but the stale list must stay visible.
    expect(result.current.matches).toHaveLength(1);
    expect(result.current.loaded).toBe(true);

    await act(async () => {
      resolveSecondFetch!(new Response(JSON.stringify({ games })));
      await refreshPromise;
    });
    expect(result.current.matches).toHaveLength(1);
  });

  it('keeps the stale list when a background refresh fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ games })))
      .mockRejectedValueOnce(new Error('offline'));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useUpcomingMatches(url, 'IPU15'));
    await waitFor(() => expect(result.current.matches).toHaveLength(1));

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.matches).toHaveLength(1);
    expect(result.current.loaded).toBe(true);
  });

  it('clears matches immediately when the subscription URL changes', async () => {
    let resolveSecondFetch: (response: Response) => void;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ games })))
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveSecondFetch = resolve;
          }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const { result, rerender } = renderHook(
      ({ subscriptionUrl }) => useUpcomingMatches(subscriptionUrl, 'IPU15'),
      { initialProps: { subscriptionUrl: url } },
    );
    await waitFor(() => expect(result.current.matches).toHaveLength(1));

    rerender({ subscriptionUrl: `${url}&changed=1` });

    await waitFor(() => expect(result.current.matches).toEqual([]));
    expect(result.current.loaded).toBe(false);

    await act(async () => {
      resolveSecondFetch!(new Response(JSON.stringify({ games })));
    });
  });
});
