import { act, renderHook, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSync } from "./useSync";
import { createEmptyWorkspace } from "../lib/workspace";
import { DEFAULT_SETTINGS } from "../types/match";
import { fetchRemoteState, fetchActiveMatch, postCommand } from "../lib/sync";
import { applyWorkspaceCommand } from "../lib/workspace-mutations";
import { useWorkspaceActions } from "./useWorkspaceActions";
import { saveWorkspaceCache, emptyMetadata } from "../lib/workspace-cache";
import { readWorkspaceCache } from "../lib/workspace-cache";
import { toast } from "sonner";
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
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
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
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
  it("records a later identical goal with a fresh time after a committed goal loses both responses", async () => {
    const initial = applyWorkspaceCommand(state, {
      id: "start",
      type: "start-match",
      payload: { isHome: true },
    }).state;
    let server = initial;
    let revision = 1;
    let structureRevision = 1;
    let loseResponse = true;
    const accepted = new Set<string>();
    vi.mocked(fetchRemoteState).mockImplementation(async () => ({
      ...full(revision, structureRevision),
      state: server,
    }));
    vi.mocked(postCommand).mockImplementation(async (_token, command) => {
      if (!accepted.has(command.id)) {
        const update = applyWorkspaceCommand(server, command);
        server = update.state;
        if (update.structureChanged) structureRevision++;
        accepted.add(command.id);
        if (update.changed) revision++;
      }
      if (loseResponse) throw new TypeError("response lost after commit");
      return {
        ...live(revision, structureRevision),
        commandId: command.id,
        activeMatch: server.activeMatch,
      };
    });
    const h = renderHook(() => {
      const sync = useSync(
        "editor",
        initial.seasons,
        initial.activeSeasonId,
        initial.activeMatch,
        DEFAULT_SETTINGS,
        vi.fn(),
      );
      const dispatch = useWorkspaceActions(initial, false, vi.fn(), sync.executeCommand);
      return { sync, dispatch };
    });
    await flush();
    const target = { matchId: initial.activeMatch!.id };
    await act(async () => {
      expect(
        await h.result.current.dispatch("add-goal", { team: "my-team", scorer: "Alice" }, target),
      ).toBe(false);
    });
    expect(server.activeMatch!.goals).toHaveLength(1);
    expect(toast.error).toHaveBeenCalledWith("Action unconfirmed. Refreshing the latest state.");
    const first = server.activeMatch!.goals[0];
    loseResponse = false;
    vi.setSystemTime(Date.now() + 60_000);
    await act(async () => {
      expect(
        await h.result.current.dispatch("add-goal", { team: "my-team", scorer: "Alice" }, target),
      ).toBe(true);
    });
    expect(server.activeMatch!.goals).toHaveLength(2);
    const second = server.activeMatch!.goals[1];
    expect(second.id).not.toBe(first.id);
    expect(second.timestamp).toBe(first.timestamp + 60_000);
    expect(vi.mocked(postCommand).mock.calls[0][1]).toEqual(
      vi.mocked(postCommand).mock.calls[1][1],
    );
    await act(async () => {
      expect(await h.result.current.dispatch("delete-goal", { goalId: second.id }, target)).toBe(
        true,
      );
    });
    expect(server.activeMatch!.goals).toEqual([first]);
    vi.mocked(toast.error).mockClear();
    await act(async () => {
      expect(await h.result.current.dispatch("delete-goal", { goalId: second.id }, target)).toBe(
        true,
      );
    });
    expect(server.activeMatch!.goals).toEqual([first]);
    expect(toast.error).not.toHaveBeenCalled();
  });
  it("keeps the manual refresh cooldown while returning to the app still refreshes immediately", async () => {
    const h = mount();
    await flush();
    await act(async () => {
      await h.result.current.syncNow();
    });
    expect(h.result.current.isCoolingDown).toBe(true);
    await act(async () => {
      await h.result.current.syncNow();
    });
    expect(fetchRemoteState).toHaveBeenCalledTimes(2);
    act(() => window.dispatchEvent(new Event("focus")));
    await flush();
    expect(fetchRemoteState).toHaveBeenCalledTimes(3);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(h.result.current.isCoolingDown).toBe(false);
    await act(async () => {
      await h.result.current.syncNow();
    });
    expect(fetchRemoteState).toHaveBeenCalledTimes(4);
    h.rerender({ token: "different-editor" });
    await flush();
    expect(h.result.current.isCoolingDown).toBe(false);
    expect(postCommand).not.toHaveBeenCalled();
  });
  it("refreshes immediately on opening and confirms editor sync with the familiar toast", async () => {
    const d = deferred();
    vi.mocked(fetchRemoteState).mockReturnValue(d.promise);
    const h = mount();
    expect(fetchRemoteState).toHaveBeenCalledOnce();
    expect(toast.success).not.toHaveBeenCalled();
    expect(h.result.current.isCredentialConfirmed).toBe(false);
    d.resolve(full());
    await flush();
    expect(h.onFull).toHaveBeenCalledOnce();
    expect(h.result.current.isCredentialConfirmed).toBe(true);
    expect(toast.success).toHaveBeenCalledExactlyOnceWith("Goals Synced", { duration: 2000 });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });
    expect(fetchRemoteState).toHaveBeenCalledTimes(2);
    expect(toast.success).toHaveBeenCalledOnce();
  });
  it.each(["focus", "pageshow"])(
    "refreshes editors immediately on %s without waiting for polling",
    async (event) => {
      const h = mount();
      await flush();
      vi.mocked(toast.success).mockClear();
      vi.mocked(fetchRemoteState).mockResolvedValue(full(2));
      act(() => window.dispatchEvent(new Event(event)));
      await flush();
      expect(fetchRemoteState).toHaveBeenCalledTimes(2);
      expect(h.result.current.metadata.fullRevision).toBe(2);
      expect(toast.success).toHaveBeenCalledExactlyOnceWith("Goals Synced", { duration: 2000 });
    },
  );
  it("coalesces editor return events into one full read and one success toast", async () => {
    mount();
    await flush();
    vi.mocked(toast.success).mockClear();
    const d = deferred();
    vi.mocked(fetchRemoteState).mockReturnValue(d.promise);
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("focus"));
      window.dispatchEvent(new Event("pageshow"));
    });
    expect(fetchRemoteState).toHaveBeenCalledTimes(2);
    expect(toast.success).not.toHaveBeenCalled();
    d.resolve(full(2));
    await flush();
    expect(toast.success).toHaveBeenCalledOnce();
  });
  it("announces an existing polling read when an editor returns during it", async () => {
    mount();
    await flush();
    vi.mocked(toast.success).mockClear();
    const d = deferred();
    vi.mocked(fetchRemoteState).mockReturnValue(d.promise);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });
    act(() => window.dispatchEvent(new Event("focus")));
    expect(fetchRemoteState).toHaveBeenCalledTimes(2);
    d.resolve(full(2));
    await flush();
    expect(toast.success).toHaveBeenCalledOnce();
  });
  it("removes editor return listeners on unmount", async () => {
    const h = mount();
    await flush();
    h.unmount();
    act(() => {
      window.dispatchEvent(new Event("focus"));
      window.dispatchEvent(new Event("pageshow"));
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await flush();
    expect(fetchRemoteState).toHaveBeenCalledOnce();
  });
  it("keeps viewer focus and page restoration on the existing polling schedule without editor toasts", async () => {
    vi.mocked(fetchRemoteState).mockResolvedValue({ ...full(), role: "viewer" });
    mount("viewer");
    await flush();
    act(() => {
      window.dispatchEvent(new Event("focus"));
      window.dispatchEvent(new Event("pageshow"));
    });
    await flush();
    expect(fetchRemoteState).toHaveBeenCalledOnce();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });
    expect(fetchRemoteState).toHaveBeenCalledTimes(2);
    expect(toast.success).not.toHaveBeenCalled();
  });
  it("does not announce a failed editor opening refresh", async () => {
    vi.mocked(fetchRemoteState).mockRejectedValue(new Error("offline"));
    mount();
    await flush();
    expect(toast.success).not.toHaveBeenCalled();
  });
  it("does not announce a late opening response from previous credentials", async () => {
    const d = deferred();
    vi.mocked(fetchRemoteState)
      .mockReturnValueOnce(d.promise)
      .mockResolvedValue({ ...full(2), role: "viewer" });
    const h = mount();
    h.rerender({ token: "viewer" });
    await flush();
    d.resolve(full(3));
    await flush();
    expect(toast.success).not.toHaveBeenCalled();
  });
  it("never refreshes a hidden editor from window focus or page restoration", async () => {
    mount();
    await flush();
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("focus"));
      window.dispatchEvent(new Event("pageshow"));
    });
    await flush();
    expect(fetchRemoteState).toHaveBeenCalledOnce();
  });
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
    const before = h.result.current.metadata.fullUpdatedAt;
    vi.mocked(postCommand).mockResolvedValue({ ...live(2), commandId: "cmd" });
    await act(async () => {
      await h.result.current.executeCommand({ id: "cmd", type: "pause-match", matchId: "m" });
    });
    expect(h.onFull).toHaveBeenCalledOnce();
    expect(h.onLive).toHaveBeenCalledOnce();
    expect(h.result.current.metadata.fullUpdatedAt).toBe(before);
    expect(readWorkspaceCache()?.metadata.fullRevision).toBe(1);
  });
  it.each([1, 2])(
    "updates the viewer timestamp after a live poll at revision %s without refreshing the full workspace",
    async (revision) => {
      const active = applyWorkspaceCommand(state, {
        id: "start",
        type: "start-match",
        payload: { isHome: true },
      }).state;
      vi.mocked(fetchRemoteState).mockResolvedValue({ ...full(), state: active, role: "viewer" });
      vi.mocked(fetchActiveMatch).mockResolvedValue({
        ...live(revision),
        activeMatch: active.activeMatch,
        role: "viewer",
      });
      const h = mount("viewer");
      await flush();
      const initialTime = h.result.current.lastSyncedAt;
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });
      expect(fetchActiveMatch).toHaveBeenCalledOnce();
      expect(fetchRemoteState).toHaveBeenCalledOnce();
      expect(h.result.current.lastSyncedAt).toBe(initialTime! + 10_000);
      expect(h.result.current.metadata.fullUpdatedAt).toBe(initialTime);
      expect(readWorkspaceCache()?.metadata.fullUpdatedAt).toBe(initialTime);
      expect(h.result.current.metadata.fullRevision).toBe(1);
      expect(h.result.current.metadata.fullStructureRevision).toBe(1);
      const lastSuccess = h.result.current.lastSyncedAt;
      vi.mocked(fetchActiveMatch).mockRejectedValue(new Error("offline"));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });
      expect(h.result.current.lastSyncedAt).toBe(lastSuccess);
    },
  );
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
    vi.mocked(toast.success).mockClear();
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
    const lastSuccess = h.result.current.lastSyncedAt;
    vi.setSystemTime(Date.now() + 1000);
    d.resolve(full(2));
    await act(async () => {
      await read!;
    });
    expect(h.onFull).toHaveBeenCalledOnce();
    expect(h.result.current.metadata.liveRevision).toBe(3);
    expect(h.result.current.lastSyncedAt).toBe(lastSuccess);
    expect(toast.success).not.toHaveBeenCalled();
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
    expect(toast.error).toHaveBeenCalledOnce();
    expect(toast.error).toHaveBeenCalledWith("Action unconfirmed. Refreshing the latest state.");
    await act(async () => {
      await h.result.current.syncNow();
    });
    expect(postCommand).toHaveBeenCalledTimes(2);
    expect(toast.error).toHaveBeenCalledOnce();
  });
  it("queues rapid actions in submission order without refusing a second tap", async () => {
    const h = mount();
    await flush();
    const firstResponse = deferred();
    const secondResponse = deferred();
    vi.mocked(postCommand)
      .mockReturnValueOnce(firstResponse.promise)
      .mockReturnValueOnce(secondResponse.promise)
      .mockResolvedValueOnce({ ...live(4), commandId: "three" });
    let first: Promise<boolean>, second: Promise<boolean>, third: Promise<boolean>;
    await act(async () => {
      first = h.result.current.executeCommand({
        id: "one",
        type: "pause-match",
        matchId: "m",
        occurredAt: 1000,
      });
      second = h.result.current.executeCommand({
        id: "two",
        type: "add-goal",
        matchId: "m",
        occurredAt: 1001,
      });
      third = h.result.current.executeCommand({
        id: "three",
        type: "add-event",
        matchId: "m",
        occurredAt: 1002,
      });
    });
    expect(postCommand).toHaveBeenCalledTimes(1);
    firstResponse.resolve({ ...live(2), commandId: "one" });
    await act(async () => {
      expect(await first!).toBe(true);
    });
    expect(postCommand).toHaveBeenCalledTimes(2);
    secondResponse.resolve({ ...live(3), commandId: "two" });
    await act(async () => {
      expect(await second!).toBe(true);
      expect(await third!).toBe(true);
    });
    expect(vi.mocked(postCommand).mock.calls.map(([, command]) => command.id)).toEqual([
      "one",
      "two",
      "three",
    ]);
    expect(vi.mocked(postCommand).mock.calls.map(([, command]) => command.occurredAt)).toEqual([
      1000, 1001, 1002,
    ]);
    expect(toast.error).not.toHaveBeenCalled();
  });
  it("continues queued actions after an earlier command is rejected and refetches", async () => {
    const h = mount();
    await flush();
    vi.mocked(postCommand)
      .mockRejectedValueOnce(Object.assign(new Error("Already paused"), { status: 409 }))
      .mockResolvedValueOnce({ ...live(2), commandId: "goal" });
    await act(async () => {
      const pause = h.result.current.executeCommand({
        id: "pause",
        type: "pause-match",
        matchId: "m",
      });
      const goal = h.result.current.executeCommand({ id: "goal", type: "add-goal", matchId: "m" });
      expect(await pause).toBe(false);
      expect(await goal).toBe(true);
    });
    expect(vi.mocked(postCommand).mock.calls.map(([, command]) => command.id)).toEqual([
      "pause",
      "goal",
    ]);
    expect(fetchRemoteState).toHaveBeenCalledTimes(2);
  });
  it("finishes a transport retry before the next action and reconciles a lost response", async () => {
    const h = mount();
    await flush();
    vi.mocked(postCommand)
      .mockRejectedValueOnce(new TypeError("response lost"))
      .mockRejectedValueOnce(new TypeError("response lost again"))
      .mockResolvedValueOnce({ ...live(3), commandId: "second" });
    const first = {
      id: "first",
      type: "add-goal" as const,
      matchId: "m",
      occurredAt: 1000,
      occurredTime: "13:00",
    };
    await act(async () => {
      const a = h.result.current.executeCommand(first);
      const b = h.result.current.executeCommand({ ...first, id: "second", occurredAt: 2000 });
      expect(await a).toBe(false);
      expect(await b).toBe(true);
    });
    expect(vi.mocked(postCommand).mock.calls.map(([, command]) => command.id)).toEqual([
      "first",
      "first",
      "second",
    ]);
    expect(vi.mocked(postCommand).mock.calls[0][1]).toEqual(
      vi.mocked(postCommand).mock.calls[1][1],
    );
    expect(fetchRemoteState).toHaveBeenCalledTimes(2);
  });
  it("releases the queue after two ten-second timeouts through the real command transport", async () => {
    const actual = await vi.importActual<typeof import("../lib/sync")>("../lib/sync");
    vi.mocked(postCommand).mockImplementation(actual.postCommand);
    const timeout = vi.spyOn(AbortSignal, "timeout").mockImplementation((ms) => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(new DOMException("Timed out", "TimeoutError")), ms);
      return controller.signal;
    });
    const attempts: { command: any; signal: AbortSignal }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((_url, options) => {
        const command = JSON.parse(options.body);
        attempts.push({ command, signal: options.signal });
        if (command.id === "first")
          return new Promise((_resolve, reject) => {
            options.signal?.addEventListener("abort", () => reject(options.signal.reason), {
              once: true,
            });
          });
        return Promise.resolve(
          new Response(JSON.stringify({ ...live(3), commandId: command.id }), {
            headers: { "X-Workspace-Role": "editor" },
          }),
        );
      }),
    );
    const h = mount();
    await flush();
    let first: Promise<boolean>, next: Promise<boolean>;
    await act(async () => {
      first = h.result.current.executeCommand({
        id: "first",
        type: "add-goal",
        matchId: "m",
        occurredAt: 1000,
        occurredTime: "13:00",
      });
      next = h.result.current.executeCommand({
        id: "next",
        type: "add-goal",
        matchId: "m",
        occurredAt: 2000,
        occurredTime: "13:01",
      });
    });
    expect(timeout).toHaveBeenCalledWith(10_000);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(9999);
    });
    expect(attempts).toHaveLength(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(attempts).toHaveLength(2);
    expect(attempts[0].signal.aborted).toBe(true);
    expect(attempts[1].signal.aborted).toBe(false);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
      expect(await first!).toBe(false);
      expect(await next!).toBe(true);
    });
    expect(attempts.map(({ command }) => command.id)).toEqual(["first", "first", "next"]);
    expect(attempts[0].command).toEqual(attempts[1].command);
    expect(attempts[0].signal).not.toBe(attempts[1].signal);
    expect(toast.error).toHaveBeenCalledWith("Action unconfirmed. Refreshing the latest state.");
    expect(fetchRemoteState).toHaveBeenCalledTimes(2);
  });
  it("does not send queued actions after credentials are revoked", async () => {
    const h = mount();
    await flush();
    vi.mocked(postCommand).mockRejectedValue(Object.assign(new Error("revoked"), { status: 403 }));
    vi.mocked(fetchRemoteState).mockRejectedValue(
      Object.assign(new Error("revoked"), { status: 401 }),
    );
    await act(async () => {
      const a = h.result.current.executeCommand({ id: "first", type: "add-goal", matchId: "m" });
      const b = h.result.current.executeCommand({ id: "second", type: "add-goal", matchId: "m" });
      expect(await a).toBe(false);
      expect(await b).toBe(false);
    });
    expect(postCommand).toHaveBeenCalledOnce();
    expect(h.result.current.isCredentialConfirmed).toBe(false);
  });
  it("discards the in-memory queue when the app unmounts", async () => {
    const h = mount();
    await flush();
    const response = deferred();
    vi.mocked(postCommand).mockReturnValue(response.promise);
    let a: Promise<boolean>, b: Promise<boolean>;
    await act(async () => {
      a = h.result.current.executeCommand({ id: "first", type: "add-goal", matchId: "m" });
      b = h.result.current.executeCommand({ id: "second", type: "add-goal", matchId: "m" });
    });
    h.unmount();
    response.resolve({ ...live(2), commandId: "first" });
    expect(await a!).toBe(false);
    expect(await b!).toBe(false);
    expect(postCommand).toHaveBeenCalledOnce();
  });
  it("accepts background submissions before the response without optimistic state", async () => {
    const h = mount();
    await flush();
    const response = deferred();
    vi.mocked(postCommand).mockReturnValue(response.promise);
    await act(async () => {
      expect(
        await h.result.current.submitCommand({ id: "goal", type: "add-goal", matchId: "m" }),
      ).toBe(true);
    });
    expect(h.onLive).not.toHaveBeenCalled();
    response.resolve({ ...live(2), commandId: "goal" });
    await flush();
    expect(h.onLive).toHaveBeenCalledOnce();
  });
  it("keeps backup replacement awaiting confirmation", async () => {
    const h = mount();
    await flush();
    const response = deferred();
    vi.mocked(postCommand).mockReturnValue(response.promise);
    let done = false;
    let submission: Promise<boolean>;
    await act(async () => {
      submission = h.result.current
        .submitCommand({ id: "import", type: "import-backup" })
        .then((result) => {
          done = true;
          return result;
        });
    });
    expect(done).toBe(false);
    response.resolve({ ...full(2), commandId: "import" });
    await act(async () => {
      expect(await submission!).toBe(true);
    });
  });
  it("cancels queued commands across credential changes without holding up the new workspace", async () => {
    const h = mount();
    await flush();
    const response = deferred();
    vi.mocked(postCommand)
      .mockReturnValueOnce(response.promise)
      .mockResolvedValue({ ...live(4), commandId: "new" });
    let old: Promise<boolean>, queued: Promise<boolean>;
    await act(async () => {
      old = h.result.current.executeCommand({ id: "old", type: "pause-match", matchId: "m" });
      queued = h.result.current.executeCommand({ id: "queued", type: "add-goal", matchId: "m" });
    });
    h.rerender({ token: "new-editor" });
    await flush();
    await act(async () => {
      expect(
        await h.result.current.executeCommand({ id: "new", type: "add-goal", matchId: "m" }),
      ).toBe(true);
    });
    response.resolve({ ...live(8), commandId: "old" });
    await act(async () => {
      expect(await old!).toBe(false);
      expect(await queued!).toBe(false);
    });
    expect(
      vi.mocked(postCommand).mock.calls.map(([token, command]) => [token, command.id]),
    ).toEqual([
      ["editor", "old"],
      ["new-editor", "new"],
    ]);
    expect(h.result.current.metadata.liveRevision).toBe(4);
  });
  it("blocks offline/viewer editing; local mode sends no requests", async () => {
    vi.mocked(fetchRemoteState).mockResolvedValue({ ...full(), role: "viewer" });
    const h = mount();
    await flush();
    expect(await h.result.current.executeCommand({ id: "cmd", type: "pause-match" })).toBe(false);
    expect(await h.result.current.submitCommand({ id: "cmd", type: "pause-match" })).toBe(false);
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
  it("late commands from prior credentials cannot apply to the current workspace", async () => {
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
    expect(toast.error).not.toHaveBeenCalled();
    expect(h.result.current.role).toBe("editor");
    expect(h.result.current.isCredentialConfirmed).toBe(true);
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
