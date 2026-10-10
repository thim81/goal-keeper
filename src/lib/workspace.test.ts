import { describe, expect, it } from "vitest";
import { assertResponse, createEmptyWorkspace, normalizeWorkspace } from "./workspace";

const match = {
  id: "match-1",
  myTeamName: "Team",
  opponentName: "Rivals",
  isHome: true,
  goals: [{ id: "goal-1", team: "my-team", type: "normal", time: "01:00", timestamp: 1 }],
  events: [{ id: "event-1", type: "start", time: "00:00", timestamp: 0 }],
  startedAt: 1,
  isActive: true,
  isRunning: true,
  totalPausedTime: 0,
  currentPeriod: 1,
};

const legacy = {
  matches: [],
  fullMatches: {},
  activeMatch: match,
  settings: { teamName: "Team", theme: "dark", syncToken: "secret", debug: true },
};

describe("workspace normalization", () => {
  it("migrates legacy state while preserving match and event identifiers", () => {
    const state = normalizeWorkspace(legacy);
    expect(state.activeMatch?.goals[0].id).toBe("goal-1");
    expect(state.activeMatch?.events[0].id).toBe("event-1");
    expect(state.settings).not.toHaveProperty("theme");
    expect(state.settings).not.toHaveProperty("syncToken");
    expect(Object.values(state.seasons ?? {})).toHaveLength(1);
  });

  it("fills legacy optional match timer and calendar settings", () => {
    const state = normalizeWorkspace(legacy);
    expect(state.activeMatch?.periodPausedTime).toBe(0);
    expect(state.settings.calendarUrl).toBe("");
    expect(state.settings.calendarTeamName).toBe("");
  });

  it("keeps allowed shared settings and drops unknown credential fields", () => {
    const state = normalizeWorkspace({
      ...legacy,
      settings: { ...legacy.settings, apiKey: "private", cloudToken: "private" },
    });
    expect(state.settings).toMatchObject({ teamName: "Team", debug: true });
    expect(state.settings).not.toHaveProperty("apiKey");
    expect(state.settings).not.toHaveProperty("cloudToken");
  });

  it("rejects malformed goals, events, and season references", () => {
    expect(() =>
      normalizeWorkspace({ ...legacy, activeMatch: { ...match, goals: [null] } }),
    ).toThrow();
    expect(() =>
      normalizeWorkspace({ ...legacy, activeMatch: { ...match, events: [null] } }),
    ).toThrow();
    expect(() =>
      normalizeWorkspace({ ...legacy, activeMatch: { ...match, isRunning: "yes" } }),
    ).toThrow();
    expect(() =>
      normalizeWorkspace({ ...legacy, seasons: {}, activeSeasonId: "missing" }),
    ).toThrow();
    expect(() =>
      normalizeWorkspace({ ...legacy, settings: { ...legacy.settings, debug: "yes" } }),
    ).toThrow();
  });

  it("creates an empty workspace with exactly one active season", () => {
    const state = createEmptyWorkspace();
    expect(
      Object.values(state.seasons ?? {}).filter((season) => season.status === "active"),
    ).toHaveLength(1);
    expect(state.activeSeasonId).toBe(Object.keys(state.seasons ?? {})[0]);
  });
});

describe("workspace responses", () => {
  it("normalizes structural replies at the network boundary", () => {
    const response = assertResponse({
      scope: "structural",
      workspaceId: "w",
      revision: 2,
      structureRevision: 1,
      state: legacy,
    });
    expect(response.scope).toBe("structural");
    if (response.scope !== "structural") throw Error("Expected structural response");
    expect(response.state.activeMatch?.periodPausedTime).toBe(0);
    expect(Object.values(response.state.seasons ?? {})).toHaveLength(1);
    expect(response.state.settings.calendarUrl).toBe("");
    expect(response.state.settings).not.toHaveProperty("theme");
    expect(response.state.settings).not.toHaveProperty("syncToken");
    expect(legacy.activeMatch).not.toHaveProperty("periodPausedTime");
  });

  it("normalizes live replies without needing a full workspace", () => {
    const response = assertResponse({
      scope: "live",
      workspaceId: "w",
      revision: 2,
      structureRevision: 1,
      activeMatch: match,
      activeSeasonId: "season-1",
    });
    expect(response.scope).toBe("live");
    if (response.scope !== "live") throw Error("Expected live response");
    expect(response.activeMatch?.periodPausedTime).toBe(0);
    expect(response.activeMatch?.goals).toEqual(match.goals);
    expect(response).not.toHaveProperty("state");
  });

  it("accepts valid live and structural response envelopes", () => {
    const state = createEmptyWorkspace();
    expect(
      assertResponse({
        scope: "live",
        workspaceId: "w",
        revision: 2,
        structureRevision: 1,
        activeMatch: null,
        activeSeasonId: null,
      }),
    ).toMatchObject({ scope: "live" });
    expect(
      assertResponse({
        scope: "structural",
        workspaceId: "w",
        revision: 2,
        structureRevision: 1,
        state,
      }),
    ).toMatchObject({ scope: "structural" });
  });

  it("rejects invalid revisions and malformed payloads", () => {
    const state = createEmptyWorkspace();
    expect(() =>
      assertResponse({
        scope: "live",
        workspaceId: "w",
        revision: -1,
        structureRevision: 0,
        activeMatch: null,
        activeSeasonId: null,
      }),
    ).toThrow();
    expect(() =>
      assertResponse({
        scope: "live",
        workspaceId: "w",
        revision: 1.2,
        structureRevision: 0,
        activeMatch: null,
        activeSeasonId: null,
      }),
    ).toThrow();
    expect(() =>
      assertResponse({
        scope: "live",
        workspaceId: "w",
        revision: 1,
        structureRevision: 2,
        activeMatch: null,
      }),
    ).toThrow();
    expect(() =>
      assertResponse({
        scope: "structural",
        workspaceId: "w",
        revision: 1,
        structureRevision: 0,
        state: { ...state, matches: null },
      }),
    ).toThrow();
  });
});
