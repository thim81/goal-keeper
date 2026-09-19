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
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(state))));

    await expect(fetchRemoteState("token")).resolves.toEqual(state);
    expect(fetch).toHaveBeenCalledWith("/api/state", {
      headers: { "x-auth-token": "token" },
    });
  });

  it("returns null when there is no remote state yet (204)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));

    await expect(fetchRemoteState("token")).resolves.toBeNull();
  });

  it("returns null and logs when the response is not ok", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("oops", { status: 500 })));

    await expect(fetchRemoteState("token")).resolves.toBeNull();
    expect(console.error).toHaveBeenCalled();
  });

  it("returns null when the network request fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(fetchRemoteState("token")).resolves.toBeNull();
    expect(console.error).toHaveBeenCalled();
  });

  it("returns null when the response body is not valid JSON", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not json")));

    await expect(fetchRemoteState("token")).resolves.toBeNull();
    expect(console.error).toHaveBeenCalled();
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

    await expect(pushLocalState("token", state)).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-auth-token": "token" },
      body: JSON.stringify(state),
    });
  });

  it("returns false when the upstream response is not ok", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));

    await expect(pushLocalState("token", state)).resolves.toBe(false);
    expect(console.error).toHaveBeenCalled();
  });

  it("returns false when the network request fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(pushLocalState("token", state)).resolves.toBe(false);
    expect(console.error).toHaveBeenCalled();
  });
});
