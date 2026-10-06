import { describe, expect, it } from "vitest";
import { createEmptyWorkspace } from "./workspace";
import type { WorkspaceCommand, WorkspaceCommandType } from "./workspace";
import { applyWorkspaceCommand, WorkspaceError } from "./workspace-mutations";

const base = () => createEmptyWorkspace(1_700_000_000_000);
const command = (
  id: string,
  payload: Record<string, unknown> = {},
  extra: Partial<WorkspaceCommand> = {},
): WorkspaceCommand => ({
  id: `cmd-${id}`,
  type: id as WorkspaceCommandType,
  payload,
  ...extra,
});
const live = (state = base()) => {
  const result = applyWorkspaceCommand(
    state,
    command("start-match", {
      myTeamName: "Town",
      opponentName: "City",
      isHome: true,
    } as any),
    1_700_000_000_000,
  );
  return { state: result.state, matchId: result.state.activeMatch!.id };
};

describe("applyWorkspaceCommand live mutations", () => {
  it.each([
    ["add-goal", { team: "my-team" }],
    ["add-event", { eventType: "yellow-card", team: "my-team", player: "Alice" }],
  ])(
    "preserves the device's 13:00 timeline time for %s despite request delay or clock differences",
    (type, payload) => {
      const { state, matchId } = live();
      const occurredAt = Date.parse("2026-10-04T13:00:00Z");
      for (const now of [occurredAt + 5000, occurredAt + 600_000, occurredAt - 120_000]) {
        const result = applyWorkspaceCommand(
          state,
          command(type, payload, {
            matchId,
            timeZone: "UTC",
            occurredAt,
          } as Partial<WorkspaceCommand>),
          now,
        );
        const match = result.state.activeMatch!;
        const item = type === "add-goal" ? match.goals[0] : match.events[match.events.length - 1];
        expect(item).toMatchObject({ timestamp: occurredAt, time: "13:00" });
        expect(result.state.activeMatch!.startedAt).toBe(state.activeMatch!.startedAt);
      }
    },
  );
  it.each([null, "13:00", NaN, Infinity, -1, 8_640_000_000_000_001])(
    "rejects invalid occurredAt %s without mutating state",
    (occurredAt) => {
      const { state, matchId } = live();
      const original = structuredClone(state);
      expect(() =>
        applyWorkspaceCommand(
          state,
          command("add-goal", { team: "my-team" }, {
            matchId,
            occurredAt,
          } as Partial<WorkspaceCommand>),
        ),
      ).toThrow("Invalid occurredAt");
      expect(state).toEqual(original);
    },
  );
  it("preserves client timing throughout match, pause and period actions despite server delay", () => {
    const start = Date.parse("2026-10-04T13:00:00Z");
    let state = base();
    const run = (
      type: WorkspaceCommandType,
      offset: number,
      payload: Record<string, unknown> = {},
    ) => {
      state = applyWorkspaceCommand(
        state,
        command(`${type}-${offset}`, payload, {
          type,
          matchId: state.activeMatch?.id,
          occurredAt: start + offset,
          occurredTime: new Date(start + offset).toISOString().slice(11, 16),
          timeZone: "America/Chicago",
        } as Partial<WorkspaceCommand>),
        start + offset + 600_000,
      ).state;
    };
    run("start-match", 0, { isHome: true });
    const matchId = state.activeMatch!.id;
    expect(state.activeMatch).toMatchObject({ startedAt: start, periodStartedAt: start });
    expect(state.activeMatch!.events[0]).toMatchObject({ timestamp: start, time: "13:00" });
    run("pause-match", 60_000);
    expect(state.activeMatch!.pausedAt).toBe(start + 60_000);
    run("resume-match", 120_000);
    expect(state.activeMatch!.totalPausedTime).toBe(60_000);
    run("end-period", 1_200_000, { expectedPeriod: 1 });
    expect(state.activeMatch!.pausedAt).toBe(start + 1_200_000);
    run("start-period", 1_500_000, { expectedPeriod: 1 });
    expect(state.activeMatch!.periodStartedAt).toBe(start + 1_500_000);
    expect(state.activeMatch!.totalPausedTime).toBe(360_000);
    run("end-match", 2_400_000);
    expect(state.activeMatch).toBeNull();
    expect(state.matches[0].endedAt).toBe(start + 2_400_000);
    expect(state.fullMatches[matchId]).toMatchObject({ endedAt: start + 2_400_000 });
    expect(
      state.fullMatches[matchId].events.map(({ time, timestamp }) => ({ time, timestamp })),
    ).toEqual([
      { time: "13:00", timestamp: start },
      { time: "13:20", timestamp: start + 1_200_000 },
      { time: "13:25", timestamp: start + 1_500_000 },
      { time: "13:40", timestamp: start + 2_400_000 },
    ]);
  });
  it.each(["add-goal", "add-event"] as const)(
    "preserves the client display time for %s",
    (type) => {
      const { state, matchId } = live();
      const result = applyWorkspaceCommand(
        state,
        command(
          type,
          type === "add-goal" ? { team: "my-team" } : { eventType: "yellow-card", team: "my-team" },
          {
            matchId,
            occurredAt: 1000,
            occurredTime: "13:00",
            timeZone: "UTC",
          } as Partial<WorkspaceCommand>,
        ),
        6000,
      ).state;
      const match = result.activeMatch!;
      const item = type === "add-goal" ? match.goals[0] : match.events[match.events.length - 1];
      expect(item).toMatchObject({ timestamp: 1000, time: "13:00" });
    },
  );
  it.each(["25:00", "bad", null, 13])("rejects invalid client display time %s", (occurredTime) => {
    const { state, matchId } = live();
    expect(() =>
      applyWorkspaceCommand(
        state,
        command("add-goal", { team: "my-team" }, { matchId, occurredTime } as any),
      ),
    ).toThrow("Invalid occurredTime");
  });
  it.each(["yellow-card", "red-card"])("remembers only our players from %s", (eventType) => {
    const { state, matchId } = live();
    const opponent = applyWorkspaceCommand(
      state,
      command(
        "opponent-card",
        { eventType, team: "opponent", player: "Rival" },
        { type: "add-event", matchId },
      ),
    );
    expect(opponent.state.settings.players).toEqual([]);
    expect(opponent.structureChanged).toBe(false);
    const ours = applyWorkspaceCommand(
      opponent.state,
      command(
        "our-card",
        { eventType, team: "my-team", player: "Alice" },
        { type: "add-event", matchId },
      ),
    );
    expect(ours.state.settings.players).toEqual(["Alice"]);
    expect(ours.structureChanged).toBe(true);
  });
  it("deletes a historical summary when its full match is missing", () => {
    const { state, matchId } = live();
    const ended = applyWorkspaceCommand(state, command("end-match", {}, { matchId })).state;
    delete ended.fullMatches[matchId];
    const removed = applyWorkspaceCommand(
      ended,
      command("delete-historical-match", {}, { matchId, seasonId: ended.activeSeasonId! }),
    ).state;
    expect(removed.matches).toEqual([]);
    expect(removed.fullMatches).toEqual({});
  });
  it.each([{ isActive: false }, { endedAt: 1_700_000_000_100 }])(
    "rejects live writes to an ended match snapshot",
    (ended) => {
      const { state, matchId } = live();
      Object.assign(state.activeMatch!, ended);
      const original = structuredClone(state);
      expect(() =>
        applyWorkspaceCommand(
          state,
          command("add-goal", { team: "my-team", scorer: "Alice" }, { matchId }),
        ),
      ).toThrow("Match has ended");
      expect(state).toEqual(original);
    },
  );
  it.each([
    ["add-goal", { team: "my-team", scorer: "Alice", assist: "Bob", type: "normal" }],
    ["add-event", { eventType: "yellow-card", team: "my-team", player: "Alice" }],
    ["pause-match", {}],
    ["end-period", { expectedPeriod: 1 }],
    ["rename-opponent", { name: " Other " }],
  ])("applies %s command", (type, payload) => {
    const { state, matchId } = live();
    const result = applyWorkspaceCommand(
      state,
      command(type, payload, { matchId }),
      1_700_000_100_000,
    );
    expect(result.changed).toBe(true);
    expect(result.structureChanged).toBe(type === "add-goal" || type === "add-event");
  });

  it("starts match from empty state", () => {
    const cmd = command(
      "begin",
      { myTeamName: "Town", opponentName: "City", isHome: true },
      { type: "start-match" },
    );
    const result = applyWorkspaceCommand(base(), cmd, 100);
    expect(result.state.activeMatch).toMatchObject({
      id: "cmd-begin:match",
      myTeamName: "Town",
      currentPeriod: 1,
    });
    expect(result.structureChanged).toBe(true);
    expect(() => applyWorkspaceCommand(result.state, cmd, 200)).toThrow(WorkspaceError);
  });

  it("uses defaults for omitted start data and rejects conflicting starts", () => {
    const start = command("defaults", {}, { type: "start-match" });
    const created = applyWorkspaceCommand(
      base(),
      command("defaults", { isHome: false }, { type: "start-match" }),
      100,
    ).state;
    expect(created.activeMatch).toMatchObject({
      myTeamName: "My Team",
      opponentName: "Opponent",
      isHome: false,
    });
    expect(() =>
      applyWorkspaceCommand(created, command("other", { isHome: true }, { type: "start-match" })),
    ).toThrow(WorkspaceError);
    expect(() => applyWorkspaceCommand(base(), start, 100)).toThrow(WorkspaceError);
    expect(() =>
      applyWorkspaceCommand(
        base(),
        command("bad-home", { isHome: "yes" }, { type: "start-match" }),
      ),
    ).toThrow(WorkspaceError);
    const unnamed = { ...base(), settings: { ...base().settings, teamName: "" } };
    expect(
      applyWorkspaceCommand(
        unnamed,
        command("team-fallback", { isHome: true }, { type: "start-match" }),
      ).state.activeMatch!.myTeamName,
    ).toBe("My Team");
  });

  it("uses deterministic IDs, remembers players, and computes own-goal score correctly", () => {
    const { state, matchId } = live();
    let current = applyWorkspaceCommand(
      state,
      command(
        "add-goal",
        { team: "my-team", scorer: " Alice ", assist: "Bob", type: "own-goal" },
        { matchId },
      ),
      1_700_000_001_000,
    ).state;
    current = applyWorkspaceCommand(
      current,
      command("add-goal-2", { team: "opponent", type: "own-goal" }, { type: "add-goal", matchId }),
      1_700_000_002_000,
    ).state;
    expect(current.activeMatch!.goals.map((goal) => goal.id)).toEqual([
      "cmd-add-goal:goal",
      "cmd-add-goal-2:goal",
    ]);
    expect(current.settings.players).toEqual(["Alice", "Bob"]);
    const result = applyWorkspaceCommand(
      current,
      command("end", {}, { type: "end-match", matchId }),
      1_700_000_003_000,
    );
    expect(result.state.activeMatch).toBeNull();
    expect(result.state.seasons![current.activeSeasonId!]!.matches[0]).toMatchObject({
      myTeamScore: 1,
      opponentScore: 1,
    });
    expect(result.state.seasons![current.activeSeasonId!]!.fullMatches[matchId]).toMatchObject({
      isActive: false,
      events: [{ type: "start" }, { type: "period-end" }],
    });
    expect(result.structureChanged).toBe(true);
  });

  it("scores normal goals and archives paused matches", () => {
    const { state, matchId } = live();
    let current = applyWorkspaceCommand(
      state,
      command("ours", { team: "my-team", scorer: "A" }, { type: "add-goal", matchId }),
      1000,
    ).state;
    current = applyWorkspaceCommand(
      current,
      command("theirs", { team: "opponent" }, { type: "add-goal", matchId }),
      2000,
    ).state;
    current = applyWorkspaceCommand(
      current,
      command("pause", {}, { type: "pause-match", matchId }),
      2500,
    ).state;
    const finish = command(
      "finish",
      {},
      { type: "end-match", matchId, seasonId: current.activeSeasonId },
    );
    const ended = applyWorkspaceCommand(current, finish, 3000);
    expect(ended.state.matches[0]).toMatchObject({ myTeamScore: 1, opponentScore: 1 });
    expect(ended.state.fullMatches[matchId]).toMatchObject({
      isActive: false,
      isRunning: false,
      pausedAt: 2500,
    });
    expect(() => applyWorkspaceCommand(ended.state, finish, 4000)).toThrow(WorkspaceError);
  });

  it("remembers scorer once and normalizes blank optional goal players", () => {
    const { state, matchId } = live();
    const added = applyWorkspaceCommand(
      state,
      command(
        "whitespace",
        { team: "my-team", scorer: "  ", assist: "" },
        { type: "add-goal", matchId },
      ),
      1000,
    );
    expect(added.state.activeMatch!.goals[0]).toMatchObject({
      scorer: undefined,
      assist: undefined,
    });
    expect(added.state.settings.players).toEqual([]);
    const first = applyWorkspaceCommand(
      state,
      command("remember", { team: "my-team", scorer: "A" }, { type: "add-goal", matchId }),
      1000,
    ).state;
    const second = applyWorkspaceCommand(
      first,
      command("remember-again", { team: "my-team", scorer: "A" }, { type: "add-goal", matchId }),
      1001,
    ).state;
    expect(second.settings.players).toEqual(["A"]);
  });

  it("adds each roster member once and removes exact roster entries", () => {
    const first = applyWorkspaceCommand(
      base(),
      command("add", { player: "Alice" }, { type: "add-player" }),
    ).state;
    expect(
      applyWorkspaceCommand(
        first,
        command("duplicate", { player: "Alice" }, { type: "add-player" }),
      ).changed,
    ).toBe(false);
    const removed = applyWorkspaceCommand(
      first,
      command("remove", { player: "Alice" }, { type: "remove-player" }),
    ).state;
    expect(removed.settings.players).toEqual([]);
  });

  it("uses command-derived IDs for generated events and goals", () => {
    const { state, matchId } = live();
    const goalCommand = command("same-goal", { team: "opponent" }, { type: "add-goal", matchId });
    const once = applyWorkspaceCommand(state, goalCommand, 2000).state;
    const twice = applyWorkspaceCommand(once, goalCommand, 3000);
    expect(twice.changed).toBe(true);
    expect(twice.state.activeMatch!.goals.map((goal) => goal.id)).toEqual([
      "cmd-same-goal:goal",
      "cmd-same-goal:goal",
    ]);
    const eventCommand = command(
      "same-event",
      { eventType: "pause" },
      { type: "add-event", matchId },
    );
    const eventOnce = applyWorkspaceCommand(once, eventCommand, 4000).state;
    expect(
      applyWorkspaceCommand(eventOnce, eventCommand, 5000).state.activeMatch!.events.filter(
        (event) => event.id === "cmd-same-event:event",
      ),
    ).toHaveLength(2);
  });

  it("covers rejected goal and event payload variants", () => {
    const { state, matchId } = live();
    const badGoals = [
      { team: "other" },
      { team: "my-team", type: "bad" },
      { team: "my-team", scorer: 1 },
      { team: "my-team", assist: 1 },
    ];
    for (const payload of badGoals)
      expect(() =>
        applyWorkspaceCommand(state, command("bad-goal", payload, { type: "add-goal", matchId })),
      ).toThrow(WorkspaceError);
    const badEvents = [
      {},
      { eventType: "invalid" },
      { eventType: "pause", team: "other" },
      { eventType: "pause", player: 1 },
      { eventType: "pause", label: 1 },
    ];
    for (const payload of badEvents)
      expect(() =>
        applyWorkspaceCommand(state, command("bad-event", payload, { type: "add-event", matchId })),
      ).toThrow(WorkspaceError);
  });

  it("updates goal clock while preserving date and rejects invalid clock", () => {
    const { state, matchId } = live();
    const withGoal = applyWorkspaceCommand(
      state,
      command("goal", { team: "my-team", scorer: "A" }, { type: "add-goal", matchId }),
      1_700_000_010_000,
    ).state;
    const goal = withGoal.activeMatch!.goals[0];
    const changed = applyWorkspaceCommand(
      withGoal,
      command(
        "edit",
        { goalId: goal.id, changes: { scorer: "B", time: "12:30", type: "penalty" } },
        { type: "update-goal", matchId },
      ),
      1_700_000_020_000,
    ).state.activeMatch!.goals[0];
    expect(new Date(changed.timestamp).getDate()).toBe(new Date(goal.timestamp).getDate());
    expect(changed).toMatchObject({ scorer: "B", time: "12:30", type: "penalty" });
    expect(() =>
      applyWorkspaceCommand(
        withGoal,
        command(
          "bad",
          { goalId: goal.id, changes: { scorer: "B", time: "99:99", type: "normal" } },
          { type: "update-goal", matchId },
        ),
      ),
    ).toThrow(WorkspaceError);
  });

  it("edits goal clocks in requested timezone across DST and UTC date boundaries", () => {
    const cases = [
      ["Europe/Brussels", "2024-03-31T12:00:00.000Z", "00:30", "2024-03-30T23:30:00.000Z"],
      ["America/Los_Angeles", "2024-03-31T12:00:00.000Z", "23:30", "2024-04-01T06:30:00.000Z"],
    ];
    for (const [timeZone, started, time, expected] of cases) {
      const { state, matchId } = live();
      const timestamp = Date.parse(started);
      const withGoal = applyWorkspaceCommand(
        state,
        command(
          `add-${timeZone}`,
          { team: "my-team", scorer: "A" },
          { type: "add-goal", matchId, timeZone },
        ),
        timestamp,
      ).state;
      const goal = withGoal.activeMatch!.goals[0];
      const edited = applyWorkspaceCommand(
        withGoal,
        command(
          `edit-${timeZone}`,
          { goalId: goal.id, changes: { scorer: "A", type: "normal", time } },
          { type: "update-goal", matchId, timeZone },
        ),
        timestamp,
      ).state.activeMatch!.goals[0];
      expect(new Date(edited.timestamp).toISOString()).toBe(expected);
    }
    const { state, matchId } = live();
    const withGoal = applyWorkspaceCommand(
      state,
      command("zone-goal", { team: "my-team", scorer: "A" }, { type: "add-goal", matchId }),
      1000,
    ).state;
    expect(() =>
      applyWorkspaceCommand(
        withGoal,
        command(
          "bad-zone-edit",
          {
            goalId: withGoal.activeMatch!.goals[0].id,
            changes: { scorer: "A", type: "normal", time: "10:00" },
          },
          { type: "update-goal", matchId, timeZone: "invalid/zone" },
        ),
      ),
    ).toThrow(WorkspaceError);
  });

  it("edits goal clocks in requested timezone across DST and UTC date boundaries", () => {
    const cases = [
      ["Europe/Brussels", "2024-03-31T12:00:00.000Z", "00:30", "2024-03-30T23:30:00.000Z"],
      ["America/Los_Angeles", "2024-03-31T12:00:00.000Z", "23:30", "2024-04-01T06:30:00.000Z"],
    ];
    for (const [timeZone, started, time, expected] of cases) {
      const { state, matchId } = live();
      const withGoal = applyWorkspaceCommand(
        state,
        command(
          `add-${timeZone}`,
          { team: "my-team", scorer: "A" },
          { type: "add-goal", matchId, timeZone },
        ),
        Date.parse(started),
      ).state;
      const goal = withGoal.activeMatch!.goals[0];
      const edited = applyWorkspaceCommand(
        withGoal,
        command(
          `edit-${timeZone}`,
          { goalId: goal.id, changes: { scorer: "A", type: "normal", time } },
          { type: "update-goal", matchId, timeZone },
        ),
        Date.parse(started),
      ).state.activeMatch!.goals[0];
      expect(new Date(edited.timestamp).toISOString()).toBe(expected);
    }
  });

  it("rejects missing goal, malformed changes, and missing required scorer", () => {
    const { state, matchId } = live();
    const withGoal = applyWorkspaceCommand(
      state,
      command("ours", { team: "my-team", scorer: "A" }, { type: "add-goal", matchId }),
      1000,
    ).state;
    const goalId = withGoal.activeMatch!.goals[0].id;
    for (const changes of [
      null,
      {},
      { time: "08:00", type: "bad" },
      { time: "08:00", type: "normal", scorer: "" },
    ]) {
      expect(() =>
        applyWorkspaceCommand(
          withGoal,
          command("bad-edit", { goalId, changes }, { type: "update-goal", matchId }),
        ),
      ).toThrow(WorkspaceError);
    }
    expect(() =>
      applyWorkspaceCommand(
        withGoal,
        command(
          "missing-goal",
          { goalId: "gone", changes: { time: "08:00", type: "normal" } },
          { type: "update-goal", matchId },
        ),
      ),
    ).toThrow(WorkspaceError);
  });

  it("updates only editable events and deletes specific goals and events", () => {
    const { state, matchId } = live();
    const withGoal = applyWorkspaceCommand(
      state,
      command("g", { team: "opponent" }, { type: "add-goal", matchId }),
      1000,
    ).state;
    const withCard = applyWorkspaceCommand(
      withGoal,
      command(
        "card",
        { eventType: "yellow-card", team: "opponent", label: "Card" },
        { type: "add-event", matchId },
      ),
      2000,
    ).state;
    const start = withCard.activeMatch!.events[0];
    const timed = applyWorkspaceCommand(
      withCard,
      command("time", { eventId: start.id, time: "09:30" }, { type: "update-event-time", matchId }),
      3000,
    ).state.activeMatch!;
    expect(timed.startedAt).toBe(
      new Date(new Date(start.timestamp).setHours(9, 30, 0, 0)).getTime(),
    );
    expect(() =>
      applyWorkspaceCommand(
        withCard,
        command(
          "badtime",
          { eventId: withCard.activeMatch!.events[1].id, time: "09:30" },
          { type: "update-event-time", matchId },
        ),
      ),
    ).toThrow(WorkspaceError);
    const editedGoal = applyWorkspaceCommand(
      withCard,
      command(
        "edit-opponent",
        { goalId: withCard.activeMatch!.goals[0].id, changes: { time: "09:30", type: "head" } },
        { type: "update-goal", matchId },
      ),
      4000,
    ).state.activeMatch!.goals[0];
    expect(editedGoal).toMatchObject({ type: "head", time: "09:30", scorer: undefined });
    const noGoalScorer = applyWorkspaceCommand(
      withCard,
      command(
        "bad-scoring",
        { goalId: withCard.activeMatch!.goals[0].id, changes: { time: "09:30", type: "normal" } },
        { type: "update-goal", matchId },
      ),
    );
    expect(noGoalScorer.changed).toBe(true);
    const deleted = applyWorkspaceCommand(
      withCard,
      command(
        "delete-goal",
        { goalId: withCard.activeMatch!.goals[0].id },
        { type: "delete-goal", matchId },
      ),
      5000,
    ).state;
    const deletedEvent = applyWorkspaceCommand(
      deleted,
      command(
        "delete-event",
        { eventId: withCard.activeMatch!.events[1].id },
        { type: "delete-event", matchId },
      ),
    ).state;
    expect(deletedEvent.activeMatch!.goals).toEqual([]);
    expect(
      deletedEvent.activeMatch!.events.some(
        (event) => event.id === withCard.activeMatch!.events[1].id,
      ),
    ).toBe(false);
    expect(
      applyWorkspaceCommand(
        withCard,
        command("missing-delete-goal", { goalId: "gone" }, { type: "delete-goal", matchId }),
      ),
    ).toMatchObject({ changed: false, structureChanged: false, state: withCard });
    expect(
      applyWorkspaceCommand(
        withCard,
        command("missing-delete-event", { eventId: "gone" }, { type: "delete-event", matchId }),
      ),
    ).toMatchObject({ changed: false, structureChanged: false, state: withCard });
  });

  it.each(["delete-goal", "delete-event"] as const)(
    "makes a second %s a successful no-op within the same live match",
    (type) => {
      const { state, matchId } = live();
      const goalState = applyWorkspaceCommand(
        state,
        command("goal", { team: "opponent" }, { type: "add-goal", matchId }),
      ).state;
      const initial = applyWorkspaceCommand(
        goalState,
        command(
          "card",
          { eventType: "yellow-card", team: "opponent" },
          { type: "add-event", matchId },
        ),
      ).state;
      const payload =
        type === "delete-goal" ? { goalId: "cmd-goal:goal" } : { eventId: "cmd-card:event" };
      const first = applyWorkspaceCommand(initial, command("editor-a", payload, { type, matchId }));
      expect(first.changed).toBe(true);
      const second = applyWorkspaceCommand(
        first.state,
        command("editor-b", payload, { type, matchId }),
      );
      expect(second).toMatchObject({ state: first.state, changed: false, structureChanged: false });
      expect(initial.activeMatch!.goals).toHaveLength(1);
      expect(initial.activeMatch!.events).toHaveLength(2);
      expect(() =>
        applyWorkspaceCommand(
          first.state,
          command("wrong-match", payload, { type, matchId: "other" }),
        ),
      ).toThrow("Active match changed");
      expect(() =>
        applyWorkspaceCommand(first.state, command("missing-id", {}, { type, matchId })),
      ).toThrow(WorkspaceError);
      const ended = applyWorkspaceCommand(first.state, command("end-match", {}, { matchId })).state;
      expect(() =>
        applyWorkspaceCommand(ended, command("ended-match", payload, { type, matchId })),
      ).toThrow("Active match changed");
    },
  );

  it("validates event time targets and clock values", () => {
    const { state, matchId } = live();
    const periodEnd = applyWorkspaceCommand(
      state,
      command("end", { expectedPeriod: 1 }, { type: "end-period", matchId }),
      1000,
    ).state.activeMatch!.events.slice(-1)[0];
    const withEnd = {
      ...state,
      activeMatch: { ...state.activeMatch!, events: [...state.activeMatch!.events, periodEnd] },
    };
    const actual = applyWorkspaceCommand(
      withEnd,
      command(
        "edit-end",
        { eventId: periodEnd.id, time: "10:15" },
        { type: "update-event-time", matchId },
      ),
      2000,
    );
    expect(actual.state.activeMatch!.events.slice(-1)[0]).toMatchObject({ time: "10:15" });
    expect(() =>
      applyWorkspaceCommand(
        state,
        command(
          "bad-clock",
          { eventId: state.activeMatch!.events[0].id, time: "88:88" },
          { type: "update-event-time", matchId },
        ),
      ),
    ).toThrow(WorkspaceError);
    expect(() =>
      applyWorkspaceCommand(
        state,
        command(
          "no-event",
          { eventId: "gone", time: "10:00" },
          { type: "update-event-time", matchId },
        ),
      ),
    ).toThrow(WorkspaceError);
    expect(() =>
      applyWorkspaceCommand(
        state,
        command(
          "no-time",
          { eventId: state.activeMatch!.events[0].id },
          { type: "update-event-time", matchId },
        ),
      ),
    ).toThrow(WorkspaceError);
  });

  it("accumulates pause time and guards period transitions", () => {
    const { state, matchId } = live();
    const paused = applyWorkspaceCommand(
      state,
      command("pause", {}, { type: "pause-match", matchId }),
      1000,
    ).state.activeMatch!;
    expect(paused).toMatchObject({ isRunning: false, pausedAt: 1000 });
    const resumed = applyWorkspaceCommand(
      { ...state, activeMatch: paused },
      command("resume", {}, { type: "resume-match", matchId }),
      4000,
    ).state.activeMatch!;
    expect(resumed).toMatchObject({
      isRunning: true,
      pausedAt: undefined,
      totalPausedTime: 3000,
      periodPausedTime: 3000,
    });
    expect(() =>
      applyWorkspaceCommand(
        state,
        command("stale", { expectedPeriod: 2 }, { type: "end-period", matchId }),
      ),
    ).toThrow(WorkspaceError);
    const ended = applyWorkspaceCommand(
      state,
      command("period-end", { expectedPeriod: 1 }, { type: "end-period", matchId }),
      5000,
    ).state;
    const afterCard = applyWorkspaceCommand(
      ended,
      command("card", { eventType: "yellow-card" }, { type: "add-event", matchId }),
      5500,
    ).state;
    expect(() =>
      applyWorkspaceCommand(
        afterCard,
        command("resume-break", {}, { type: "resume-match", matchId }),
        5700,
      ),
    ).toThrow(WorkspaceError);
    const next = applyWorkspaceCommand(
      afterCard,
      command("period-start", { expectedPeriod: 1 }, { type: "start-period", matchId }),
      6000,
    ).state.activeMatch!;
    expect(next.currentPeriod).toBe(2);
  });

  it("rejects duplicate timer transitions and invalid expected period", () => {
    const { state, matchId } = live();
    const paused = applyWorkspaceCommand(
      state,
      command("pause", {}, { type: "pause-match", matchId }),
      1000,
    ).state;
    expect(() =>
      applyWorkspaceCommand(paused, command("pause-again", {}, { type: "pause-match", matchId })),
    ).toThrow(WorkspaceError);
    expect(() =>
      applyWorkspaceCommand(
        state,
        command("resume-too-soon", {}, { type: "resume-match", matchId }),
      ),
    ).toThrow(WorkspaceError);
    for (const value of ["1", 0, 1.5])
      expect(() =>
        applyWorkspaceCommand(
          state,
          command("invalid-period", { expectedPeriod: value }, { type: "end-period", matchId }),
        ),
      ).toThrow(WorkspaceError);
    const ended = applyWorkspaceCommand(
      paused,
      command("end-paused", { expectedPeriod: 1 }, { type: "end-period", matchId }),
      1500,
    ).state;
    expect(ended.activeMatch).toMatchObject({ isRunning: false, pausedAt: 1000 });
    expect(() =>
      applyWorkspaceCommand(
        ended,
        command("end-twice", { expectedPeriod: 1 }, { type: "end-period", matchId }),
      ),
    ).toThrow(WorkspaceError);
    expect(() =>
      applyWorkspaceCommand(state, command("start-twice", {}, { type: "start-period", matchId })),
    ).toThrow(WorkspaceError);
    expect(() =>
      applyWorkspaceCommand(
        paused,
        command("start-same", { expectedPeriod: 1 }, { type: "start-period", matchId }),
        2000,
      ),
    ).toThrow(WorkspaceError);
  });

  it("rejects wrong match IDs and malformed payloads without changing input", () => {
    const { state } = live();
    const before = structuredClone(state);
    expect(() =>
      applyWorkspaceCommand(state, command("wrong", {}, { type: "pause-match", matchId: "wrong" })),
    ).toThrow(WorkspaceError);
    expect(() =>
      applyWorkspaceCommand(
        state,
        command("bad", { team: "sideways" }, { type: "add-goal", matchId: state.activeMatch!.id }),
      ),
    ).toThrow(WorkspaceError);
    expect(state).toEqual(before);
  });

  it("rejects malformed command, missing target, invalid timezone, and missing match", () => {
    const state = base();
    expect(() =>
      applyWorkspaceCommand(state, { id: "x", type: "pause-match" } as any),
    ).toThrowError(WorkspaceError);
    expect(() =>
      applyWorkspaceCommand(
        state,
        command("bad-payload", [] as any, { type: "pause-match", matchId: "x" }),
      ),
    ).toThrow(WorkspaceError);
    expect(() =>
      applyWorkspaceCommand(state, command("missing", {}, { type: "pause-match" })),
    ).toThrow(WorkspaceError);
    const { state: active, matchId } = live();
    expect(() =>
      applyWorkspaceCommand(
        active,
        command(
          "bad-zone",
          { team: "opponent" },
          { type: "add-goal", matchId, timeZone: "invalid/zone" },
        ),
        2,
      ),
    ).toThrow(WorkspaceError);
    const goalState = applyWorkspaceCommand(
      active,
      command("zone-goal", { team: "opponent" }, { type: "add-goal", matchId }),
      1000,
    ).state;
    expect(() =>
      applyWorkspaceCommand(
        goalState,
        command("bad-date-zone", {}, { type: "end-match", matchId, timeZone: "invalid/zone" }),
        2000,
      ),
    ).toThrow(WorkspaceError);
    expect(() =>
      applyWorkspaceCommand(
        active,
        command("wrong-season", {}, { type: "rename-season", seasonId: "missing" }),
      ),
    ).toThrow(WorkspaceError);
    expect(() =>
      applyWorkspaceCommand(
        active,
        command("no-season-id", { name: "New" }, { type: "rename-season" }),
      ),
    ).toThrow(WorkspaceError);
    expect(() =>
      applyWorkspaceCommand(
        { ...active, activeMatch: null },
        command("no-active", {}, { type: "pause-match", matchId }),
      ),
    ).toThrow(WorkspaceError);
    expect(() => applyWorkspaceCommand(state, { id: "bad-type", type: "toString" } as any)).toThrow(
      WorkspaceError,
    );
    expect(() => applyWorkspaceCommand(state, { id: "", type: "pause-match" } as any)).toThrow(
      WorkspaceError,
    );
    expect(() =>
      applyWorkspaceCommand(
        { ...state, settings: null } as any,
        command("bad-state", {}, { type: "pause-match", matchId }),
      ),
    ).toThrow(WorkspaceError);
    expect(
      applyWorkspaceCommand(active, { id: "no-payload", type: "pause-match", matchId }, 3).state
        .activeMatch!.isRunning,
    ).toBe(false);
  });
});

describe("applyWorkspaceCommand structural mutations", () => {
  it.each([
    ["update-settings", { settings: { teamName: "United" } }],
    ["add-player", { player: "Alice" }],
    ["remove-player", { player: "Alice" }],
    ["close-season", { name: "Next" }],
    ["rename-season", { name: "Renamed" }],
  ])("applies %s and mirrors active season", (type, payload) => {
    const state = base();
    const extra = ["close-season", "rename-season"].includes(type)
      ? { seasonId: state.activeSeasonId }
      : {};
    const result = applyWorkspaceCommand(state, command(type, payload, extra), 1_700_000_100_000);
    expect(result.structureChanged).toBe(type !== "remove-player");
    expect(result.state.matches).toEqual(
      result.state.seasons![result.state.activeSeasonId!]!.matches,
    );
    expect(result.state.fullMatches).toEqual(
      result.state.seasons![result.state.activeSeasonId!]!.fullMatches,
    );
  });

  it("closes and reopens seasons with deterministic IDs", () => {
    const state = base();
    const oldId = state.activeSeasonId!;
    const closed = applyWorkspaceCommand(
      state,
      command("close", { name: "Next" }, { type: "close-season", seasonId: oldId }),
      10,
    ).state;
    expect(closed.activeSeasonId).toBe("cmd-close:season");
    expect(closed.seasons![oldId].status).toBe("closed");
    const reopened = applyWorkspaceCommand(
      closed,
      command("reopen", {}, { type: "reopen-season", seasonId: oldId }),
      20,
    ).state;
    expect(reopened.activeSeasonId).toBe(oldId);
    expect(reopened.seasons!["cmd-close:season"].status).toBe("closed");
    expect(() =>
      applyWorkspaceCommand(
        reopened,
        command("reopen", {}, { type: "reopen-season", seasonId: oldId }),
        30,
      ),
    ).toThrow(WorkspaceError);
    expect(() =>
      applyWorkspaceCommand(
        closed,
        command("close", { name: "Next" }, { type: "close-season", seasonId: oldId }),
        40,
      ),
    ).toThrow(WorkspaceError);
  });

  it("generates default season name and rejects stale season targets", () => {
    const state = base();
    const activeId = state.activeSeasonId!;
    const closed = applyWorkspaceCommand(
      state,
      command("no-name", {}, { type: "close-season", seasonId: activeId }),
      0,
    ).state;
    const year = new Date(0).getFullYear();
    expect(closed.seasons!["cmd-no-name:season"].name).toBe(`${year}-${year + 1}`);
    expect(() =>
      applyWorkspaceCommand(
        closed,
        command("bad-close", {}, { type: "close-season", seasonId: activeId }),
      ),
    ).toThrow(WorkspaceError);
    expect(() =>
      applyWorkspaceCommand(
        closed,
        command("reopen-active", {}, { type: "reopen-season", seasonId: closed.activeSeasonId }),
      ),
    ).toThrow(WorkspaceError);
    const occupiedId = "cmd-occupied:season";
    const occupied = {
      ...state,
      seasons: {
        ...state.seasons,
        [occupiedId]: {
          id: occupiedId,
          name: "Taken",
          startAt: 1,
          status: "closed" as const,
          matches: [],
          fullMatches: {},
        },
      },
    };
    expect(() =>
      applyWorkspaceCommand(
        occupied,
        command("occupied", {}, { type: "close-season", seasonId: activeId }),
      ),
    ).toThrow(WorkspaceError);
  });

  it("resumes paused match and starts next period", () => {
    const { state, matchId } = live();
    const paused = applyWorkspaceCommand(
      state,
      command("pause", {}, { type: "pause-match", matchId }),
      1000,
    ).state;
    const resumed = applyWorkspaceCommand(
      paused,
      command("resume", {}, { type: "resume-match", matchId }),
      4000,
    ).state;
    expect(resumed.activeMatch).toMatchObject({
      isRunning: true,
      totalPausedTime: 3000,
      periodPausedTime: 3000,
    });
    const ended = applyWorkspaceCommand(
      resumed,
      command("end-period", { expectedPeriod: 1 }, { type: "end-period", matchId }),
      5000,
    ).state;
    const next = applyWorkspaceCommand(
      ended,
      command("period-start", { expectedPeriod: 1 }, { type: "start-period", matchId }),
      6000,
    ).state.activeMatch!;
    expect(next.currentPeriod).toBe(2);
  });

  it("renames and deletes historical match with summary mirrored", () => {
    const { state, matchId } = live();
    const archived = applyWorkspaceCommand(
      state,
      command("finish", {}, { type: "end-match", matchId, seasonId: state.activeSeasonId }),
      2000,
    ).state;
    const renamed = applyWorkspaceCommand(
      archived,
      command(
        "rename-rival",
        { name: "New Rival" },
        { type: "rename-historical-opponent", seasonId: archived.activeSeasonId, matchId },
      ),
      3000,
    ).state;
    expect(renamed.seasons![renamed.activeSeasonId!]!.fullMatches[matchId].opponentName).toBe(
      "New Rival",
    );
    expect(renamed.matches[0].opponentName).toBe("New Rival");
    const noSummary = {
      ...renamed,
      matches: [],
      seasons: {
        ...renamed.seasons!,
        [renamed.activeSeasonId!]: { ...renamed.seasons![renamed.activeSeasonId!]!, matches: [] },
      },
    };
    expect(
      applyWorkspaceCommand(
        noSummary,
        command(
          "rename-no-summary",
          { name: "Again" },
          { type: "rename-historical-opponent", seasonId: renamed.activeSeasonId, matchId },
        ),
      ).state.matches,
    ).toEqual([]);
    const duplicateActive = { ...renamed, activeMatch: renamed.fullMatches[matchId] };
    expect(
      applyWorkspaceCommand(
        duplicateActive,
        command(
          "rename-active-too",
          { name: "Again" },
          { type: "rename-historical-opponent", seasonId: renamed.activeSeasonId, matchId },
        ),
      ).state.activeMatch!.opponentName,
    ).toBe("Again");
    const deleted = applyWorkspaceCommand(
      renamed,
      command(
        "delete",
        {},
        { type: "delete-historical-match", seasonId: renamed.activeSeasonId, matchId },
      ),
      4000,
    ).state;
    expect(deleted.matches).toEqual([]);
    expect(deleted.fullMatches).toEqual({});
    expect(() =>
      applyWorkspaceCommand(
        renamed,
        command(
          "missing-delete",
          {},
          { type: "delete-historical-match", seasonId: renamed.activeSeasonId, matchId: "gone" },
        ),
      ),
    ).toThrow(WorkspaceError);
    expect(() =>
      applyWorkspaceCommand(
        renamed,
        command(
          "missing-rename",
          { name: "New" },
          { type: "rename-historical-opponent", seasonId: renamed.activeSeasonId, matchId: "gone" },
        ),
      ),
    ).toThrow(WorkspaceError);
    expect(() =>
      applyWorkspaceCommand(
        renamed,
        command(
          "missing-historical-id",
          { name: "New" },
          { type: "rename-historical-opponent", seasonId: renamed.activeSeasonId },
        ),
      ),
    ).toThrow(WorkspaceError);
  });

  it("rejects credential fields in settings mutation", () => {
    expect(() =>
      applyWorkspaceCommand(
        base(),
        command("unsafe-settings", { settings: { theme: "dark" } }, { type: "update-settings" }),
      ),
    ).toThrow(WorkspaceError);
    for (const settings of [
      null,
      { teamName: "" },
      { calendarUrl: 4 },
      { players: [""] },
      { periodsCount: 0 },
      { periodDuration: -1 },
      { debug: "yes" },
    ]) {
      expect(() =>
        applyWorkspaceCommand(
          base(),
          command("bad-settings", { settings }, { type: "update-settings" }),
        ),
      ).toThrow(WorkspaceError);
    }
    expect(() =>
      applyWorkspaceCommand(
        base(),
        command("bad-player", { player: "  " }, { type: "add-player" }),
      ),
    ).toThrow(WorkspaceError);
  });

  it("rejects structural edits during active match and unconfirmed backup import", () => {
    const { state } = live();
    expect(() =>
      applyWorkspaceCommand(
        state,
        command("close", {}, { type: "close-season", seasonId: state.activeSeasonId }),
      ),
    ).toThrow(WorkspaceError);
    expect(() =>
      applyWorkspaceCommand(
        state,
        command(
          "reopen-active-match",
          {},
          { type: "reopen-season", seasonId: state.activeSeasonId },
        ),
      ),
    ).toThrow(WorkspaceError);
    expect(() =>
      applyWorkspaceCommand(state, command("backup", { state }, { type: "import-backup" })),
    ).toThrow(WorkspaceError);
    expect(() =>
      applyWorkspaceCommand(
        base(),
        command("backup-missing", { confirmed: true }, { type: "import-backup" }),
      ),
    ).toThrow(WorkspaceError);
    expect(() =>
      applyWorkspaceCommand(
        base(),
        command("backup-bad", { confirmed: true, state: {} }, { type: "import-backup" }),
      ),
    ).toThrow(WorkspaceError);
  });

  it("imports confirmed backup atomically and strips private settings", () => {
    const state = base();
    const imported = { ...base(), settings: { ...base().settings, credential: "private" } };
    const result = applyWorkspaceCommand(
      state,
      command("import", { confirmed: true, state: imported }, { type: "import-backup" }),
    );
    expect(result.state.settings).not.toHaveProperty("credential");
    expect(result.structureChanged).toBe(true);
  });
});
