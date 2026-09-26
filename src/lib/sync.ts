import type { Match, MatchSummary, Season } from "@/types/match";

export interface SyncState {
  matches: MatchSummary[];
  activeMatch: Match | null;
  fullMatches: Record<string, Match>;
  seasons?: Record<string, Season>;
  activeSeasonId?: string;
  settings: any;
}

export type WorkspaceRole = "editor" | "viewer";
export interface RemoteState {
  state: SyncState | null;
  role: WorkspaceRole;
}

export async function fetchRemoteState(token: string, signal?: AbortSignal): Promise<RemoteState> {
  const response = await fetch("/api/state", { headers: { "x-auth-token": token }, signal });
  if (!response.ok)
    throw Object.assign(new Error("Failed to fetch remote state"), { status: response.status });
  const role = response.headers.get("X-Workspace-Role");
  if (role !== "editor" && role !== "viewer") throw new Error("Workspace role was not confirmed");
  return { state: response.status === 204 ? null : await response.json(), role };
}

export async function pushLocalState(
  token: string,
  state: SyncState,
  signal?: AbortSignal,
): Promise<number> {
  try {
    const response = await fetch("/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-auth-token": token },
      body: JSON.stringify(state),
      signal,
    });
    return response.status;
  } catch {
    return 0;
  }
}
