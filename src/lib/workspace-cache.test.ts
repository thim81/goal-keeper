import { beforeEach, describe, it, expect, vi, afterEach } from "vitest";
import {
  CACHE_KEY,
  RECOVERY_KEY,
  readWorkspaceCache,
  saveWorkspaceCache,
  assembleWorkspace,
  emptyMetadata,
  preserveLegacyCache,
} from "./workspace-cache";
import { createEmptyWorkspace } from "./workspace";
import { applyWorkspaceCommand } from "./workspace-mutations";
beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());
describe("complete workspace cache", () => {
  it("retains history with partial live revision metadata across reload", () => {
    const state = createEmptyWorkspace();
    const metadata = {
      ...emptyMetadata(),
      liveRevision: 4,
      fullRevision: 2,
      fullStructureRevision: 1,
      observedStructureRevision: 3,
      fullUpdatedAt: 100,
    };
    saveWorkspaceCache({ credential: "token", role: "editor", workspaceId: "w", state, metadata });
    expect(readWorkspaceCache()).toEqual({
      credential: "token",
      role: "editor",
      workspaceId: "w",
      state,
      metadata,
    });
  });
  it("preserves raw legacy data once before replacing cache", () => {
    localStorage.setItem("football-tracker-active-match", "old-value");
    preserveLegacyCache();
    localStorage.setItem("football-tracker-active-match", "new-value");
    preserveLegacyCache();
    expect(JSON.parse(localStorage.getItem(RECOVERY_KEY)!)["football-tracker-active-match"]).toBe(
      "old-value",
    );
  });
  it.each([
    "{broken",
    "null",
    JSON.stringify({ credential: 5 }),
    JSON.stringify({
      credential: "t",
      workspaceId: "w",
      role: "viewer",
      metadata: { liveRevision: "1" },
    }),
  ])("ignores corrupt cache %s", (value) => {
    localStorage.setItem(CACHE_KEY, value);
    expect(readWorkspaceCache()).toBeNull();
  });
  it("tolerates unavailable browser storage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw Error("blocked");
    });
    expect(readWorkspaceCache()).toBeNull();
    expect(preserveLegacyCache).not.toThrow();
    expect(() =>
      saveWorkspaceCache({
        credential: "",
        workspaceId: "local",
        role: "editor",
        state: createEmptyWorkspace(),
        metadata: emptyMetadata(),
      }),
    ).not.toThrow();
  });
  it("assembles active-season history and strips device preferences", () => {
    const state = createEmptyWorkspace();
    const result = assembleWorkspace(state.seasons, state.activeSeasonId, state.activeMatch, {
      ...state.settings,
      theme: "dark",
      syncToken: "secret",
    });
    expect(result).toEqual(state);
    expect(result.settings).not.toHaveProperty("syncToken");
  });
  it("assembles validated history without reading its match records again", () => {
    const started = applyWorkspaceCommand(createEmptyWorkspace(), {
      id: "start",
      type: "start-match",
      payload: { isHome: true },
    }).state;
    const matchId = started.activeMatch!.id;
    const state = applyWorkspaceCommand(started, {
      id: "end",
      type: "end-match",
      matchId,
    }).state;
    const season = state.seasons![state.activeSeasonId!];
    const archivedMatch = season.fullMatches[matchId];
    const readMatch = vi.fn(() => archivedMatch);
    Object.defineProperty(season.fullMatches, matchId, { enumerable: true, get: readMatch });

    const assembled = assembleWorkspace(state.seasons, state.activeSeasonId!, null, state.settings);

    expect(assembled.fullMatches).toBe(season.fullMatches);
    expect(assembled.matches).toBe(season.matches);
    expect(readMatch).not.toHaveBeenCalled();
  });
});
