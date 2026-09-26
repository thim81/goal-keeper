import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchRemoteState, pushLocalState, type SyncState } from "./sync";

const state: SyncState = {
  matches: [],
  activeMatch: null,
  fullMatches: {},
  settings: { teamName: "My Team" },
};

describe("fetchRemoteState", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns the parsed remote state on a successful response", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify(state), { headers: { "X-Workspace-Role": "editor" } }),
        ),
    );

    await expect(fetchRemoteState("token")).resolves.toEqual({ state, role: "editor" });
    expect(fetch).toHaveBeenCalledWith("/api/state", {
      headers: { "x-auth-token": "token" },
    });
  });

  it("returns null when there is no remote state yet (204)", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(null, { status: 204, headers: { "X-Workspace-Role": "editor" } }),
        ),
    );

    await expect(fetchRemoteState("token")).resolves.toEqual({ state: null, role: "editor" });
  });

  it("distinguishes invalid credentials from unavailable service", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("bad", { status: 401 })));
    await expect(fetchRemoteState("token")).rejects.toMatchObject({ status: 401 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("oops", { status: 500 })));
    await expect(fetchRemoteState("token")).rejects.toMatchObject({ status: 500 });
  });

  it("returns null when the network request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(fetchRemoteState("token")).rejects.toThrow("offline");
  });

  it("rejects when the response body is not valid JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not json")));

    await expect(fetchRemoteState("token")).rejects.toThrow();
  });

  it("passes an abort signal to fetch", async () => {
    const controller = new AbortController();
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify(state), { headers: { "X-Workspace-Role": "viewer" } }),
      );
    vi.stubGlobal("fetch", fetchMock);
    await fetchRemoteState("token", controller.signal);
    expect(fetchMock.mock.calls[0][1].signal).toBe(controller.signal);
  });

  it("rejects responses without a confirmed workspace role", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(state))));
    await expect(fetchRemoteState("token")).rejects.toThrow("Workspace role was not confirmed");
  });
});

describe("pushLocalState", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("posts the state with the auth token and returns true on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(pushLocalState("token", state)).resolves.toBe(200);
    expect(fetchMock).toHaveBeenCalledWith("/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-auth-token": "token" },
      body: JSON.stringify(state),
    });
  });

  it("returns false when the upstream response is not ok", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));

    await expect(pushLocalState("token", state)).resolves.toBe(500);
  });

  it("returns false when the network request fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(pushLocalState("token", state)).resolves.toBe(0);
  });
});
