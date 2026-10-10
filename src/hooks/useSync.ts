import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchRemoteState,
  fetchActiveMatch,
  postCommand,
  type SyncState,
  type WorkspaceRole,
} from "@/lib/sync";
import type { Match, AppSettings, Season } from "@/types/match";
import type { WorkspaceCommand, WorkspaceResponse } from "@/lib/workspace";
import {
  assembleWorkspace,
  emptyMetadata,
  readWorkspaceCache,
  saveWorkspaceCache,
  type RevisionMetadata,
} from "@/lib/workspace-cache";
import { toast } from "sonner";

export type SyncStatus = "local" | "checking" | "editor" | "viewer" | "invalid" | "unavailable";
export function useSync(
  syncToken: string | undefined,
  seasons: Record<string, Season>,
  activeSeasonId: string | null,
  activeMatch: Match | null,
  settings: AppSettings,
  onSyncState: (state: SyncState) => void,
  onLiveState?: (activeMatch: Match | null) => void,
) {
  const token = syncToken?.trim() ?? "";
  const [cached] = useState(readWorkspaceCache);
  const [status, setStatus] = useState<SyncStatus>(token ? "checking" : "local");
  const [confirmedCredential, setConfirmedCredential] = useState<string | null>(null);
  const [role, setRole] = useState<WorkspaceRole | null>(
    cached?.credential === token ? cached.role : null,
  );
  const [metadata, setMetadata] = useState<RevisionMetadata>(
    cached?.credential === token ? cached.metadata : emptyMetadata(),
  );
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(
    cached?.credential === token ? cached.metadata.fullUpdatedAt : null,
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCoolingDown, setIsCoolingDown] = useState(false);
  const cooldownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const current = useRef({
    token,
    seasons,
    activeSeasonId,
    activeMatch,
    settings,
    onSyncState,
    onLiveState,
  });
  current.current = {
    token,
    seasons,
    activeSeasonId,
    activeMatch,
    settings,
    onSyncState,
    onLiveState,
  };
  const generation = useRef(0);
  const meta = useRef(metadata);
  const snapshot = useRef<SyncState | null>(cached?.credential === token ? cached.state : null);
  const workspaceId = useRef<string | null>(
    cached?.credential === token ? cached.workspaceId : null,
  );
  const confirmed = useRef<WorkspaceRole | null>(null);
  const commandQueue = useRef<Promise<void>>(Promise.resolve());
  const reads = useRef<{ full: Promise<void> | null; live: Promise<void> | null }>({
    full: null,
    live: null,
  });
  const announceFullRefresh = useRef(false);
  const scheduleRef = useRef(() => {});
  const refreshRef = useRef<(full?: boolean) => Promise<void>>(async () => {});

  const apply = useCallback(
    (response: WorkspaceResponse & { role: WorkspaceRole }, epoch: number) => {
      if (epoch !== generation.current) return false;
      if (workspaceId.current && workspaceId.current !== response.workspaceId) {
        confirmed.current = null;
        setConfirmedCredential(null);
        setRole(null);
        throw new Error("Workspace identity changed");
      }
      workspaceId.current = response.workspaceId;
      if (response.revision < Math.max(meta.current.liveRevision, meta.current.fullRevision))
        return false;
      setConfirmedCredential(current.current.token);
      confirmed.current = response.role;
      setRole(response.role);
      setStatus(response.role);
      const previous =
        snapshot.current ??
        assembleWorkspace(
          current.current.seasons,
          current.current.activeSeasonId,
          current.current.activeMatch,
          current.current.settings,
        );
      if (response.scope === "structural") {
        snapshot.current = response.state;
        meta.current = {
          liveRevision: response.revision,
          fullRevision: response.revision,
          fullStructureRevision: response.structureRevision,
          observedStructureRevision: response.structureRevision,
          fullUpdatedAt: Date.now(),
        };
        current.current.onSyncState(response.state);
      } else {
        // A partial response must never claim settings or history freshness.
        snapshot.current = { ...previous, activeMatch: response.activeMatch };
        meta.current = {
          ...meta.current,
          liveRevision: response.revision,
          observedStructureRevision: response.structureRevision,
        };
        current.current.onLiveState?.(response.activeMatch);
        const matchChanged = previous.activeMatch?.id !== response.activeMatch?.id;
        if (
          matchChanged ||
          response.activeSeasonId !== previous.activeSeasonId ||
          response.structureRevision !== meta.current.fullStructureRevision
        ) {
          void refreshRef.current(true);
        }
      }
      setMetadata(meta.current);
      setLastSyncedAt(Date.now());
      saveWorkspaceCache({
        credential: current.current.token,
        workspaceId: response.workspaceId,
        role: response.role,
        state: snapshot.current,
        metadata: meta.current,
      });
      return true;
    },
    [],
  );

  const refresh = useCallback(
    (full = true, announce = false): Promise<void> => {
      const credential = current.current.token;
      if (!credential) return Promise.resolve();
      const epoch = generation.current;
      const kind = full ? "full" : "live";
      if (full && announce) announceFullRefresh.current = true;
      if (reads.current[kind]) return reads.current[kind]!;
      setIsSyncing(true);
      const request = (async () => {
        try {
          const response = await (full
            ? fetchRemoteState(credential)
            : fetchActiveMatch(credential));
          if (
            apply(response, epoch) &&
            full &&
            announceFullRefresh.current &&
            response.role === "editor"
          ) {
            toast.success("Goals Synced", { duration: 2000 });
          }
        } catch (error) {
          if (epoch !== generation.current) return;
          const statusCode = (error as { status?: number }).status;
          if (statusCode === 401 || statusCode === 403) {
            confirmed.current = null;
            setConfirmedCredential(null);
            setRole(null);
            setStatus("invalid");
          } else setStatus("unavailable");
        } finally {
          if (epoch === generation.current) {
            if (full) announceFullRefresh.current = false;
            reads.current[kind] = null;
            setIsSyncing(!!reads.current.full || !!reads.current.live);
          }
        }
      })();
      reads.current[kind] = request;
      return request;
    },
    [apply],
  );
  refreshRef.current = refresh;

  useEffect(() => {
    generation.current += 1;
    if (cooldownTimer.current) clearTimeout(cooldownTimer.current);
    cooldownTimer.current = null;
    setIsCoolingDown(false);
    setConfirmedCredential(null);
    confirmed.current = null;
    reads.current = { full: null, live: null };
    announceFullRefresh.current = false;
    commandQueue.current = Promise.resolve();
    const saved = readWorkspaceCache();
    const same = saved?.credential === token;
    snapshot.current = same ? saved.state : null;
    workspaceId.current = same ? saved.workspaceId : null;
    meta.current = same ? saved.metadata : emptyMetadata();
    setMetadata(meta.current);
    setLastSyncedAt(same ? saved.metadata.fullUpdatedAt : null);
    setRole(same ? saved.role : null);
    setStatus(token ? "checking" : "local");
    if (!token) {
      setIsSyncing(false);
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    let disposed = false;
    const schedule = () => {
      clearTimeout(timer);
      if (disposed || document.visibilityState === "hidden") return;
      timer = setTimeout(
        async () => {
          const hasMatch = !!(snapshot.current
            ? snapshot.current.activeMatch
            : current.current.activeMatch);
          const stale =
            meta.current.observedStructureRevision !== meta.current.fullStructureRevision;
          await refresh(!hasMatch || stale);
          schedule();
        },
        (snapshot.current ? snapshot.current.activeMatch : current.current.activeMatch)
          ? 10_000
          : 30_000,
      );
    };
    scheduleRef.current = schedule;
    const visible = () => {
      clearTimeout(timer);
      if (document.visibilityState !== "hidden") void refresh(true, true).finally(schedule);
    };
    const editorReturned = () => {
      if (confirmed.current !== "viewer") visible();
    };
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("focus", editorReturned);
    window.addEventListener("pageshow", editorReturned);
    void refresh(true, true).finally(schedule);
    return () => {
      scheduleRef.current = () => {};
      disposed = true;
      generation.current += 1;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", visible);
      if (cooldownTimer.current) clearTimeout(cooldownTimer.current);
      window.removeEventListener("focus", editorReturned);
      window.removeEventListener("pageshow", editorReturned);
    };
  }, [token, refresh]);

  const hasLiveMatch = !!activeMatch;
  useEffect(() => {
    scheduleRef.current();
  }, [hasLiveMatch]);

  const executeCommand = useCallback(
    (command: WorkspaceCommand): Promise<boolean> => {
      if (!current.current.token || confirmed.current !== "editor") return Promise.resolve(false);
      const credential = current.current.token;
      const epoch = generation.current;
      const result = commandQueue.current.then(async () => {
        if (epoch !== generation.current || confirmed.current !== "editor") return false;
        try {
          let response;
          for (let attempt = 0; attempt < 2; attempt++) {
            try {
              response = await postCommand(credential, command);
              break;
            } catch (error) {
              if (attempt || (error as { status?: number }).status) throw error;
            }
          }
          if (epoch !== generation.current) return false;
          apply(response!, epoch);
          return true;
        } catch (error) {
          if (epoch !== generation.current) return false;
          const code = (error as { status?: number }).status;
          const message = code
            ? (error as Error).message
            : "Action unconfirmed. Refreshing the latest state.";
          if (code === 401 || code === 403) {
            confirmed.current = null;
            setConfirmedCredential(null);
            setRole(null);
            setStatus("invalid");
          }
          toast.error(message);
          // Reads reconcile displayed data, never acknowledge an uncertain command.
          void refresh(true);
          return false;
        }
      });
      // Only the current browser session buffers actions; never persist or replay this queue.
      commandQueue.current = result.then(
        () => {},
        () => {},
      );
      return result;
    },
    [apply, refresh],
  );
  const submitCommand = useCallback(
    (command: WorkspaceCommand): Promise<boolean> => {
      if (!current.current.token || confirmed.current !== "editor") return Promise.resolve(false);
      const result = executeCommand(command);
      // Backup replacement reports success only after the revision check and replacement succeed.
      return command.type === "import-backup" ? result : Promise.resolve(true);
    },
    [executeCommand],
  );
  const syncNow = async () => {
    if (!current.current.token || cooldownTimer.current) return;
    const epoch = generation.current;
    await refresh(true, true);
    if (epoch !== generation.current) return;
    if (cooldownTimer.current) clearTimeout(cooldownTimer.current);
    setIsCoolingDown(true);
    cooldownTimer.current = setTimeout(() => {
      cooldownTimer.current = null;
      setIsCoolingDown(false);
    }, 3000);
  };
  return {
    status,
    role,
    isCredentialConfirmed: confirmedCredential === token && !!token,
    lastSyncedAt,
    metadata,
    isWorkspaceStale: metadata.observedStructureRevision !== metadata.fullStructureRevision,
    isSyncing,
    isCoolingDown,
    syncNow,
    executeCommand,
    submitCommand,
  };
}
