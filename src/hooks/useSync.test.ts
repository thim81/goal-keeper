import { act, renderHook, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSync } from "./useSync";
import { createEmptyWorkspace } from "../lib/workspace";
import { DEFAULT_SETTINGS } from "../types/match";
import { fetchRemoteState, fetchActiveMatch, postCommand } from "../lib/sync";
import { applyWorkspaceCommand } from "../lib/workspace-mutations";
import { saveWorkspaceCache, emptyMetadata } from "../lib/workspace-cache";
import { readWorkspaceCache } from "../lib/workspace-cache";
vi.mock("../lib/sync", async (importOriginal) => ({
  ...(await importOriginal<any>()),
  fetchRemoteState: vi.fn(),
  fetchActiveMatch: vi.fn(),
  postCommand: vi.fn(),
}));
const state = createEmptyWorkspace(100);
const full = (revision = 1, structureRevision = 1) => ({
  scope: "structural" as const,
  workspaceId: "goal-keeper",
  revision,
  structureRevision,
  state,
  role: "editor" as const,
});
const live = (revision = 2, structureRevision = 1) => ({
  scope: "live" as const,
  workspaceId: "goal-keeper",
  revision,
  structureRevision,
  activeMatch: null,
  activeSeasonId: state.activeSeasonId,
  role: "editor" as const,
});
const deferred = () => {
  let resolve: any;
  const promise = new Promise<any>((r) => (resolve = r));
  return { promise, resolve };
};
const flush = async () =>
  act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  vi.mocked(fetchRemoteState).mockReset().mockResolvedValue(full());
  vi.mocked(fetchActiveMatch).mockReset().mockResolvedValue(live());
  vi.mocked(postCommand).mockReset();
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
function mount(token = "editor", onFull = vi.fn(), onLive = vi.fn()) {
  return {
    ...renderHook(
      ({ token }) =>
        useSync(token, state.seasons, state.activeSeasonId, null, DEFAULT_SETTINGS, onFull, onLive),
      { initialProps: { token } },
    ),
    onFull,
    onLive,
  };
}
describe("authoritative sync", () => {
  it("reads startup and never uploads on local rerenders", async () => {
    const h = mount();
    await flush();
    h.rerender({ token: "editor" });
    await flush();
    expect(h.onFull).toHaveBeenCalledOnce();
    expect(postCommand).not.toHaveBeenCalled();
    expect(h.result.current.status).toBe("editor");
  });
  it("coalesces manual refresh requests", async () => {
    const h = mount();
    await flush();
    const d = deferred();
    vi.mocked(fetchRemoteState).mockReturnValue(d.promise);
    let a: Promise<any>;
    await act(async () => {
      a = h.result.current.syncNow();
      void h.result.current.syncNow();
    });
    expect(fetchRemoteState).toHaveBeenCalledTimes(2);
    d.resolve(full(2));
    await act(async () => {
      await a!;
    });
  });
  it("partial commands never refresh history/settings freshness", async () => {
    const h = mount();
    await flush();
    const before = h.result.current.lastSyncedAt;
    vi.mocked(postCommand).mockResolvedValue({ ...live(2), commandId: "cmd" });
    await act(async () => {
      await h.result.current.executeCommand({ id: "cmd", type: "pause-match", matchId: "m" });
    });
    expect(h.onFull).toHaveBeenCalledOnce();
    expect(h.onLive).toHaveBeenCalledOnce();
    expect(h.result.current.lastSyncedAt).toBe(before);
    expect(readWorkspaceCache()?.metadata.fullRevision).toBe(1);
  });
  it("same-revision full response completes partial data", async () => {
    const h = mount();
    await flush();
    vi.mocked(postCommand).mockResolvedValue({ ...live(2, 2), commandId: "cmd" });
    vi.mocked(fetchRemoteState).mockResolvedValue(full(2, 2));
    await act(async () => {
      await h.result.current.executeCommand({ id: "cmd", type: "pause-match", matchId: "m" });
    });
    await flush();
    expect(h.onFull).toHaveBeenCalledTimes(2);
    expect(h.result.current.metadata.fullRevision).toBe(2);
  });
  it("older read cannot replace a newer command", async () => {
    const h = mount();
    await flush();
    const d = deferred();
    vi.mocked(fetchRemoteState).mockReturnValue(d.promise);
    let read: Promise<any>;
    await act(async () => {
      read = h.result.current.syncNow();
    });
    vi.mocked(postCommand).mockResolvedValue({ ...live(3), commandId: "cmd" });
    await act(async () => {
      await h.result.current.executeCommand({ id: "cmd", type: "pause-match", matchId: "m" });
    });
    d.resolve(full(2));
    await act(async () => {
      await read!;
    });
    expect(h.onFull).toHaveBeenCalledOnce();
    expect(h.result.current.metadata.liveRevision).toBe(3);
  });
  it("failed full refresh leaves history stale", async () => {
    const h = mount();
    await flush();
    vi.mocked(fetchRemoteState).mockRejectedValue(new Error("offline"));
    vi.mocked(postCommand).mockResolvedValue({ ...live(2, 2), commandId: "cmd" });
    await act(async () => {
      await h.result.current.executeCommand({ id: "cmd", type: "pause-match", matchId: "m" });
    });
    await flush();
    expect(h.result.current.isWorkspaceStale).toBe(true);
    expect(h.result.current.metadata.fullStructureRevision).toBe(1);
  });
  it("old credentials cannot apply late reads", async () => {
    const d = deferred();
    vi.mocked(fetchRemoteState)
      .mockReturnValueOnce(d.promise)
      .mockResolvedValue({ ...full(4), role: "viewer" });
    const h = mount();
    h.rerender({ token: "viewer" });
    await flush();
    d.resolve(full(10));
    await flush();
    expect(h.onFull).toHaveBeenCalledOnce();
    expect(h.result.current.role).toBe("viewer");
    expect(h.result.current.metadata.fullRevision).toBe(4);
  });
  it("retries transport failures with the same ID; unconfirmed reads do not acknowledge action", async () => {
    const h = mount();
    await flush();
    vi.mocked(postCommand).mockRejectedValue(new TypeError("network"));
    await act(async () => {
      expect(
        await h.result.current.executeCommand({ id: "cmd", type: "pause-match", matchId: "m" }),
      ).toBe(false);
    });
    expect(postCommand).toHaveBeenCalledTimes(2);
    expect(vi.mocked(postCommand).mock.calls.every((call) => call[1].id === "cmd")).toBe(true);
    expect(h.result.current.failedCommand?.id).toBe("cmd");
    await act(async () => {
      await h.result.current.syncNow();
    });
    expect(h.result.current.failedCommand?.id).toBe("cmd");
  });
  it("allows one command at a time", async () => {
    const h = mount();
    await flush();
    const d = deferred();
    vi.mocked(postCommand).mockReturnValue(d.promise);
    let first: Promise<any>;
    await act(async () => {
      first = h.result.current.executeCommand({ id: "one", type: "pause-match", matchId: "m" });
      expect(
        await h.result.current.executeCommand({ id: "two", type: "pause-match", matchId: "m" }),
      ).toBe(false);
    });
    d.resolve({ ...live(), commandId: "one" });
    await act(async () => {
      await first!;
    });
    expect(postCommand).toHaveBeenCalledOnce();
  });
  it("blocks offline/viewer editing; local mode sends no requests", async () => {
    vi.mocked(fetchRemoteState).mockResolvedValue({ ...full(), role: "viewer" });
    const h = mount();
    await flush();
    expect(await h.result.current.executeCommand({ id: "cmd", type: "pause-match" })).toBe(false);
    h.rerender({ token: "" });
    await flush();
    expect(h.result.current.status).toBe("local");
    expect(postCommand).not.toHaveBeenCalled();
  });
  it("polls idle every 30 seconds, pauses hidden, refreshes on visibility", async () => {
    mount();
    await flush();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });
    expect(fetchRemoteState).toHaveBeenCalledTimes(2);
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });
    expect(fetchRemoteState).toHaveBeenCalledTimes(2);
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    await flush();
    expect(fetchRemoteState).toHaveBeenCalledTimes(3);
  });
  it("polls live every 10 seconds, coalesces overlapping live reads and fetches full on end", async () => {
    const active = applyWorkspaceCommand(state, {
      id: "start",
      type: "start-match",
      payload: { isHome: true },
    }).state;
    vi.mocked(fetchRemoteState).mockResolvedValue({ ...full(), state: active });
    vi.mocked(fetchActiveMatch).mockResolvedValue({ ...live(2), activeMatch: active.activeMatch });
    const onFull = vi.fn(),
      onLive = vi.fn();
    renderHook(() =>
      useSync(
        "editor",
        active.seasons,
        active.activeSeasonId,
        active.activeMatch,
        DEFAULT_SETTINGS,
        onFull,
        onLive,
      ),
    );
    await flush();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(fetchActiveMatch).toHaveBeenCalledOnce();
    vi.mocked(fetchActiveMatch).mockResolvedValue(live(3, 2));
    vi.mocked(fetchRemoteState).mockResolvedValue(full(3, 2));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    await flush();
    expect(onFull).toHaveBeenCalledTimes(2);
    expect(onLive).toHaveBeenCalledTimes(2);
  });
  it("uses saved cache metadata on offline startup without granting editing", async () => {
    const metadata = {
      ...emptyMetadata(),
      liveRevision: 2,
      fullRevision: 1,
      fullStructureRevision: 1,
      observedStructureRevision: 2,
      fullUpdatedAt: 100,
    };
    saveWorkspaceCache({
      credential: "editor",
      workspaceId: "goal-keeper",
      role: "editor",
      state,
      metadata,
    });
    vi.mocked(fetchRemoteState).mockRejectedValue(new Error("offline"));
    const h = mount();
    await flush();
    expect(h.result.current.metadata).toEqual(metadata);
    expect(h.result.current.role).toBe("editor");
    expect(h.result.current.isCredentialConfirmed).toBe(false);
    expect(await h.result.current.executeCommand({ id: "cmd", type: "pause-match" })).toBe(false);
  });
  it("invalid credential responses revoke role and do not retry commands", async () => {
    const h = mount();
    await flush();
    vi.mocked(postCommand).mockRejectedValue(Object.assign(new Error("revoked"), { status: 403 }));
    vi.mocked(fetchRemoteState).mockRejectedValue(
      Object.assign(new Error("revoked"), { status: 401 }),
    );
    await act(async () => {
      expect(await h.result.current.executeCommand({ id: "cmd", type: "pause-match" })).toBe(false);
    });
    await flush();
    expect(postCommand).toHaveBeenCalledOnce();
    expect(h.result.current.role).toBeNull();
    expect(h.result.current.status).toBe("invalid");
    expect(h.result.current.isCredentialConfirmed).toBe(false);
  });
  it("explicit retry keeps failed command ID and clears failure only when confirmed", async () => {
    const h = mount();
    await flush();
    vi.mocked(postCommand).mockRejectedValue(new Error("lost"));
    await act(async () => {
      await h.result.current.executeCommand({ id: "cmd", type: "pause-match", matchId: "m" });
    });
    vi.mocked(postCommand).mockResolvedValue({ ...live(2), commandId: "cmd" });
    await act(async () => {
      expect(await h.result.current.retryCommand()).toBe(true);
    });
    expect(h.result.current.failedCommand).toBeNull();
    expect(h.result.current.pendingCommand).toBeNull();
    expect(await h.result.current.retryCommand()).toBe(false);
  });
  it("late commands from prior credentials cannot apply or clear current pending action", async () => {
    const h = mount();
    await flush();
    const d = deferred();
    vi.mocked(postCommand).mockReturnValueOnce(d.promise);
    let first: Promise<boolean>;
    await act(async () => {
      first = h.result.current.executeCommand({ id: "old", type: "pause-match", matchId: "m" });
    });
    vi.mocked(fetchRemoteState).mockResolvedValue({ ...full(4), role: "viewer" });
    h.rerender({ token: "viewer" });
    await flush();
    d.resolve({ ...live(10), commandId: "old" });
    await act(async () => {
      expect(await first!).toBe(false);
    });
    expect(h.onLive).not.toHaveBeenCalled();
    expect(h.result.current.metadata.fullRevision).toBe(4);
  });
  it("late command rejection after token changes does not affect new credentials", async () => {
    let reject: any;
    const promise = new Promise<any>((_, r) => (reject = r));
    const h = mount();
    await flush();
    vi.mocked(postCommand).mockReturnValue(promise);
    let action: Promise<boolean>;
    await act(async () => {
      action = h.result.current.executeCommand({ id: "old", type: "pause-match" });
    });
    h.rerender({ token: "viewer" });
    await flush();
    vi.mocked(postCommand).mockRejectedValue(Object.assign(new Error("denied"), { status: 403 }));
    reject(Object.assign(new Error("denied"), { status: 403 }));
    await act(async () => {
      expect(await action!).toBe(false);
    });
    expect(h.result.current.failedCommand).toBeNull();
  });
  it("refuses workspace identity changes and preserves cached data", async () => {
    const h = mount();
    await flush();
    vi.mocked(fetchRemoteState).mockResolvedValue({ ...full(2), workspaceId: "other" });
    await act(async () => {
      await h.result.current.syncNow();
    });
    expect(h.onFull).toHaveBeenCalledOnce();
    expect(h.result.current.status).toBe("unavailable");
    expect(h.result.current.isCredentialConfirmed).toBe(false);
    expect(await h.result.current.executeCommand({ id: "cmd", type: "pause-match" })).toBe(false);
    expect(postCommand).not.toHaveBeenCalled();
  });
  it("discarded prior credential errors never revoke a new handshake", async () => {
    let reject: any;
    const d = new Promise<any>((_, r) => (reject = r));
    vi.mocked(fetchRemoteState)
      .mockReturnValueOnce(d)
      .mockResolvedValue({ ...full(2), role: "viewer" });
    const h = mount();
    h.rerender({ token: "viewer" });
    await flush();
    reject(Object.assign(new Error("revoked"), { status: 401 }));
    await flush();
    expect(h.result.current.status).toBe("viewer");
  });
  it("local manual refresh resolves without network requests", async () => {
    const h = mount("");
    await flush();
    await act(async () => {
      await h.result.current.syncNow();
    });
    expect(fetchRemoteState).not.toHaveBeenCalled();
    expect(h.result.current.isSyncing).toBe(false);
  });
});
