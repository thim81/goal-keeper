import { type WorkspaceRequestContext, forwardWorkspace, responseHeaders } from "../_workspace";
export const onRequestPost = (context: WorkspaceRequestContext) =>
  forwardWorkspace(context, "/command", true);
export const onRequestOptions = async () =>
  new Response(null, { status: 204, headers: responseHeaders });
