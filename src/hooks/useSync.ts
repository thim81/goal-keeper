import { useEffect, useRef, useCallback, useState } from "react";
import { fetchRemoteState, pushLocalState, SyncState } from "@/lib/sync";
import { Match, AppSettings, Season } from "@/types/match";
import { toast } from "sonner";

export function useSync(
  syncToken: string | undefined,
  seasons: Record<string, Season>,
  activeSeasonId: string | null,
  activeMatch: Match | null,
  settings: AppSettings,
  onSyncState: (state: SyncState) => void,
) {
  const isInitialMount = useRef(true);
  const lastPushedState = useRef<string>("");
  const manualSyncInFlight = useRef(false);
  const manualSyncCooldownUntil = useRef(0);
  const manualSyncCooldownTimer = useRef<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCoolingDown, setIsCoolingDown] = useState(false);

  useEffect(
    () => () => {
      if (manualSyncCooldownTimer.current !== null) {
        window.clearTimeout(manualSyncCooldownTimer.current);
      }
    },
    [],
  );

  // Function to gather current local state
  const getLocalState = useCallback((): SyncState => {
    const activeSeason = activeSeasonId ? seasons[activeSeasonId] : undefined;
    const { theme: _localTheme, ...syncSettings } = settings;

    return {
      // Keep these legacy fields for backward-compatible remote peers.
      matches: activeSeason?.matches ?? [],
      fullMatches: activeSeason?.fullMatches ?? {},
      seasons,
      activeSeasonId: activeSeasonId ?? undefined,
      activeMatch,
      settings: syncSettings,
    };
  }, [activeSeasonId, seasons, activeMatch, settings]);

  const pullRemoteState = useCallback(
    async (token: string) => {
      const remoteState = await fetchRemoteState(token);
      if (remoteState) {
        onSyncState(remoteState);
        lastPushedState.current = JSON.stringify(remoteState);
        toast.success("Goals Synced", { duration: 2000 });
      }
      return remoteState;
    },
    [onSyncState],
  );

  // Handle initial sync
  useEffect(() => {
    if (!syncToken) return;

    const initialSync = async () => {
      const remoteState = await pullRemoteState(syncToken);
      if (remoteState) {
        return;
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
  }, [syncToken, pullRemoteState, getLocalState]);

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

  const syncNow = useCallback(async () => {
    if (!syncToken || manualSyncInFlight.current || Date.now() < manualSyncCooldownUntil.current) {
      return;
    }

    manualSyncInFlight.current = true;
    setIsSyncing(true);

    try {
      await pullRemoteState(syncToken);
    } finally {
      manualSyncInFlight.current = false;
      setIsSyncing(false);
      setIsCoolingDown(true);
      manualSyncCooldownUntil.current = Date.now() + 3000;
      manualSyncCooldownTimer.current = window.setTimeout(() => {
        setIsCoolingDown(false);
        manualSyncCooldownTimer.current = null;
      }, 3000);
    }
  }, [pullRemoteState, syncToken]);

  return { isSyncing, isCoolingDown, syncNow };
}
