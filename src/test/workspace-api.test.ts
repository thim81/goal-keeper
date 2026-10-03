import { describe, it, expect, vi } from "vitest";
import { onRequestGet, onRequestPost } from "../../functions/api/state";
import { onRequestGet as live } from "../../functions/api/active-match";
import { onRequestPost as command } from "../../functions/api/command";
import { onRequestGet as share } from "../../functions/api/share";
import { createEmptyWorkspace } from "../lib/workspace";
function context(token = "editor", protocol = "2", method = "GET") {
  const state = createEmptyWorkspace();
  state.settings = { ...state.settings, theme: "dark", syncToken: "secret", secret: "hidden" };
  const fetch = vi
    .fn()
    .mockResolvedValue(
      Response.json({
        scope: "structural",
        workspaceId: "goal-keeper",
        revision: 1,
        structureRevision: 1,
        state,
      }),
    );
  return {
    request: new Request("https://example.com/api/state", {
      method,
      headers: { "x-auth-token": token, "X-Workspace-Protocol": protocol },
      ...(method === "POST"
        ? { body: JSON.stringify({ id: "c", type: "start-match", payload: { isHome: true } }) }
        : {}),
    }),
    env: {
      AUTH_TOKEN: "editor",
      VIEWER_TOKEN: "viewer",
      WORKSPACES: {
        idFromName: vi.fn().mockReturnValue("stable"),
        get: vi.fn().mockReturnValue({ fetch }),
      },
      GOALKEEPER_KV: { get: vi.fn(), put: vi.fn() },
    },
    fetch,
  };
}
describe("Pages authoritative adapters", () => {
  it.each(["editor", "viewer"])("%s reads stable workspace without touching KV", async (token) => {
    const c = context(token);
    const r = await onRequestGet(c as never);
    expect(r.status).toBe(200);
    expect(r.headers.get("X-Workspace-Role")).toBe(token);
    expect(c.env.WORKSPACES.idFromName).toHaveBeenCalledWith("goal-keeper");
    const data = await r.json();
    expect(data.state.settings).not.toHaveProperty("syncToken");
    expect(data.state.settings).not.toHaveProperty("theme");
    expect(data.state.settings).not.toHaveProperty("secret");
    expect(c.env.GOALKEEPER_KV.get).not.toHaveBeenCalled();
  });
  it("forwards live reads", async () => {
    const c = context("viewer");
    c.fetch.mockResolvedValue(
      Response.json({ scope: "live", revision: 1, structureRevision: 1, activeMatch: null }),
    );
    const r = await live(c as never);
    expect(r.status).toBe(200);
    expect(c.fetch.mock.calls[0][0].url).toContain("/active-match");
  });
  it("rejects viewers before forwarding writes", async () => {
    const c = context("viewer", "2", "POST");
    expect((await command(c as never)).status).toBe(403);
    expect(c.fetch).not.toHaveBeenCalled();
  });
  it("forwards editor commands and confirmed role", async () => {
    const c = context("editor", "2", "POST");
    const r = await command(c as never);
    expect(r.headers.get("X-Workspace-Role")).toBe("editor");
    expect(c.fetch.mock.calls[0][0].url).toContain("/command");
  });
  it("blocks incompatible reads and legacy uploads", async () => {
    const c = context("editor", "");
    expect((await onRequestGet(c as never)).status).toBe(426);
    expect((await onRequestPost(context("editor", "2", "POST") as never)).status).toBe(410);
    expect(c.env.GOALKEEPER_KV.put).not.toHaveBeenCalled();
  });
  it("rejects invalid auth and reports missing binding", async () => {
    expect((await onRequestGet(context("bad") as never)).status).toBe(401);
    const c = context();
    delete (c.env as any).WORKSPACES;
    expect((await onRequestGet(c as never)).status).toBe(503);
  });
  it("propagates storage failure without fallback", async () => {
    const c = context();
    c.fetch.mockRejectedValue(new Error("storage"));
    expect((await onRequestGet(c as never)).status).toBe(503);
    expect(c.env.GOALKEEPER_KV.get).not.toHaveBeenCalled();
  });
  it("share preserves existing token contract", async () => {
    const c = context();
    expect(await (await share(c as never)).json()).toEqual({ viewerToken: "viewer" });
    expect((await share(context("viewer") as never)).status).toBe(403);
  });
});
