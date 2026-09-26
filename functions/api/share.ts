import { type WorkspaceRequestContext, getRole, responseHeaders } from "../_workspace";

export const onRequestGet = async ({ env, request }: WorkspaceRequestContext) => {
  const role = getRole(request, env);
  if (!role) return new Response("Unauthorized", { status: 401, headers: responseHeaders });
  if (role !== "editor")
    return new Response("View-only access", { status: 403, headers: responseHeaders });
  if (!env.VIEWER_TOKEN || env.VIEWER_TOKEN === env.AUTH_TOKEN) {
    return new Response("Viewer access is not configured", {
      status: 503,
      headers: responseHeaders,
    });
  }
  return Response.json({ viewerToken: env.VIEWER_TOKEN }, { headers: responseHeaders });
};
