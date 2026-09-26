import {
  type WorkspaceRequestContext,
  getRole,
  responseHeaders,
  sanitizeState,
  STORAGE_KEY,
} from "../_workspace";

export const onRequestGet = async ({ env, request }: WorkspaceRequestContext) => {
  const role = getRole(request, env);
  if (!role) return new Response("Unauthorized", { status: 401, headers: responseHeaders });
  const headers = { ...responseHeaders, "X-Workspace-Role": role };
  const stored = await env.GOALKEEPER_KV.get(STORAGE_KEY);
  if (!stored) return new Response(null, { status: 204, headers });
  return Response.json(sanitizeState(JSON.parse(stored), role), { headers });
};

export const onRequestPost = async ({ env, request }: WorkspaceRequestContext) => {
  const role = getRole(request, env);
  if (!role) return new Response("Unauthorized", { status: 401, headers: responseHeaders });
  if (role !== "editor")
    return new Response("View-only access", { status: 403, headers: responseHeaders });
  let state;
  try {
    state = sanitizeState(await request.json(), role);
  } catch {
    return new Response("Invalid workspace state", { status: 400, headers: responseHeaders });
  }
  await env.GOALKEEPER_KV.put(STORAGE_KEY, JSON.stringify(state));
  return new Response(null, { status: 204, headers: responseHeaders });
};

export const onRequestOptions = async () =>
  new Response(null, {
    status: 204,
    headers: responseHeaders,
  });
