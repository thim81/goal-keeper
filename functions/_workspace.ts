export interface Env {
  GOALKEEPER_KV: {
    get(key: string, options?: { cacheTtl?: number }): Promise<string | null>;
    put(key: string, value: string): Promise<void>;
  };
  WORKSPACES?: {
    idFromName(name: string): any;
    get(id: any): { fetch(request: Request): Promise<Response> };
  };
  WORKSPACE_ID?: string;
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
  "Access-Control-Allow-Headers": "Authorization, Content-Type, x-auth-token, X-Workspace-Protocol",
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
  const state = body as Record<string, any>;
  if (!state.settings || typeof state.settings !== "object") throw new Error("Invalid settings");
  const { teamName, players, periodsCount, periodDuration, calendarUrl, calendarTeamName, debug } =
    state.settings;
  return {
    ...state,
    settings: {
      teamName,
      players,
      periodsCount,
      periodDuration,
      calendarUrl: calendarUrl ?? "",
      calendarTeamName: calendarTeamName ?? "",
      ...(role === "editor" ? { debug } : {}),
    },
  };
}

export async function forwardWorkspace(
  { env, request }: WorkspaceRequestContext,
  path: string,
  write = false,
) {
  const role = getRole(request, env);
  if (!role) return new Response("Unauthorized", { status: 401, headers: responseHeaders });
  const headers = { ...responseHeaders, "X-Workspace-Role": role };
  if (write && role !== "editor") return new Response("View-only access", { status: 403, headers });
  if (request.headers.get("X-Workspace-Protocol") !== "2")
    return new Response("Upgrade required: reload Goal Keeper", { status: 426, headers });
  if (!env.WORKSPACES)
    return new Response("Authoritative workspace is unavailable", { status: 503, headers });
  try {
    const stub = env.WORKSPACES.get(env.WORKSPACES.idFromName(env.WORKSPACE_ID || "goal-keeper"));
    const upstream = await stub.fetch(
      new Request(`https://workspace.internal${path}`, {
        method: write ? "POST" : "GET",
        ...(write
          ? { body: await request.text(), headers: { "Content-Type": "application/json" } }
          : {}),
      }),
    );
    if (!upstream.ok)
      return new Response(await upstream.text(), { status: upstream.status, headers });
    const body = (await upstream.json()) as Record<string, any>;
    if (body.scope === "structural") body.state = sanitizeState(body.state, role);
    return Response.json(body, { headers });
  } catch {
    console.error("workspace_storage_error", { path });
    return new Response("Authoritative workspace is unavailable; cached data was preserved", {
      status: 503,
      headers,
    });
  }
}
