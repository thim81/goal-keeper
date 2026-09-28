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

const remoteResponse = (role: "editor" | "viewer" = "editor", state = remoteState) =>
  new Response(JSON.stringify(state), { headers: { "X-Workspace-Role": role } });

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
const ACCESS_KEY = "football-tracker-workspace-access";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
  },
}));

describe("useSync manual refresh", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    localStorage.clear();
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

  it("does not seed over a stored workspace that the API cannot read", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("Stored workspace is unreadable; existing data was preserved", {
        status: 422,
        headers: { "X-Workspace-Role": "editor" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useSync("token", {}, "season-1", null, settings, vi.fn()));
    await waitFor(() => expect(result.current.status).toBe("unavailable"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
  });

  it("retries a failed dirty editor save before pulling remote state", async () => {
    vi.useFakeTimers();
    const localEdit = { ...remoteState.activeMatch, id: "unsaved-local-edit" } as NonNullable<
      SyncState["activeMatch"]
    >;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(remoteResponse())
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ...remoteState, activeMatch: localEdit }), {
          headers: { "X-Workspace-Role": "editor" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const onSyncState = vi.fn();
    const { rerender, result } = renderHook(
      ({ activeMatch }) => useSync("token", {}, "season-1", activeMatch, settings, onSyncState),
      { initialProps: { activeMatch: null as SyncState["activeMatch"] } },
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.status).toBe("editor");

    rerender({ activeMatch: localEdit });
    await act(async () => result.current.syncNow());
    expect(result.current.status).toBe("unavailable");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
      await result.current.syncNow();
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).activeMatch.id).toBe("unsaved-local-edit");
    expect(JSON.parse(fetchMock.mock.calls[2][1].body).activeMatch.id).toBe("unsaved-local-edit");
    expect(onSyncState).toHaveBeenLastCalledWith(
      expect.objectContaining({ activeMatch: localEdit }),
    );
    expect(result.current.status).toBe("editor");
  });

  it("retries an autosave failure on the next foreground refresh", async () => {
    vi.useFakeTimers();
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    const localEdit = { ...remoteState.activeMatch, id: "unsaved-auto-edit" } as NonNullable<
      SyncState["activeMatch"]
    >;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(remoteResponse())
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ...remoteState, activeMatch: localEdit }), {
          headers: { "X-Workspace-Role": "editor" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const { rerender, result } = renderHook(
      ({ activeMatch }) => useSync("token", {}, "season-1", activeMatch, settings, vi.fn()),
      { initialProps: { activeMatch: null as SyncState["activeMatch"] } },
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.status).toBe("editor");

    rerender({ activeMatch: localEdit });
    await act(async () => vi.advanceTimersByTimeAsync(2000));
    expect(result.current.status).toBe("unavailable");

    act(() => document.dispatchEvent(new Event("visibilitychange")));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(fetchMock.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(
      2,
    );
    expect(JSON.parse(fetchMock.mock.calls[2][1].body).activeMatch.id).toBe("unsaved-auto-edit");
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("keeps a confirmed editor grant after a network write failure", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(remoteResponse())
      .mockResolvedValueOnce(new Response(null, { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    const localEdit = { id: "offline-edit" } as NonNullable<SyncState["activeMatch"]>;
    const { rerender, result } = renderHook(
      ({ match }) => useSync("token", {}, "season-1", match, settings, vi.fn()),
      { initialProps: { match: null as SyncState["activeMatch"] } },
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    rerender({ match: localEdit });
    await act(async () => vi.advanceTimersByTimeAsync(2000));

    expect(result.current.status).toBe("unavailable");
    expect(result.current.role).toBe("editor");
  });

  it("autosaves later editor changes after a transient write failure", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(remoteResponse())
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const { rerender, result } = renderHook(
      ({ match }) => useSync("token", {}, "season-1", match, settings, vi.fn()),
      { initialProps: { match: null as SyncState["activeMatch"] } },
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    rerender({ match: { id: "first-goal" } as NonNullable<SyncState["activeMatch"]> });
    await act(async () => vi.advanceTimersByTimeAsync(2000));
    expect(result.current.status).toBe("unavailable");

    rerender({ match: { id: "second-goal" } as NonNullable<SyncState["activeMatch"]> });
    await act(async () => vi.advanceTimersByTimeAsync(2000));
    const writes = fetchMock.mock.calls.filter(([, options]) => options?.method === "POST");
    expect(writes).toHaveLength(2);
    expect(JSON.parse(writes[1][1].body).activeMatch.id).toBe("second-goal");
  });

  it("restores a confirmed editor role when startup cannot reach the server", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(remoteResponse()));
    const first = renderHook(() => useSync("token", {}, "season-1", null, settings, vi.fn()));
    await waitFor(() => expect(first.result.current.status).toBe("editor"));
    first.unmount();

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    const restored = renderHook(() => useSync("token", {}, "season-1", null, settings, vi.fn()));
    expect(restored.result.current.role).toBe("editor");
    await waitFor(() => expect(restored.result.current.status).toBe("unavailable"));
    expect(JSON.parse(localStorage.getItem(ACCESS_KEY)!).role).toBe("editor");
  });

  it("preserves a saved editor grant while a shared-link token temporarily disables sync", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(remoteResponse()));
    const first = renderHook(() => useSync("token", {}, "season-1", null, settings, vi.fn()));
    await waitFor(() => expect(first.result.current.status).toBe("editor"));
    first.unmount();

    const sharedLink = renderHook(() => useSync(undefined, {}, "season-1", null, settings, vi.fn()));
    expect(sharedLink.result.current.role).toBeNull();
    expect(localStorage.getItem(ACCESS_KEY)).not.toBeNull();
    sharedLink.unmount();

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    const restored = renderHook(() => useSync("token", {}, "season-1", null, settings, vi.fn()));
    expect(restored.result.current.role).toBe("editor");
    await waitFor(() => expect(restored.result.current.status).toBe("unavailable"));
  });

  it("applies a changed remote state when restored local data still matches its baseline", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(remoteResponse()));
    const first = renderHook(() => useSync("token", {}, "season-1", null, settings, vi.fn()));
    await waitFor(() => expect(first.result.current.status).toBe("editor"));
    first.unmount();

    const updated = {
      ...remoteState,
      activeMatch: { id: "remote-update" } as NonNullable<SyncState["activeMatch"]>,
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(remoteResponse("editor", updated)));
    const onSyncState = vi.fn();
    const restored = renderHook(() =>
      useSync("token", {}, "season-1", null, settings, onSyncState),
    );
    await waitFor(() => expect(restored.result.current.status).toBe("editor"));

    expect(onSyncState).toHaveBeenCalledWith(updated);
  });

  it("restores a cached viewer offline without allowing uploads", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(remoteResponse("viewer")));
    const first = renderHook(() => useSync("token", {}, "season-1", null, settings, vi.fn()));
    await waitFor(() => expect(first.result.current.status).toBe("viewer"));
    first.unmount();

    const fetchMock = vi.fn().mockRejectedValue(new TypeError("offline"));
    vi.stubGlobal("fetch", fetchMock);
    const restored = renderHook(() => useSync("token", {}, "season-1", null, settings, vi.fn()));
    expect(restored.result.current.role).toBe("viewer");
    await waitFor(() => expect(restored.result.current.status).toBe("unavailable"));
    await act(async () => restored.result.current.syncNow());

    expect(fetchMock.mock.calls.every(([, options]) => options?.method !== "POST")).toBe(true);
  });

  it("keeps dirty local edits after reload when the confirmed editor GET returns old state", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(remoteResponse()));
    const first = renderHook(() => useSync("token", {}, "season-1", null, settings, vi.fn()));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    first.unmount();

    const localEdit = { id: "offline-edit" } as NonNullable<SyncState["activeMatch"]>;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(remoteResponse())
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const onSyncState = vi.fn();
    const restored = renderHook(() =>
      useSync("token", {}, "season-1", localEdit, settings, onSyncState),
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(restored.result.current.role).toBe("editor");
    expect(onSyncState).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTimeAsync(2000));
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).activeMatch.id).toBe("offline-edit");
  });

  it("clears a saved grant after the same token is rejected with 403", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(remoteResponse())
      .mockResolvedValueOnce(new Response("Forbidden", { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useSync("token", {}, "season-1", null, settings, vi.fn()));
    await waitFor(() => expect(result.current.status).toBe("editor"));
    expect(localStorage.getItem(ACCESS_KEY)).not.toBeNull();

    await act(async () => result.current.syncNow());
    expect(result.current.status).toBe("invalid");
    expect(result.current.role).toBeNull();
    expect(localStorage.getItem(ACCESS_KEY)).toBeNull();
  });

  it("does not upload restored dirty editor data after an unreadable-workspace response", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(remoteResponse()));
    const first = renderHook(() => useSync("token", {}, "season-1", null, settings, vi.fn()));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    first.unmount();

    const localEdit = { id: "preserve-corrupt-store" } as NonNullable<SyncState["activeMatch"]>;
    const unreadable = () => new Response("unreadable", { status: 422 });
    const fetchMock = vi.fn().mockResolvedValue(unreadable());
    vi.stubGlobal("fetch", fetchMock);
    const { rerender, result } = renderHook(({ match }) =>
      useSync("token", {}, "season-1", match, settings, vi.fn()),
      { initialProps: { match: localEdit } },
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.role).toBe("editor");
    rerender({ match: { id: "newer-local-edit" } as NonNullable<SyncState["activeMatch"]> });
    await act(async () => vi.advanceTimersByTimeAsync(2000));
    await act(async () => result.current.syncNow());
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.every(([, options]) => options?.method !== "POST")).toBe(true);
  });

  it("drops the previous role immediately when the token changes", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(remoteResponse("viewer"))
        .mockResolvedValueOnce(new Response("Unauthorized", { status: 401 })),
    );
    const { rerender, result } = renderHook(
      ({ token }) => useSync(token, {}, "season-1", null, settings, vi.fn()),
      { initialProps: { token: "viewer-token" } },
    );
    await waitFor(() => expect(result.current.role).toBe("viewer"));
    rerender({ token: "different-token" });
    expect(result.current.role).toBeNull();
    expect(localStorage.getItem(ACCESS_KEY)).toBeNull();
    await waitFor(() => expect(result.current.status).toBe("invalid"));
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
