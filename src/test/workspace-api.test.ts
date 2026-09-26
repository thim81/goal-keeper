import { describe, expect, it, vi } from "vitest";
import { onRequestGet, onRequestPost } from "../../functions/api/state";

const state = {
  matches: [],
  fullMatches: {},
  activeMatch: null,
  settings: {
    teamName: "Club",
    players: ["Alice"],
    periodsCount: 4,
    periodDuration: 20,
    syncToken: "editor",
    calendarUrl: "private",
    debug: true,
  },
};
function context(token: string, method = "GET", stored: unknown = state) {
  return {
    env: {
      AUTH_TOKEN: "editor",
      VIEWER_TOKEN: "viewer",
      GOALKEEPER_KV: {
        get: vi.fn().mockResolvedValue(stored === null ? null : JSON.stringify(stored)),
        put: vi.fn(),
      },
    },
    request: new Request("https://example.com/api/state", {
      method,
      headers: { "x-auth-token": token },
      ...(method === "POST" ? { body: JSON.stringify(state) } : {}),
    }),
  };
}
describe("workspace permissions", () => {
  it("allows viewers to read without exposing credentials or private settings", async () => {
    const response = await onRequestGet(context("viewer") as never);
    expect(response.status).toBe(200);
    expect(response.headers.get("X-Workspace-Role")).toBe("viewer");
    expect((await response.json()).settings).toEqual({
      teamName: "Club",
      players: ["Alice"],
      periodsCount: 4,
      periodDuration: 20,
    });
  });
  it("strips legacy credentials for editors too", async () => {
    const response = await onRequestGet(context("editor") as never);
    expect((await response.json()).settings).not.toHaveProperty("syncToken");
    expect(response.headers.get("X-Workspace-Role")).toBe("editor");
  });
  it("returns viewer permissions even for an empty workspace", async () => {
    const response = await onRequestGet(context("viewer", "GET", null) as never);
    expect(response.status).toBe(204);
    expect(response.headers.get("X-Workspace-Role")).toBe("viewer");
  });
  it("rejects viewer writes without touching KV", async () => {
    const ctx = context("viewer", "POST");
    expect((await onRequestPost(ctx as never)).status).toBe(403);
    expect(ctx.env.GOALKEEPER_KV.put).not.toHaveBeenCalled();
  });
  it("rejects invalid credentials", async () => {
    expect((await onRequestGet(context("bad") as never)).status).toBe(401);
    expect((await onRequestPost(context("bad", "POST") as never)).status).toBe(401);
  });
  it("strips credentials on editor writes", async () => {
    const ctx = context("editor", "POST");
    expect((await onRequestPost(ctx as never)).status).toBe(204);
    expect(JSON.parse(ctx.env.GOALKEEPER_KV.put.mock.calls[0][1]).settings).not.toHaveProperty(
      "syncToken",
    );
  });
});

describe("workspace sharing", () => {
  it("only returns the viewer credential to editors", async () => {
    const { onRequestGet: share } = await import("../../functions/api/share");
    expect((await share(context("viewer") as never)).status).toBe(403);
    expect((await share(context("bad") as never)).status).toBe(401);
    const response = await share(context("editor") as never);
    expect(await response.json()).toEqual({ viewerToken: "viewer" });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
  it("rejects missing or identical viewer secrets", async () => {
    const { onRequestGet: share } = await import("../../functions/api/share");
    for (const token of ["", "editor"]) {
      const ctx = context("editor");
      ctx.env.VIEWER_TOKEN = token;
      expect((await share(ctx as never)).status).toBe(503);
    }
  });
});
