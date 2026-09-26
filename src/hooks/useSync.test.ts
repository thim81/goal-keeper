// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSync } from "./useSync";
import type { SyncState } from "@/lib/sync";

const remoteState: SyncState = {
  matches: [],
  activeMatch: null,
  fullMatches: {},
  activeSeasonId: "season-1",
  seasons: {},
  settings: {
    teamName: "My Team",
    players: [],
    periodsCount: 4,
    periodDuration: 20,
    debug: false,
    calendarUrl: "",
    calendarTeamName: "",
  },
};

const remoteResponse = (role: "editor" | "viewer" = "editor") =>
  new Response(JSON.stringify(remoteState), { headers: { "X-Workspace-Role": role } });

const settings = {
  teamName: "My Team",
  calendarUrl: "",
  calendarTeamName: "",
  players: [],
  periodsCount: 4,
  periodDuration: 20,
  syncToken: "token",
  theme: "system" as const,
  debug: false,
};

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
  },
}));

describe("useSync manual refresh", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("pulls remote state and reuses the existing success toast", async () => {
    const fetchMock = vi.fn().mockImplementation(() => remoteResponse());
    vi.stubGlobal("fetch", fetchMock);
    const onSyncState = vi.fn();

    const { result } = renderHook(() =>
      useSync("token", {}, "season-1", null, settings, onSyncState),
    );
    await waitFor(() => expect(result.current.status).toBe("editor"));

    await act(async () => {
      await result.current.syncNow();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onSyncState).toHaveBeenLastCalledWith(remoteState);
    const { toast } = await import("sonner");
    expect(toast.success).toHaveBeenLastCalledWith("Goals Synced", { duration: 2000 });
  });

  it("ignores a second request in flight and during the three-second cooldown", async () => {
    vi.useFakeTimers();
    let resolveManual: (response: Response) => void = () => undefined;
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => remoteResponse())
      .mockImplementationOnce(() => new Promise<Response>((resolve) => (resolveManual = resolve)))
      .mockImplementation(() => remoteResponse());
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useSync("token", {}, "season-1", null, settings, vi.fn()));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.status).toBe("editor");

    await act(async () => {
      const firstRequest = result.current.syncNow();
      result.current.syncNow();
      await Promise.resolve();
      void firstRequest;
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.isSyncing).toBe(true);

    await act(async () => {
      resolveManual(
        new Response(JSON.stringify(remoteState), { headers: { "X-Workspace-Role": "editor" } }),
      );
      await Promise.resolve();
    });
    expect(result.current.isSyncing).toBe(false);

    act(() => {
      result.current.syncNow();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      vi.setSystemTime(Date.now() + 3000);
      await result.current.syncNow();
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("never uploads when the server confirms viewer access", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockImplementation(() => remoteResponse("viewer"));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useSync("token", {}, "season-1", null, settings, vi.fn()));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.status).toBe("viewer");
    await act(async () => vi.advanceTimersByTimeAsync(2000));
    expect(fetchMock.mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
  });

  it("polls visible viewers every ten seconds during a match and pauses while hidden", async () => {
    vi.useFakeTimers();
    let visibility: DocumentVisibilityState = "visible";
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
    const fetchMock = vi.fn().mockImplementation(() => remoteResponse("viewer"));
    vi.stubGlobal("fetch", fetchMock);
    const activeMatch = { id: "live-match" } as NonNullable<SyncState["activeMatch"]>;
    const { result } = renderHook(() =>
      useSync("token", {}, "season-1", activeMatch, settings, vi.fn()),
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.status).toBe("viewer");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => vi.advanceTimersByTimeAsync(9999));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(fetchMock).toHaveBeenCalledTimes(2);

    visibility = "hidden";
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    await act(async () => vi.advanceTimersByTimeAsync(30_000));
    expect(fetchMock).toHaveBeenCalledTimes(2);

    visibility = "visible";
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("clears stale local matches when a valid viewer credential reads an empty workspace", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(null, { status: 204, headers: { "X-Workspace-Role": "viewer" } }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const onSyncState = vi.fn();
    const { result } = renderHook(() =>
      useSync("token", {}, "season-1", null, settings, onSyncState),
    );
    await waitFor(() => expect(result.current.status).toBe("viewer"));
    expect(onSyncState).toHaveBeenCalledWith(
      expect.objectContaining({ matches: [], fullMatches: {}, seasons: {}, activeMatch: null }),
    );
    expect(fetchMock.mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
  });

  it("keeps editor controls checking until an empty workspace seed succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, { status: 204, headers: { "X-Workspace-Role": "editor" } }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(
        new Response(null, { status: 204, headers: { "X-Workspace-Role": "editor" } }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useSync("token", {}, "season-1", null, settings, vi.fn()));
    await waitFor(() => expect(result.current.status).toBe("unavailable"));
    await act(async () => result.current.syncNow());
    expect(result.current.status).toBe("editor");
    expect(fetchMock.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(
      2,
    );
  });

  it("does not apply a refresh response over edits made while the request is pending", async () => {
    let resolveRefresh: (response: Response) => void = () => undefined;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(remoteResponse())
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveRefresh = resolve;
          }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const onSyncState = vi.fn();
    const { rerender, result } = renderHook(
      ({ activeMatch }) => useSync("token", {}, "season-1", activeMatch, settings, onSyncState),
      {
        initialProps: { activeMatch: null as SyncState["activeMatch"] },
      },
    );
    await waitFor(() => expect(result.current.status).toBe("editor"));
    const initialPullCount = onSyncState.mock.calls.length;
    let request: Promise<void> = Promise.resolve();
    act(() => {
      request = result.current.syncNow();
    });
    rerender({
      activeMatch: { ...remoteState.activeMatch, id: "new-local-edit" } as NonNullable<
        SyncState["activeMatch"]
      >,
    });
    await act(async () => {
      resolveRefresh(remoteResponse());
      await request;
    });
    expect(onSyncState).toHaveBeenCalledTimes(initialPullCount);
  });

  it("aborts the previous credential request when the token changes", async () => {
    let aborted = false;
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(
        (_url, options) =>
          new Promise((_resolve, reject) => {
            options.signal.addEventListener("abort", () => {
              aborted = true;
              reject(new DOMException("Aborted", "AbortError"));
            });
          }),
      )
      .mockImplementation(() => Promise.resolve(remoteResponse("viewer")));
    vi.stubGlobal("fetch", fetchMock);
    const { rerender, result } = renderHook(
      ({ token }) => useSync(token, {}, "season-1", null, settings, vi.fn()),
      {
        initialProps: { token: "old" },
      },
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    rerender({ token: "new" });
    await waitFor(() => expect(result.current.status).toBe("viewer"));
    expect(aborted).toBe(true);
    expect(fetchMock.mock.calls[1][1].headers["x-auth-token"]).toBe("new");
  });
});
