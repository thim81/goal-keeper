import { useEffect, useRef, useCallback } from 'react';
import { fetchRemoteState, pushLocalState, SyncState } from '@/lib/sync';
import { Match, AppSettings, Season } from '@/types/match';
import { toast } from 'sonner';

export function useSync(
  syncToken: string | undefined,
  seasons: Record<string, Season>,
  activeSeasonId: string | null,
  activeMatch: Match | null,
  settings: AppSettings,
  onSyncState: (state: SyncState) => void,
) {
  const isInitialMount = useRef(true);
  const lastPushedState = useRef<string>('');

  // Function to gather current local state
  const getLocalState = useCallback((): SyncState => {
    const activeSeason = activeSeasonId ? seasons[activeSeasonId] : undefined;
    return {
      // Keep these legacy fields for backward-compatible remote peers.
      matches: activeSeason?.matches ?? [],
      fullMatches: activeSeason?.fullMatches ?? {},
      seasons,
      activeSeasonId: activeSeasonId ?? undefined,
      activeMatch,
      settings,
    };
  }, [activeSeasonId, seasons, activeMatch, settings]);

  // Handle initial sync
  useEffect(() => {
    if (!syncToken) return;

    const initialSync = async () => {
      const remoteState = await fetchRemoteState(syncToken);
      if (remoteState) {
        onSyncState(remoteState);
        lastPushedState.current = JSON.stringify(remoteState);
        toast.success('Goals Synced');
      } else {
        // If no remote state, push local state as initial
        const currentState = getLocalState();
        await pushLocalState(syncToken, currentState);
        lastPushedState.current = JSON.stringify(currentState);
      }
    };

    if (isInitialMount.current) {
      initialSync();
      isInitialMount.current = false;
    }
  }, [syncToken, onSyncState, getLocalState]);

  // Handle auto-sync on changes
  useEffect(() => {
    if (!syncToken || isInitialMount.current) return;

    const currentState = getLocalState();
    const currentStateStr = JSON.stringify(currentState);

    // Only push if state actually changed from what we last pushed/fetched
    if (currentStateStr !== lastPushedState.current) {
      const timeoutId = setTimeout(async () => {
        const success = await pushLocalState(syncToken, currentState);
        if (success) {
          lastPushedState.current = currentStateStr;
        }
      }, 2000); // Debounce sync

      return () => clearTimeout(timeoutId);
    }
  }, [syncToken, seasons, activeSeasonId, activeMatch, settings, getLocalState]);
}
