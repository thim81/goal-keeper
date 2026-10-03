import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkspaceActions } from "./useWorkspaceActions";
import {
  CACHE_KEY,
  readWorkspaceCache,
  saveWorkspaceCache,
  emptyMetadata,
} from "../lib/workspace-cache";
import { createEmptyWorkspace } from "../lib/workspace";
import type { WorkspaceCommand } from "../lib/workspace";

const state = createEmptyWorkspace(100);

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("useWorkspaceActions", () => {
  it("captures device submission time once and preserves the complete failed command on retry", async () => {
    const clock = vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-04T13:00:00Z"));
    const execute = vi.fn(async (_command: WorkspaceCommand) => false);
    const hook = renderHook(
      ({ failed }) => useWorkspaceActions(state, false, vi.fn(), execute, failed),
      { initialProps: { failed: null as WorkspaceCommand | null } },
    );
    await act(async () => {
      await hook.result.current("add-goal", { team: "my-team" }, { matchId: "match" });
    });
    const original = execute.mock.calls[0][0];
    expect(original).toMatchObject({ occurredAt: Date.parse("2026-10-04T13:00:00Z") });
    hook.rerender({ failed: original });
    clock.mockReturnValue(Date.parse("2026-10-04T13:01:00Z"));
    await act(async () => {
      await hook.result.current("add-goal", { team: "my-team" }, { matchId: "match" });
    });
    expect(execute.mock.calls[1][0]).toEqual(original);
    await act(async () => {
      await hook.result.current("add-goal", { team: "opponent" }, { matchId: "match" });
    });
    expect(execute.mock.calls[2][0]).toMatchObject({
      occurredAt: Date.parse("2026-10-04T13:01:00Z"),
    });
    expect(execute.mock.calls[2][0].id).not.toBe(original.id);
  });
  it("applies local actions and caches without device credentials", async () => {
    const apply = vi.fn();
    const execute = vi.fn(async (_command: WorkspaceCommand) => true);
    const hook = renderHook(() => useWorkspaceActions(state, true, apply, execute, null));

    await act(async () => {
      expect(await hook.result.current("add-player", { player: "Alice" })).toBe(true);
    });

    expect(execute).not.toHaveBeenCalled();
    expect(apply).toHaveBeenCalledOnce();
    expect(apply.mock.calls[0][0].settings.players).toContain("Alice");
    const cache = readWorkspaceCache();
    expect(cache).toMatchObject({ credential: "", workspaceId: "local", role: "editor" });
    expect(cache?.state.settings.players).toContain("Alice");
    expect(localStorage.getItem(CACHE_KEY)).not.toBeNull();
  });

  it("dispatches connected commands without optimistic state or cache writes", async () => {
    const apply = vi.fn();
    const execute = vi.fn(async (_command: WorkspaceCommand) => true);
    saveWorkspaceCache({
      credential: "device",
      workspaceId: "w",
      role: "editor",
      state,
      metadata: emptyMetadata(),
    });
    const before = localStorage.getItem(CACHE_KEY);
    const hook = renderHook(() => useWorkspaceActions(state, false, apply, execute, null));

    await act(async () => {
      expect(await hook.result.current("add-player", { player: "Alice" })).toBe(true);
    });

    expect(execute).toHaveBeenCalledOnce();
    expect(execute.mock.calls[0][0]).toMatchObject({
      type: "add-player",
      payload: { player: "Alice" },
    });
    expect(execute.mock.calls[0][0].id).toBeTruthy();
    expect(apply).not.toHaveBeenCalled();
    expect(localStorage.getItem(CACHE_KEY)).toBe(before);
  });

  it("reuses failed command ID only for same intent", async () => {
    const failed: WorkspaceCommand = {
      id: "retry-id",
      type: "add-player",
      payload: { player: "Alice" },
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
    const execute = vi.fn(async (_command: WorkspaceCommand) => false);
    const hook = renderHook(
      ({ failedCommand }) => useWorkspaceActions(state, false, vi.fn(), execute, failedCommand),
      {
        initialProps: { failedCommand: failed },
      },
    );

    await act(async () => {
      await hook.result.current("add-player", { player: "Alice" });
      await hook.result.current("add-player", { player: "Bob" });
    });

    expect(execute.mock.calls[0][0].id).toBe("retry-id");
    expect(execute.mock.calls[1][0].id).not.toBe("retry-id");
  });

  it("rejects invalid local command without changing state or cache", async () => {
    const apply = vi.fn();
    const execute = vi.fn(async (_command: WorkspaceCommand) => true);
    saveWorkspaceCache({
      credential: "device",
      workspaceId: "w",
      role: "editor",
      state,
      metadata: emptyMetadata(),
    });
    const before = localStorage.getItem(CACHE_KEY);
    const hook = renderHook(() => useWorkspaceActions(state, true, apply, execute, null));

    await act(async () => {
      expect(await hook.result.current("add-goal", { team: "my-team" })).toBe(false);
    });

    expect(apply).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
    expect(readWorkspaceCache()?.state).toEqual(state);
    expect(localStorage.getItem(CACHE_KEY)).toBe(before);
  });
});
