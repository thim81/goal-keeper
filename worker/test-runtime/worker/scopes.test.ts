/// <reference types="@cloudflare/vitest-plugin/types" />
import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import {
  COMMAND_SCOPES,
  createEmptyWorkspace,
  type WorkspaceCommandType,
} from "../../../src/lib/workspace";
import { applyWorkspaceCommand } from "../../../src/lib/workspace-mutations";
import type { SyncState } from "../../../src/lib/sync";
const cases: Record<
  WorkspaceCommandType,
  { payload?: Record<string, unknown>; prepare?: string[]; idle?: boolean }
> = {
  "start-match": { idle: true, payload: { isHome: true } },
  "end-match": {},
  "update-settings": { payload: { settings: { teamName: "Changed" } } },
  "add-player": { payload: { player: "Alex" } },
  "remove-player": { payload: { player: "Alex" } },
  "close-season": { idle: true, payload: { name: "Next" } },
  "reopen-season": { idle: true, prepare: ["close-season"] },
  "rename-season": { payload: { name: "Renamed" } },
  "delete-historical-match": { prepare: ["end-match"] },
  "rename-historical-opponent": { prepare: ["end-match"], payload: { name: "Renamed" } },
  "import-backup": { payload: { confirmed: true, state: createEmptyWorkspace() } },
  "add-goal": { payload: { team: "my-team", scorer: "Alex" } },
  "update-goal": {
    prepare: ["add-goal"],
    payload: {
      goalId: "prepare-add-goal:goal",
      changes: { scorer: "Alex", type: "penalty", time: "10:00" },
    },
  },
  "delete-goal": { prepare: ["add-goal"], payload: { goalId: "prepare-add-goal:goal" } },
  "add-event": { payload: { eventType: "yellow-card", team: "my-team", player: "Alex" } },
  "update-event-time": { payload: { eventId: "start:start", time: "10:00" } },
  "delete-event": { payload: { eventId: "start:start" } },
  "pause-match": {},
  "resume-match": { prepare: ["pause-match"] },
  "start-period": { prepare: ["end-period"], payload: { expectedPeriod: 1 } },
  "end-period": { payload: { expectedPeriod: 1 } },
  "rename-opponent": { payload: { name: "Renamed" } },
};
function prepare(type: WorkspaceCommandType): SyncState {
  const scenario = cases[type];
  let state = createEmptyWorkspace();
  if (!scenario.idle)
    state = applyWorkspaceCommand(state, {
      id: "start",
      type: "start-match",
      payload: { isHome: true },
    }).state;
  for (const action of scenario.prepare ?? []) {
    const payload =
      action === "add-goal"
        ? { team: "my-team", scorer: "Alex" }
        : action === "end-period"
          ? { expectedPeriod: 1 }
          : {};
    state = applyWorkspaceCommand(state, {
      id: `prepare-${action}`,
      type: action as WorkspaceCommandType,
      matchId: state.activeMatch?.id,
      seasonId: state.activeSeasonId,
      payload,
    }).state;
  }
  return state;
}
describe("every command response scope in real DO runtime", () => {
  it.each(Object.keys(COMMAND_SCOPES) as WorkspaceCommandType[])(
    "%s follows declared scope for execution and retry",
    async (type) => {
      const state = prepare(type);
      await env.GOALKEEPER_KV.put("goal-keeper-state", JSON.stringify(state));
      const stub = env.WORKSPACES.get(env.WORKSPACES.idFromName(crypto.randomUUID()));
      const historical = Object.values(state.seasons!).flatMap((season) =>
        Object.keys(season.fullMatches),
      )[0];
      const seasonId =
        type === "reopen-season"
          ? Object.values(state.seasons!).find((s) => s.status === "closed")!.id
          : state.activeSeasonId;
      const command = {
        id: `scope-${type}`,
        type,
        matchId: state.activeMatch?.id ?? historical,
        seasonId,
        payload: cases[type].payload ?? {},
        ...(type === "import-backup" ? { expectedRevision: 0 } : {}),
      };
      const send = () =>
        stub.fetch("http://workspace/command", { method: "POST", body: JSON.stringify(command) });
      const first = await send();
      expect(first.status).toBe(200);
      const body: any = await first.json();
      expect(body.scope).toBe(COMMAND_SCOPES[type]);
      expect(body.commandId).toBe(command.id);
      if (body.scope === "live") {
        expect(body).toHaveProperty("activeMatch");
        expect(body).not.toHaveProperty("state");
      } else {
        expect(body).toHaveProperty("state.seasons");
        expect(body).not.toHaveProperty("activeMatch");
      }
      const retried = await send();
      expect(retried.status).toBe(200);
      expect(await retried.json()).toEqual(body);
    },
  );
});
