import type { Match, MatchSummary, Season } from "../types/match";
import {
  assertResponse,
  COMMAND_SCOPES,
  type WorkspaceCommand,
  type WorkspaceResponse,
  type CommandResponse,
  type LiveResponse,
  type StructuralResponse,
} from "./workspace";

export interface SyncState {
  matches: MatchSummary[];
  activeMatch: Match | null;
  fullMatches: Record<string, Match>;
  seasons?: Record<string, Season>;
  activeSeasonId?: string;
  settings: any;
}
export type WorkspaceRole = "editor" | "viewer";
export type RemoteState = StructuralResponse & { role: WorkspaceRole };
export class SyncError extends Error {
  constructor(
    message: string,
    public status = 0,
  ) {
    super(message);
  }
}
async function request(
  token: string,
  path: string,
  signal?: AbortSignal,
  command?: WorkspaceCommand,
): Promise<WorkspaceResponse & { role: WorkspaceRole }> {
  const timeout = AbortSignal.timeout(10_000);
  const response = await fetch(path, {
    method: command ? "POST" : "GET",
    headers: {
      "x-auth-token": token,
      "X-Workspace-Protocol": "2",
      ...(command ? { "Content-Type": "application/json" } : {}),
    },
    ...(command ? { body: JSON.stringify(command) } : {}),
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (!response.ok)
    throw new SyncError((await response.text()) || "Workspace request failed", response.status);
  const role = response.headers.get("X-Workspace-Role");
  if (role !== "editor" && role !== "viewer")
    throw new SyncError("Workspace role was not confirmed");
  return { ...assertResponse(await response.json()), role };
}
export async function fetchRemoteState(token: string, signal?: AbortSignal): Promise<RemoteState> {
  const response = await request(token, "/api/state", signal);
  if (response.scope !== "structural") throw new SyncError("Expected full workspace");
  return response;
}
export async function fetchActiveMatch(
  token: string,
  signal?: AbortSignal,
): Promise<LiveResponse & { role: WorkspaceRole }> {
  const response = await request(token, "/api/active-match", signal);
  if (response.scope !== "live") throw new SyncError("Expected live state");
  return response;
}
export async function postCommand(token: string, command: WorkspaceCommand, signal?: AbortSignal) {
  const response = await request(token, "/api/command", signal, command);
  if (response.commandId !== command.id || response.scope !== COMMAND_SCOPES[command.type])
    throw new SyncError("Command response was not confirmed");
  return response as CommandResponse & { role: WorkspaceRole };
}
