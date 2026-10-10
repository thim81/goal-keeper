import { type WorkspaceRequestContext, forwardWorkspace, responseHeaders } from "../_workspace";
export const onRequestGet = (context: WorkspaceRequestContext) =>
  forwardWorkspace(context, "/active-match");
export const onRequestOptions = async () =>
  new Response(null, { status: 204, headers: responseHeaders });
