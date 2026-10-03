import type { SyncState, WorkspaceRole } from "./sync";
import { normalizeWorkspace } from "./workspace";
export const CACHE_KEY = "football-tracker-workspace-v2";
export const RECOVERY_KEY = "football-tracker-legacy-recovery";
export interface RevisionMetadata {
  liveRevision: number;
  fullRevision: number;
  fullStructureRevision: number;
  observedStructureRevision: number;
  fullUpdatedAt: number | null;
}
export const emptyMetadata = (): RevisionMetadata => ({ liveRevision: -1, fullRevision: -1, fullStructureRevision: -1, observedStructureRevision: -1, fullUpdatedAt: null });
export interface WorkspaceCache {
  credential: string;
  workspaceId: string;
  role: WorkspaceRole;
  state: SyncState;
  metadata: RevisionMetadata;
}
export function readWorkspaceCache(): WorkspaceCache | null {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    if (!cache || typeof cache.credential !== "string" || typeof cache.workspaceId !== "string" || !["editor", "viewer"].includes(cache.role)) return null;
    const m = cache.metadata;
    if (!m || ![m.liveRevision,m.fullRevision,m.fullStructureRevision,m.observedStructureRevision].every(Number.isInteger) || (m.fullUpdatedAt !== null && !Number.isFinite(m.fullUpdatedAt))) return null;
    return { ...cache, state: normalizeWorkspace(cache.state) };
  } catch { return null; }
}
export function preserveLegacyCache() {
  try {
    if (localStorage.getItem(RECOVERY_KEY)) return;
    const keys = ["football-tracker-settings", "football-tracker-seasons", "football-tracker-active-season-id", "football-tracker-active-match", "football-tracker-matches", "football-tracker-full-matches", CACHE_KEY];
    localStorage.setItem(RECOVERY_KEY, JSON.stringify(Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)]))));
  } catch { /* Offline storage can be unavailable. */ }
}
export function saveWorkspaceCache(cache: WorkspaceCache) {
  try { preserveLegacyCache(); localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch { /* Server confirmation does not depend on cache availability. */ }
}
export function assembleWorkspace(seasons: SyncState["seasons"], activeSeasonId: string | null, activeMatch: SyncState["activeMatch"], settings: SyncState["settings"]): SyncState {
  const season = activeSeasonId ? seasons?.[activeSeasonId] : undefined;
  return normalizeWorkspace({ seasons, activeSeasonId, activeMatch, matches: season?.matches ?? [], fullMatches: season?.fullMatches ?? {}, settings });
}
