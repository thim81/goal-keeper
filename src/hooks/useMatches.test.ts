// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMatches } from "./useMatches";
import { createEmptyWorkspace } from "@/lib/workspace";
import { applyWorkspaceCommand } from "@/lib/workspace-mutations";
import { emptyMetadata, saveWorkspaceCache } from "@/lib/workspace-cache";

function workspaceWithMatch(completed = false) {
  let state = applyWorkspaceCommand(
    createEmptyWorkspace(1),
    {
      id: "start",
      type: "start-match",
      payload: { myTeamName: "My Team", opponentName: "Rivals", isHome: true },
    },
    1,
  ).state;
  const matchId = state.activeMatch!.id;
  state = applyWorkspaceCommand(
    state,
    {
      id: "ours",
      type: "add-goal",
      matchId,
      payload: { team: "my-team", scorer: "Alice" },
    },
    2,
  ).state;
  state = applyWorkspaceCommand(
    state,
    {
      id: "theirs",
      type: "add-goal",
      matchId,
      payload: { team: "opponent" },
    },
    3,
  ).state;
  state = applyWorkspaceCommand(
    state,
    {
      id: "own",
      type: "add-goal",
      matchId,
      payload: { team: "my-team", type: "own-goal" },
    },
    4,
  ).state;
  return completed
    ? applyWorkspaceCommand(state, { id: "end", type: "end-match", matchId }, 5).state
    : state;
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("saved workspace initialization", () => {
  it("validates parsed legacy data and keeps a recovery copy before replacing it", () => {
    localStorage.setItem("football-tracker-active-match", JSON.stringify({ goals: null }));
    const { result } = renderHook(() => useMatches());
    expect(result.current.activeMatch).toBeNull();
    expect(() => result.current.getScore()).not.toThrow();
    expect(
      JSON.parse(localStorage.getItem("football-tracker-legacy-recovery")!)[
        "football-tracker-active-match"
      ],
    ).toBe(JSON.stringify({ goals: null }));
  });

  it("does not remove a saved active match while initializing", () => {
    const match = workspaceWithMatch().activeMatch!;
    localStorage.setItem("football-tracker-active-match", JSON.stringify(match));
    const remove = vi.spyOn(Storage.prototype, "removeItem");
    const { result } = renderHook(() => useMatches());
    expect(remove).not.toHaveBeenCalledWith("football-tracker-active-match");
    expect(result.current.activeMatch).toEqual(match);
    expect(JSON.parse(localStorage.getItem("football-tracker-active-match")!)).toEqual(match);
  });

  it("preserves the legacy recovery before hook persistence overwrites corrupt saved state", () => {
    localStorage.setItem("football-tracker-seasons", "{broken");
    renderHook(() => useMatches());
    expect(
      JSON.parse(localStorage.getItem("football-tracker-legacy-recovery")!)[
        "football-tracker-seasons"
      ],
    ).toBe("{broken");
  });

  it("recovers from corrupt local match storage", () => {
    localStorage.setItem("football-tracker-seasons", "{broken");
    expect(() => renderHook(() => useMatches())).not.toThrow();
  });

  it("keeps legacy matches readable when period timing fields are missing", () => {
    const legacyMatch = {
      id: "legacy",
      myTeamName: "My Team",
      opponentName: "Opponent",
      isHome: true,
      goals: [],
      events: [
        {
          id: "start",
          type: "start",
          label: "Start Period 1",
          time: "12:00",
          timestamp: 1_000_000,
        },
      ],
      startedAt: 1_000_000,
      isActive: true,
      isRunning: true,
      totalPausedTime: 0,
      currentPeriod: 1,
    };
    localStorage.setItem("football-tracker-active-match", JSON.stringify(legacyMatch));
    const { result } = renderHook(() => useMatches());
    expect(result.current.activeMatch).toMatchObject({ id: "legacy", currentPeriod: 1 });
    expect(result.current.activeMatch).not.toHaveProperty("periodStartedAt");
    expect(result.current.activeMatch?.periodPausedTime).toBe(0);
  });

  it("restores cached history alongside newer live state without losing either on startup", () => {
    const state = workspaceWithMatch(true);
    state.activeMatch = { ...workspaceWithMatch().activeMatch!, id: "new-live-match" };
    saveWorkspaceCache({
      state,
      credential: "editor",
      workspaceId: "w",
      role: "editor",
      metadata: { ...emptyMetadata(), liveRevision: 3, fullRevision: 2 },
    });
    const { result } = renderHook(() => useMatches());
    expect(result.current.activeMatch).toEqual(state.activeMatch);
    expect(result.current.matchHistory).toEqual(state.matches);
    expect(
      result.current.getSeasonMatchDetails(state.activeSeasonId!, state.matches[0].id),
    ).toEqual(state.fullMatches[state.matches[0].id]);
    expect(JSON.parse(localStorage.getItem("football-tracker-full-matches")!)).toEqual(
      state.fullMatches,
    );
  });
});

describe("useMatches state ownership", () => {
  it("applies complete snapshots, persists history, and reconstructs them on reload", () => {
    const snapshot = workspaceWithMatch(true);
    const { result, unmount } = renderHook(() => useMatches());
    act(() => result.current.setAllMatchesState(snapshot));
    expect(result.current.activeMatch).toBeNull();
    expect(result.current.matchHistory).toEqual(snapshot.matches);
    expect(JSON.parse(localStorage.getItem("football-tracker-seasons")!)).toEqual(snapshot.seasons);
    expect(JSON.parse(localStorage.getItem("football-tracker-matches")!)).toEqual(snapshot.matches);
    expect(JSON.parse(localStorage.getItem("football-tracker-full-matches")!)).toEqual(
      snapshot.fullMatches,
    );
    unmount();
    const reloaded = renderHook(() => useMatches());
    expect(reloaded.result.current.seasons).toEqual(snapshot.seasons);
    expect(reloaded.result.current.activeSeasonId).toBe(snapshot.activeSeasonId);
    expect(reloaded.result.current.matchHistory).toEqual(snapshot.matches);
  });

  it("applies live state while preserving history and calculating own-goal scores", () => {
    const snapshot = workspaceWithMatch(true);
    const { result } = renderHook(() => useMatches());
    act(() => result.current.setAllMatchesState(snapshot));
    const liveMatch = { ...workspaceWithMatch().activeMatch!, id: "new-live-match" };
    act(() => result.current.setActiveMatchState(liveMatch));
    expect(result.current.getScore()).toEqual({ myTeam: 1, opponent: 2 });
    expect(result.current.matchHistory).toEqual(snapshot.matches);
    expect(result.current.canCloseSeason).toBe(false);
    expect(result.current.canReopenSeason).toBe(false);
    expect(JSON.parse(localStorage.getItem("football-tracker-active-match")!)).toEqual(liveMatch);
  });

  it("reads history and stats by season and lists the active season first", () => {
    const snapshot = workspaceWithMatch(true);
    const historyId = snapshot.activeSeasonId!;
    snapshot.seasons![historyId] = {
      ...snapshot.seasons![historyId],
      status: "closed",
      closedAt: 6,
      startAt: 999,
    };
    snapshot.seasons!.active = {
      id: "active",
      name: "Current",
      startAt: 1,
      status: "active",
      matches: [],
      fullMatches: {},
    };
    snapshot.activeSeasonId = "active";
    snapshot.matches = [];
    snapshot.fullMatches = {};
    const { result } = renderHook(() => useMatches());
    act(() => result.current.setAllMatchesState(snapshot));
    expect(result.current.getSeasonSummaries().map((season) => season.id)).toEqual([
      "active",
      historyId,
    ]);
    expect(result.current.getSeasonMatchHistory(historyId)).toHaveLength(1);
    expect(result.current.getSeasonMatchHistory("missing")).toEqual([]);
    expect(result.current.getSeasonMatchDetails(historyId, "start:match")).toMatchObject({
      opponentName: "Rivals",
    });
    expect(result.current.getSeasonMatchDetails(historyId, "missing")).toBeNull();
    expect(result.current.getSeasonStatsById(historyId)).toMatchObject({
      losses: 1,
      goalsFor: 1,
      goalsAgainst: 2,
    });
    expect(result.current.getSeasonStatsById("missing")).toBeNull();
    expect(result.current.canCloseSeason).toBe(true);
    expect(result.current.canReopenSeason).toBe(true);
  });

  it("keeps state updates usable when browser persistence is unavailable", () => {
    const snapshot = workspaceWithMatch(true);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw Error("storage unavailable");
    });
    const { result } = renderHook(() => useMatches());
    act(() => result.current.setAllMatchesState(snapshot));
    expect(result.current.seasons).toEqual(snapshot.seasons);
    expect(result.current.matchHistory).toEqual(snapshot.matches);
  });
});
