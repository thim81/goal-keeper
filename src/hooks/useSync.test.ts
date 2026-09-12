// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSync } from './useSync';
import type { SyncState } from '@/lib/sync';

const remoteState: SyncState = {
  matches: [],
  activeMatch: null,
  fullMatches: {},
  activeSeasonId: 'season-1',
  seasons: {},
  settings: {
    teamName: 'My Team',
    players: [],
    periodsCount: 4,
    periodDuration: 20,
    syncToken: 'token',
    debug: false,
  },
};

const remoteResponse = () => new Response(JSON.stringify(remoteState));

const settings = {
  teamName: 'My Team',
  players: [],
  periodsCount: 4,
  periodDuration: 20,
  syncToken: 'token',
  theme: 'system' as const,
  debug: false,
};

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
  },
}));

describe('useSync manual refresh', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('pulls remote state and reuses the existing success toast', async () => {
    const fetchMock = vi.fn().mockImplementation(remoteResponse);
    vi.stubGlobal('fetch', fetchMock);
    const onSyncState = vi.fn();

    const { result } = renderHook(() =>
      useSync('token', {}, 'season-1', null, settings, onSyncState),
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.syncNow();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onSyncState).toHaveBeenLastCalledWith(remoteState);
    const { toast } = await import('sonner');
    expect(toast.success).toHaveBeenLastCalledWith('Goals Synced');
  });

  it('ignores a second request in flight and during the three-second cooldown', async () => {
    vi.useFakeTimers();
    let resolveManual: (response: Response) => void = () => undefined;
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(remoteResponse)
      .mockImplementationOnce(() => new Promise<Response>((resolve) => (resolveManual = resolve)))
      .mockImplementation(remoteResponse);
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useSync('token', {}, 'season-1', null, settings, vi.fn()));
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      const firstRequest = result.current.syncNow();
      result.current.syncNow();
      await Promise.resolve();
      void firstRequest;
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.isSyncing).toBe(true);

    await act(async () => {
      resolveManual(new Response(JSON.stringify(remoteState)));
      await Promise.resolve();
    });
    expect(result.current.isSyncing).toBe(false);

    act(() => {
      result.current.syncNow();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      vi.setSystemTime(Date.now() + 3000);
      await result.current.syncNow();
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
