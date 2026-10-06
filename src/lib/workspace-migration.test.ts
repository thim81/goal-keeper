import { describe, expect, it } from "vitest";
import { createEmptyWorkspace } from "./workspace";
import { parseMigrationState, MAX_STATE_BYTES } from "./workspace-migration";

const historical = {
  id: "old-match",
  myTeamName: "Team",
  opponentName: "Rivals",
  isHome: true,
  goals: [{ id: "old-goal", team: "my-team", type: "normal", time: "13:00", timestamp: 100 }],
  events: [{ id: "old-event", type: "full-time", time: "13:30", timestamp: 200 }],
  startedAt: 100,
  endedAt: 200,
  isActive: false,
};
const summary = {
  id: "old-match",
  myTeamName: "Team",
  opponentName: "Rivals",
  isHome: true,
  myTeamScore: 1,
  opponentScore: 0,
  date: "31 Jan 2026",
  endedAt: 200,
};
const legacy = {
  matches: [summary],
  fullMatches: { "old-match": historical },
  activeMatch: null,
  settings: { teamName: "Team", syncToken: "private", theme: "dark" },
};

describe("legacy KV migration validation", () => {
  it("fills absent timer fields in completed pre-timer matches while preserving their data", () => {
    const raw = JSON.stringify(legacy);
    const state = parseMigrationState(raw);
    const expected = { ...historical, isRunning: false, currentPeriod: 1, totalPausedTime: 0 };
    expect(state.fullMatches[historical.id]).toEqual(expected);
    expect(state.seasons![state.activeSeasonId!].fullMatches[historical.id]).toEqual(expected);
    expect(state.matches).toEqual(legacy.matches);
    expect(state.settings).not.toHaveProperty("syncToken");
    expect(state.settings).not.toHaveProperty("theme");
    expect(JSON.stringify(legacy)).toBe(raw);
  });
  it("normalizes historical matches inside seasons without changing existing timer values", () => {
    const state = createEmptyWorkspace(100);
    const season = state.seasons![state.activeSeasonId!];
    const existing = {
      ...historical,
      id: "newer",
      isRunning: false,
      currentPeriod: 4,
      totalPausedTime: 5000,
    };
    season.matches = [summary];
    season.fullMatches = { old: historical, newer: existing } as any;
    const normalized = parseMigrationState(JSON.stringify(state));
    expect(normalized.seasons![state.activeSeasonId!].fullMatches.old).toMatchObject({
      ...historical,
      isRunning: false,
      totalPausedTime: 0,
      currentPeriod: 1,
    });
    expect(normalized.seasons![state.activeSeasonId!].fullMatches.newer).toEqual(existing);
  });
  it.each([
    { ...legacy, fullMatches: { old: { ...historical, currentPeriod: null } } },
    { ...legacy, fullMatches: { old: { ...historical, isRunning: "no" } } },
    {
      ...legacy,
      fullMatches: { old: { ...historical, goals: [{ ...historical.goals[0], type: "unknown" }] } },
    },
    { ...legacy, activeMatch: { ...historical, isActive: true, endedAt: undefined } },
    { ...legacy, seasons: {} },
    { ...legacy, seasons: { invalid: null } },
    { ...legacy, fullMatches: { old: { ...historical, isActive: true } } },
    {
      ...legacy,
      fullMatches: { old: { ...historical, goals: [{ ...historical.goals[0], type: undefined }] } },
    },
    { ...legacy, fullMatches: [] },
  ])("rejects incompatible data without guessing or discarding records: %#", (input) => {
    expect(() => parseMigrationState(JSON.stringify(input))).toThrow();
  });
  it("rejects multiple active seasons", () => {
    const state = createEmptyWorkspace(100);
    state.seasons!.other = { ...state.seasons![state.activeSeasonId!], id: "other" };
    expect(() => parseMigrationState(JSON.stringify(state))).toThrow("active season");
  });
  it("checks UTF-8 source size before parsing and normalized size before persistence", () => {
    expect(() => parseMigrationState("é".repeat(MAX_STATE_BYTES / 2 + 1))).toThrow("too large");
    const state = createEmptyWorkspace(100);
    state.fullMatches = { old: historical } as any;
    const baseline = JSON.stringify(state);
    state.settings.teamName = "x".repeat(
      MAX_STATE_BYTES - new TextEncoder().encode(baseline).byteLength - 5,
    );
    expect(() => parseMigrationState(JSON.stringify(state))).toThrow("too large");
  });
  it("rejects invalid JSON and missing workspace data", () => {
    for (const raw of ["not-json", "null", "{}", "[]"])
      expect(() => parseMigrationState(raw)).toThrow();
  });
});
