import { useEffect, useRef, useCallback, useState } from "react";
import { fetchRemoteState, pushLocalState, type SyncState } from "@/lib/sync";
import { Match, AppSettings, Season } from "@/types/match";
import { toast } from "sonner";

export type SyncStatus = "local" | "checking" | "editor" | "viewer" | "invalid" | "unavailable";

const ACCESS_KEY = "football-tracker-workspace-access";
type CachedAccess = { token: string; role: "editor" | "viewer"; baseline: string };

function removeCachedAccess() {
  try {
    localStorage.removeItem(ACCESS_KEY);
  } catch {
    // Storage may be unavailable in private or restricted browser contexts.
  }
}

function readCachedAccess(token: string): CachedAccess | null {
  if (!token) return null;
  try {
    const raw = localStorage.getItem(ACCESS_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as Partial<CachedAccess>;
    if (
      cached.token !== token ||
      (cached.role !== "editor" && cached.role !== "viewer") ||
      typeof cached.baseline !== "string"
    ) {
      removeCachedAccess();
      return null;
    }
    return cached as CachedAccess;
  } catch {
    removeCachedAccess();
    return null;
  }
}

function storeCachedAccess(access: CachedAccess) {
  try {
    localStorage.setItem(ACCESS_KEY, JSON.stringify(access));
  } catch {
    // Storage is only a convenience for offline startup, not a sync requirement.
  }
}

function clearCachedAccess(token: string) {
  try {
    const raw = localStorage.getItem(ACCESS_KEY);
    if (!raw || (JSON.parse(raw) as Partial<CachedAccess>).token === token) removeCachedAccess();
  } catch {
    removeCachedAccess();
  }
}

export function useSync(
  syncToken: string | undefined,
  seasons: Record<string, Season>,
  activeSeasonId: string | null,
  activeMatch: Match | null,
  settings: AppSettings,
  onSyncState: (state: SyncState) => void,
) {
  const [status, setStatus] = useState<SyncStatus>(syncToken ? "checking" : "local");
  const [checkedToken, setCheckedToken] = useState(syncToken ?? "");
  const [initialAccess] = useState(() => readCachedAccess(syncToken ?? ""));
  const [role, setRole] = useState<"editor" | "viewer" | null>(initialAccess?.role ?? null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCoolingDown, setIsCoolingDown] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const generationRef = useRef(0);
  const lastPushedState = useRef(initialAccess?.baseline ?? "");
  const writeBlockedRef = useRef(false);
  const manualInFlight = useRef(false);
  const manualGeneration = useRef(0);
  const manualCooldownUntil = useRef(0);
  const manualCooldownTimer = useRef<number | null>(null);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const writeControllerRef = useRef<AbortController | null>(null);
  const writeTimerRef = useRef<number | null>(null);
  const writePromiseRef = useRef<Promise<number> | null>(null);
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());

  const getLocalState = useCallback((): SyncState => {
    const activeSeason = activeSeasonId ? seasons[activeSeasonId] : undefined;
    const { theme: _theme, syncToken: _token, ...settingsToShare } = settings;
    return {
      matches: activeSeason?.matches ?? [],
      fullMatches: activeSeason?.fullMatches ?? {},
      seasons,
      activeSeasonId: activeSeasonId ?? undefined,
      activeMatch,
      settings: settingsToShare,
    };
  }, [activeSeasonId, seasons, activeMatch, settings]);

  const currentRef = useRef({ getLocalState, onSyncState });
  currentRef.current = { getLocalState, onSyncState };

  const serialize = (value: unknown): string =>
    JSON.stringify(value, (_key, nested) => {
      if (!nested || typeof nested !== "object" || Array.isArray(nested)) return nested;
      return Object.fromEntries(
        Object.keys(nested)
          .sort()
          .map((key) => [key, (nested as Record<string, unknown>)[key]]),
      );
    });

  const writeState = useCallback(async (token: string, local: SyncState, generation: number) => {
    const operation = writeQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        if (generation !== generationRef.current || writeBlockedRef.current) return 0;
        const controller = new AbortController();
        writeControllerRef.current = controller;
        const statusCode = await pushLocalState(token, local, controller.signal);
        if (statusCode >= 200 && statusCode < 300 && generation === generationRef.current) {
          lastPushedState.current = serialize(local);
          storeCachedAccess({ token, role: "editor", baseline: lastPushedState.current });
          setLastSyncedAt(Date.now());
        } else if (generation === generationRef.current) {
          setCheckedToken(token);
          setStatus(statusCode === 401 || statusCode === 403 ? "invalid" : "unavailable");
          if (statusCode === 401 || statusCode === 403) {
            clearCachedAccess(token);
            setRole(null);
          }
        }
        if (writeControllerRef.current === controller) writeControllerRef.current = null;
        return statusCode;
      });
    writePromiseRef.current = operation;
    writeQueueRef.current = operation.then(
      () => undefined,
      () => undefined,
    );
    try {
      return await operation;
    } finally {
      if (writePromiseRef.current === operation) writePromiseRef.current = null;
    }
  }, []);

  const flushPendingWrite = useCallback(
    async (generation: number) => {
      if (!syncToken || generation !== generationRef.current) return false;
      if (writeBlockedRef.current) {
        if (writeTimerRef.current !== null) {
          window.clearTimeout(writeTimerRef.current);
          writeTimerRef.current = null;
        }
        return true;
      }
      let statusCode = 204;
      if (writeTimerRef.current !== null) {
        window.clearTimeout(writeTimerRef.current);
        writeTimerRef.current = null;
        statusCode = await writeState(syncToken, getLocalState(), generation);
      } else if (writePromiseRef.current) {
        statusCode = await writePromiseRef.current;
      } else if (serialize(getLocalState()) !== lastPushedState.current) {
        statusCode = await writeState(syncToken, getLocalState(), generation);
      }
      return generation === generationRef.current && statusCode >= 200 && statusCode < 300;
    },
    [getLocalState, syncToken, writeState],
  );

  const pull = useCallback(async (token: string, generation: number, quiet = false) => {
    if (controllerRef.current || writeControllerRef.current || writeTimerRef.current !== null)
      return null;
    const localAtStart = currentRef.current.getLocalState();
    const localAtStartSerialized = serialize(localAtStart);
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const result = await fetchRemoteState(token, controller.signal);
      if (generation !== generationRef.current || controller.signal.aborted) return null;
      writeBlockedRef.current = false;
      if (result.state) {
        setCheckedToken(token);
        setRole(result.role);
        setStatus(result.role);
        setLastSyncedAt(Date.now());
        const currentBeforeApply = serialize(currentRef.current.getLocalState());
        const baseline = lastPushedState.current;
        const canApply =
          result.role !== "editor" ||
          (currentBeforeApply === localAtStartSerialized &&
            (!baseline || baseline === localAtStartSerialized));
        if (canApply) {
          currentRef.current.onSyncState(result.state);
          const {
            theme: _theme,
            syncToken: _token,
            ...syncedSettings
          } = result.state.settings ?? {};
          lastPushedState.current = serialize({ ...result.state, settings: syncedSettings });
        } else if (result.role === "editor" && !baseline) {
          lastPushedState.current = localAtStartSerialized;
        }
        storeCachedAccess({ token, role: result.role, baseline: lastPushedState.current });
        if (!quiet && canApply) toast.success("Goals Synced", { duration: 2000 });
      } else if (result.role === "viewer") {
        setCheckedToken(token);
        setRole("viewer");
        setStatus("viewer");
        setLastSyncedAt(Date.now());
        lastPushedState.current = "";
        storeCachedAccess({ token, role: "viewer", baseline: "" });
        const current = currentRef.current.getLocalState();
        currentRef.current.onSyncState({
          matches: [],
          fullMatches: {},
          seasons: {},
          activeMatch: null,
          settings: current.settings,
        });
      } else if (result.role === "editor") {
        const local = currentRef.current.getLocalState();
        setCheckedToken(token);
        const statusCode = await writeState(token, local, generation);
        if (generation !== generationRef.current || controller.signal.aborted) return null;
        if (statusCode >= 200 && statusCode < 300) {
          setRole("editor");
          setStatus("editor");
        } else {
          if (statusCode === 401) setRole(null);
        }
      }
      return result;
    } catch (error) {
      if (generation !== generationRef.current || controller.signal.aborted) return null;
      setCheckedToken(token);
      const statusCode = (error as { status?: number }).status;
      if (statusCode === 422) writeBlockedRef.current = true;
      if (statusCode === 401 || statusCode === 403) {
        clearCachedAccess(token);
        setRole(null);
        setStatus("invalid");
      } else setStatus("unavailable");
      return null;
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const generation = ++generationRef.current;
    controllerRef.current?.abort();
    controllerRef.current = null;
    if (writeTimerRef.current !== null) {
      window.clearTimeout(writeTimerRef.current);
      writeTimerRef.current = null;
    }
    const cached = readCachedAccess(syncToken ?? "");
    lastPushedState.current = cached?.baseline ?? "";
    writeBlockedRef.current = false;
    manualInFlight.current = false;
    manualGeneration.current = 0;
    manualCooldownUntil.current = 0;
    if (manualCooldownTimer.current !== null) window.clearTimeout(manualCooldownTimer.current);
    manualCooldownTimer.current = null;
    setIsCoolingDown(false);
    setRole(cached?.role ?? null);
    setCheckedToken(syncToken ?? "");
    setIsSyncing(false);
    setStatus(syncToken ? "checking" : "local");
    setLastSyncedAt(null);
    if (!syncToken) return;
    void writeQueueRef.current.then(() => {
      if (generation === generationRef.current) void pull(syncToken, generation, true);
    });
    return () => {
      controllerRef.current?.abort();
      if (manualCooldownTimer.current !== null) {
        window.clearTimeout(manualCooldownTimer.current);
        manualCooldownTimer.current = null;
      }
    };
  }, [syncToken, pull]);

  useEffect(() => {
    if (
      !syncToken ||
      (status !== "editor" && status !== "unavailable") ||
      role !== "editor" ||
      checkedToken !== syncToken ||
      writeBlockedRef.current
    )
      return;
    const local = getLocalState();
    const serialized = serialize(local);
    if (serialized === lastPushedState.current) return;
    const generation = generationRef.current;
    const timeout = window.setTimeout(async () => {
      writeTimerRef.current = null;
      await writeState(syncToken, local, generation);
    }, 2000);
    writeTimerRef.current = timeout;
    return () => {
      window.clearTimeout(timeout);
      if (writeTimerRef.current === timeout) writeTimerRef.current = null;
    };
  }, [syncToken, status, role, checkedToken, getLocalState, writeState]);

  useEffect(() => {
    if (!syncToken || role === "viewer" || status === "invalid" || checkedToken !== syncToken)
      return;
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        if (role === "editor") void syncNowQuietly();
        else void pull(syncToken, generationRef.current, true);
      }
    };
    const syncNowQuietly = async () => {
      const generation = generationRef.current;
      if (!(await flushPendingWrite(generation))) return;
      if (generation === generationRef.current) await pull(syncToken, generation, true);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [syncToken, role, status, checkedToken, pull, flushPendingWrite]);

  useEffect(() => {
    if (!syncToken || role !== "viewer" || status === "invalid" || checkedToken !== syncToken)
      return;
    let timer: number | undefined;
    let disposed = false;
    const refresh = async () => {
      if (disposed || document.visibilityState !== "visible" || manualInFlight.current)
        return schedule();
      await pull(syncToken, generationRef.current, true);
      schedule();
    };
    const schedule = () => {
      if (disposed || document.visibilityState !== "visible") return;
      timer = window.setTimeout(refresh, activeMatch ? 10_000 : 30_000);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        if (timer) window.clearTimeout(timer);
        void refresh();
      } else if (timer) window.clearTimeout(timer);
    };
    schedule();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      disposed = true;
      if (timer) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [syncToken, status, role, checkedToken, !!activeMatch, pull, refreshSignal]);

  const syncNow = useCallback(async () => {
    if (!syncToken || manualInFlight.current || Date.now() < manualCooldownUntil.current) return;
    manualInFlight.current = true;
    const generation = generationRef.current;
    manualGeneration.current = generation;
    setIsSyncing(true);
    try {
      if (role === "editor") {
        if (!(await flushPendingWrite(generation))) return;
      }
      if (generation === generationRef.current) await pull(syncToken, generation);
    } finally {
      if (generation === generationRef.current) {
        if (manualGeneration.current === generation) manualInFlight.current = false;
        setIsSyncing(false);
        setIsCoolingDown(true);
        manualCooldownUntil.current = Date.now() + 3000;
        manualCooldownTimer.current = window.setTimeout(() => {
          setIsCoolingDown(false);
          manualCooldownTimer.current = null;
        }, 3000);
        setRefreshSignal((value) => value + 1);
      } else if (manualGeneration.current === generation) {
        manualInFlight.current = false;
      }
    }
  }, [flushPendingWrite, pull, role, syncToken]);

  const effectiveStatus = !syncToken ? "local" : checkedToken === syncToken ? status : "checking";
  return {
    status: effectiveStatus as SyncStatus,
    role: checkedToken === syncToken ? role : null,
    lastSyncedAt,
    isSyncing,
    isCoolingDown,
    syncNow,
  };
}
