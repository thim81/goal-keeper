import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchRemoteState, fetchActiveMatch, postCommand } from "./sync";
import { createEmptyWorkspace } from "./workspace";
const body = {
  scope: "structural",
  workspaceId: "goal-keeper",
  revision: 1,
  structureRevision: 1,
  state: createEmptyWorkspace(),
};
const response = (value = body, role = "editor", status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { "X-Workspace-Role": role } });
afterEach(() => vi.unstubAllGlobals());
describe("authoritative workspace transport", () => {
  it("reads the full envelope with protocol version and confirmed role", async () => {
    const fetch = vi.fn().mockResolvedValue(response());
    vi.stubGlobal("fetch", fetch);
    expect(await fetchRemoteState("editor")).toEqual({ ...body, role: "editor" });
    expect(fetch.mock.calls[0][1].headers).toMatchObject({
      "x-auth-token": "editor",
      "X-Workspace-Protocol": "2",
    });
  });
  it("reads live state without a full workspace", async () => {
    const live = {
      scope: "live",
      workspaceId: "goal-keeper",
      revision: 2,
      structureRevision: 1,
      activeMatch: null,
      activeSeasonId: body.state.activeSeasonId,
    };
    const fetch = vi.fn().mockResolvedValue(response(live as never, "viewer"));
    vi.stubGlobal("fetch", fetch);
    expect(await fetchActiveMatch("viewer")).toEqual({ ...live, role: "viewer" });
    expect(fetch.mock.calls[0][0]).toBe("/api/active-match");
  });
  it("posts intent to the command endpoint", async () => {
    const command = {
      id: "cmd",
      type: "start-match" as const,
      payload: { opponentName: "Rivals", myTeamName: "Team", isHome: true },
    };
    const fetch = vi.fn().mockResolvedValue(response({ ...body, commandId: "cmd" } as never));
    vi.stubGlobal("fetch", fetch);
    await postCommand("editor", command);
    expect(fetch.mock.calls[0][0]).toBe("/api/command");
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(command);
  });
  it.each([401, 403, 422, 426, 503])(
    "propagates status %s without pretending to succeed",
    async (status) => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("failure", { status })));
      await expect(fetchRemoteState("token")).rejects.toMatchObject({ status });
    },
  );
  it("rejects missing roles and mismatched response scopes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body))));
    await expect(fetchRemoteState("token")).rejects.toThrow();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response()));
    await expect(fetchActiveMatch("token")).rejects.toThrow();
  });
  it("propagates cancellation and invalid JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("Aborted", "AbortError")));
    await expect(fetchRemoteState("token")).rejects.toMatchObject({ name: "AbortError" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("bad", { headers: { "X-Workspace-Role": "editor" } })),
    );
    await expect(fetchRemoteState("token")).rejects.toThrow();
  });
});
