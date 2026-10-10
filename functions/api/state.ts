import {
  type WorkspaceRequestContext,
  forwardWorkspace,
  getRole,
  responseHeaders,
} from "../_workspace";
export const onRequestGet = (context: WorkspaceRequestContext) =>
  forwardWorkspace(context, "/state");
export const onRequestPost = async ({ env, request }: WorkspaceRequestContext) => {
  const role = getRole(request, env);
  return new Response(
    role
      ? role === "editor"
        ? "Whole-workspace uploads are retired. Reload Goal Keeper."
        : "View-only access"
      : "Unauthorized",
    { status: role ? (role === "editor" ? 410 : 403) : 401, headers: responseHeaders },
  );
};
export const onRequestOptions = async () =>
  new Response(null, { status: 204, headers: responseHeaders });
