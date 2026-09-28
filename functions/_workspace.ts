export interface Env {
  GOALKEEPER_KV: {
    get(key: string, options?: { cacheTtl?: number }): Promise<string | null>;
    put(key: string, value: string): Promise<void>;
  };
  AUTH_TOKEN: string;
  VIEWER_TOKEN?: string;
}

export interface WorkspaceRequestContext {
  env: Env;
  request: Request;
}

export type WorkspaceRole = "editor" | "viewer";
export const STORAGE_KEY = "goal-keeper-state";
export const responseHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, x-auth-token",
  "Access-Control-Expose-Headers": "X-Workspace-Role",
  "Cache-Control": "no-store",
};

export function getRole(request: Request, env: Env): WorkspaceRole | null {
  const authorization = request.headers.get("Authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : request.headers.get("x-auth-token");
  if (!token) return null;
  if (env.AUTH_TOKEN && token === env.AUTH_TOKEN) return "editor";
  if (env.VIEWER_TOKEN && env.VIEWER_TOKEN !== env.AUTH_TOKEN && token === env.VIEWER_TOKEN) {
    return "viewer";
  }
  return null;
}

export function sanitizeState(body: unknown, role: WorkspaceRole) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid state");
  const state = body as Record<string, unknown>;
  if (!state.settings || typeof state.settings !== "object" || Array.isArray(state.settings)) {
    throw new Error("Invalid settings");
  }
  const { syncToken: _token, ...settings } = state.settings as Record<string, unknown>;
  if (role === "editor") return { ...state, settings };
  const { teamName, players, periodsCount, periodDuration, calendarUrl, calendarTeamName } =
    settings;
  return {
    matches: state.matches,
    fullMatches: state.fullMatches,
    activeMatch: state.activeMatch,
    seasons: state.seasons,
    activeSeasonId: state.activeSeasonId,
    settings: {
      teamName,
      players,
      periodsCount,
      periodDuration,
      calendarUrl: typeof calendarUrl === "string" ? calendarUrl : "",
      calendarTeamName: typeof calendarTeamName === "string" ? calendarTeamName : "",
    },
  };
}
