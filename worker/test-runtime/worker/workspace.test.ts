/// <reference types="@cloudflare/vitest-plugin/types" />
import { describe, expect, it } from "vitest";
import { env, runInDurableObject } from "cloudflare:test";
import { createEmptyWorkspace } from "../../../src/lib/workspace";
import type { SyncState } from "../../../src/lib/sync";
import type { Workspace } from "../../workspace";

declare global {
  namespace Cloudflare {
    interface Env {
      WORKSPACES: DurableObjectNamespace<Workspace>;
      GOALKEEPER_KV: KVNamespace;
      ALLOW_EMPTY_WORKSPACE?: string;
      WORKSPACE_ID?: string;
    }
  }
}

const LEGACY_KEY = "goal-keeper-state";
function workspace() {
  const name = `test-${crypto.randomUUID()}`;
  return env.WORKSPACES.get(env.WORKSPACES.idFromName(name));
}

async function seed(state: SyncState = createEmptyWorkspace()) {
  const raw = JSON.stringify(state);
  await env.GOALKEEPER_KV.put(LEGACY_KEY, raw);
  if ((await env.GOALKEEPER_KV.get(LEGACY_KEY, "text")) !== raw)
    throw new Error("test KV seed failed");
  return raw;
}

async function get(stub: DurableObjectStub<Workspace>, path = "/state") {
  return stub.fetch(`http://workspace${path}`);
}

async function command(stub: DurableObjectStub<Workspace>, value: Record<string, unknown>) {
  return stub.fetch("http://workspace/command", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
}

async function body(response: Response) {
  return response.json() as Promise<Record<string, any>>;
}

describe("SQLite workspace Worker", () => {
  it("returns the editor's recorded goal time unchanged to live/full reads, retries and completed history", async () => {
    await seed();
    const stub = workspace();
    const started = await body(
      await command(stub, { id: "start", type: "start-match", payload: { isHome: true } }),
    );
    const matchId = started.state.activeMatch.id;
    const occurredAt = Date.parse("2026-10-04T13:00:00Z");
    const goal = {
      id: "at-one",
      type: "add-goal",
      matchId,
      occurredAt,
      timeZone: "UTC",
      payload: { team: "my-team" },
    };
    const accepted = await body(await command(stub, goal));
    expect(accepted.activeMatch.goals[0]).toMatchObject({ timestamp: occurredAt, time: "13:00" });
    expect((await body(await get(stub, "/active-match"))).activeMatch.goals[0]).toEqual(
      accepted.activeMatch.goals[0],
    );
    expect((await body(await get(stub))).state.activeMatch.goals[0]).toEqual(
      accepted.activeMatch.goals[0],
    );
    expect(await body(await command(stub, goal))).toEqual(accepted);
    expect((await command(stub, { ...goal, occurredAt: occurredAt + 1000 })).status).toBe(409);
    await command(stub, { id: "end", type: "end-match", matchId });
    const finished = await body(await get(stub));
    expect(finished.state.fullMatches[matchId].goals[0]).toEqual(accepted.activeMatch.goals[0]);
  });
  it("denies direct public Worker access", async () => {
    const worker = (await import("../../workspace")).default;
    expect((await worker.fetch(new Request("https://example.test/api/command"), env)).status).toBe(
      404,
    );
  });

  it("serializes concurrent goal and card updates in SQLite", async () => {
    await seed();
    const stub = workspace();
    const started = await body(
      await command(stub, { id: "start", type: "start-match", payload: { isHome: true } }),
    );
    const matchId = started.state.activeMatch.id as string;
    const [goal, card] = await Promise.all([
      command(stub, {
        id: "goal",
        type: "add-goal",
        matchId,
        payload: { team: "my-team", scorer: "Alex" },
      }),
      command(stub, {
        id: "card",
        type: "add-event",
        matchId,
        payload: { eventType: "yellow-card", team: "my-team", player: "Sam" },
      }),
    ]);
    expect(goal.status).toBe(200);
    expect(card.status).toBe(200);
    const current = await body(await get(stub, "/active-match"));
    expect(current).toMatchObject({ scope: "live", revision: 3, structureRevision: 3 });
    expect(current.activeMatch.goals).toHaveLength(1);
    expect(
      current.activeMatch.events.some((event: { type: string }) => event.type === "yellow-card"),
    ).toBe(true);
  });

  it("initializes once for concurrent legacy requests and preserves exact legacy data", async () => {
    const legacy = {
      matches: [],
      fullMatches: {},
      activeMatch: {
        id: "legacy-live-match",
        myTeamName: "Legacy Team",
        opponentName: "Legacy Opponent",
        isHome: false,
        goals: [
          { id: "legacy-goal", team: "my-team", type: "normal", time: "01:20", timestamp: 80_000 },
        ],
        events: [{ id: "legacy-event", type: "start", time: "00:00", timestamp: 0 }],
        startedAt: 0,
        isActive: true,
        isRunning: false,
        pausedAt: 30_000,
        totalPausedTime: 30_000,
        currentPeriod: 1,
      },
      settings: {
        teamName: "Legacy Team",
        players: ["Alex"],
        periodsCount: 2,
        periodDuration: 30,
        debug: true,
      },
    };
    const raw = await seed(legacy as SyncState);
    const stub = workspace();
    const responses = await Promise.all([get(stub), get(stub), get(stub)]);
    expect(responses.map((item) => item.status)).toEqual([200, 200, 200]);
    const states = await Promise.all(responses.map(body));
    expect(states[0]).toEqual(states[1]);
    expect(states[1]).toEqual(states[2]);
    expect(states[0].state.activeMatch).toMatchObject({
      id: "legacy-live-match",
      periodPausedTime: 0,
      goals: [{ id: "legacy-goal" }],
      events: [{ id: "legacy-event" }],
    });
    expect(states[0].state.settings).toMatchObject({
      teamName: "Legacy Team",
      players: ["Alex"],
      periodsCount: 2,
      periodDuration: 30,
      calendarUrl: "",
      calendarTeamName: "",
      debug: true,
    });
    expect(await env.GOALKEEPER_KV.get(LEGACY_KEY, "text")).toBe(raw);
  });

  it("deduplicates lost replies after target deletion and rejects changed command content", async () => {
    await seed();
    const stub = workspace();
    const started = await body(
      await command(stub, { id: "start", type: "start-match", payload: { isHome: true } }),
    );
    const matchId = started.state.activeMatch.id as string;
    const score = { id: "score", type: "add-goal", matchId, payload: { team: "my-team" } };
    const original = await body(await command(stub, score));
    await command(stub, {
      id: "end",
      type: "end-match",
      matchId,
      seasonId: started.state.activeSeasonId,
    });
    const revision = (await body(await get(stub))).revision;
    const retry = await body(await command(stub, score));
    expect(retry).toMatchObject({ scope: "live", commandId: "score", revision, activeMatch: null });
    expect((await command(stub, { ...score, payload: { team: "opponent" } })).status).toBe(409);
    expect((await body(await get(stub))).revision).toBe(revision);
    expect(original.scope).toBe("live");
    expect((await body(await get(stub))).revision).toBe(revision);
  });

  it("keeps scope and revision contract for structural and live commands", async () => {
    await seed();
    const stub = workspace();
    const structural = await body(
      await command(stub, {
        id: "settings",
        type: "update-settings",
        payload: { settings: { teamName: "Changed" } },
      }),
    );
    expect(structural).toMatchObject({
      scope: "structural",
      workspaceId: "goal-keeper",
      revision: 1,
      structureRevision: 1,
      commandId: "settings",
    });
    const started = await body(
      await command(stub, { id: "start", type: "start-match", payload: { isHome: true } }),
    );
    const live = await body(
      await command(stub, {
        id: "rename-live",
        type: "rename-opponent",
        matchId: started.state.activeMatch.id,
        payload: { name: "Rivals" },
      }),
    );
    expect(live).toMatchObject({
      scope: "live",
      workspaceId: "goal-keeper",
      revision: 3,
      structureRevision: 2,
      commandId: "rename-live",
      activeMatch: { opponentName: "Rivals" },
    });
  });

  it("preserves original KV data, strips private settings, and never reimports", async () => {
    const state = createEmptyWorkspace();
    state.settings = {
      ...state.settings,
      syncToken: "secret",
      theme: "dark",
    } as typeof state.settings;
    const raw = await seed(state);
    const stub = workspace();
    const first = await body(await get(stub));
    expect(first.state.settings).not.toHaveProperty("syncToken");
    expect(first.state.settings).not.toHaveProperty("theme");
    expect(await env.GOALKEEPER_KV.get(LEGACY_KEY, "text")).toBe(raw);
    const replacement = createEmptyWorkspace();
    replacement.settings.teamName = "later KV edit";
    await env.GOALKEEPER_KV.put(LEGACY_KEY, JSON.stringify(replacement));
    expect((await body(await get(stub))).state.settings.teamName).not.toBe("later KV edit");
  });

  it("blocks missing, invalid, and oversized legacy data", async () => {
    await env.GOALKEEPER_KV.delete(LEGACY_KEY);
    expect((await get(workspace())).status).toBe(503);
    await env.GOALKEEPER_KV.put(LEGACY_KEY, "not-json");
    expect((await get(workspace())).status).toBe(503);
    await env.GOALKEEPER_KV.put(LEGACY_KEY, "x".repeat(1_000_001));
    expect((await get(workspace())).status).toBe(503);
  });

  it("rolls back a failed SQL ledger insert and permits same-id retry", async () => {
    await seed();
    const stub = workspace();
    await command(stub, { id: "start", type: "start-match", payload: { isHome: true } });
    const matchId = (await body(await get(stub, "/state"))).state.activeMatch.id;
    const goal = { id: "rollback-goal", type: "add-goal", matchId, payload: { team: "opponent" } };
    await runInDurableObject(stub, (_instance, state) => {
      state.storage.sql.exec(
        "CREATE TRIGGER fail_command_insert BEFORE INSERT ON commands BEGIN SELECT RAISE(ABORT, 'synthetic ledger failure'); END",
      );
    });
    expect((await command(stub, goal)).status).toBe(500);
    expect((await body(await get(stub))).revision).toBe(1);
    expect((await body(await get(stub))).state.activeMatch.goals).toHaveLength(0);
    const missingCommand = await runInDurableObject(stub, (_instance, state) => [
      ...state.storage.sql.exec("SELECT id FROM commands WHERE id = 'rollback-goal'"),
    ]);
    expect(missingCommand).toHaveLength(0);
    await runInDurableObject(stub, (_instance, state) =>
      state.storage.sql.exec("DROP TRIGGER fail_command_insert"),
    );
    expect((await command(stub, goal)).status).toBe(200);
    expect((await body(await get(stub))).state.activeMatch.goals).toHaveLength(1);
    expect((await body(await get(stub))).revision).toBe(2);
  });

  it("requires current revision and explicit confirmation for backup import", async () => {
    await seed();
    const stub = workspace();
    const imported = createEmptyWorkspace();
    imported.settings.teamName = "Imported";
    imported.settings = { ...imported.settings, syncToken: "backup-secret-token", theme: "dark" };
    expect(
      (
        await command(stub, {
          id: "import-missing-revision",
          type: "import-backup",
          payload: { confirmed: true, state: imported },
        })
      ).status,
    ).toBe(409);
    expect((await body(await get(stub))).revision).toBe(0);
    await command(stub, {
      id: "before-import",
      type: "update-settings",
      expectedRevision: 0,
      payload: { settings: { teamName: "Pre-import" } },
    });
    expect(
      (
        await command(stub, {
          id: "import-stale",
          type: "import-backup",
          expectedRevision: 0,
          payload: { confirmed: true, state: imported },
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await command(stub, {
          id: "import-unconfirmed",
          type: "import-backup",
          expectedRevision: 1,
          payload: { confirmed: false, state: imported },
        })
      ).status,
    ).toBe(409);
    expect((await body(await get(stub))).state.settings.teamName).toBe("Pre-import");
    expect((await body(await get(stub))).revision).toBe(1);
    const noRecovery = await runInDurableObject(stub, (_instance, state) => [
      ...state.storage.sql.exec("SELECT command_id FROM recovery"),
    ]);
    expect(noRecovery).toHaveLength(0);
    const response = await command(stub, {
      id: "import",
      type: "import-backup",
      expectedRevision: 1,
      payload: { confirmed: true, state: imported },
    });
    expect(response.status).toBe(200);
    expect((await body(response)).state.settings.teamName).toBe("Imported");
    const stored = await runInDurableObject(stub, (_instance, state) => ({
      recovery: [
        ...state.storage.sql.exec<{ state: string; revision: number }>(
          "SELECT state, revision FROM recovery",
        ),
      ],
      command: [
        ...state.storage.sql.exec<{ fingerprint: string }>(
          "SELECT fingerprint FROM commands WHERE id = 'import'",
        ),
      ][0],
    }));
    expect(stored.recovery).toHaveLength(1);
    expect(JSON.parse(stored.recovery[0].state).settings.teamName).not.toBe("Imported");
    expect(stored.recovery[0].revision).toBe(1);
    expect(stored.command.fingerprint).not.toContain("backup-secret-token");
    expect((await body(await get(stub))).state.settings).not.toHaveProperty("syncToken");
    expect((await body(await get(stub))).state.settings).not.toHaveProperty("theme");
  });
});
