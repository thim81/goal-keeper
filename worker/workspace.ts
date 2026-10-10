import { DurableObject } from "cloudflare:workers";
import { applyWorkspaceCommand, WorkspaceError } from "../src/lib/workspace-mutations";
import {
  COMMAND_SCOPES,
  createEmptyWorkspace,
  normalizeWorkspace,
  type WorkspaceCommand,
} from "../src/lib/workspace";
import type { SyncState } from "../src/lib/sync";

import { MAX_STATE_BYTES, parseMigrationState } from "../src/lib/workspace-migration";

const LEGACY_KEY = "goal-keeper-state";

interface Env {
  WORKSPACES: DurableObjectNamespace<Workspace>;
  GOALKEEPER_KV: KVNamespace;
  ALLOW_EMPTY_WORKSPACE?: string;
  WORKSPACE_ID?: string;
}

interface StoredWorkspace {
  state: SyncState;
  revision: number;
  structureRevision: number;
  migration: string;
}

interface StoredCommand {
  fingerprint: string;
  scope: "live" | "structural";
}

const response = (body: unknown, status = 200): Response =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
};

export class Workspace extends DurableObject<Env> {
  private ready?: Promise<WorkspaceError | undefined>;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  private async ensureReady(): Promise<void> {
    const ready = this.ready ??= this.ctx.blockConcurrencyWhile(async () => {
      try {
        await this.initialize();
      } catch (error) {
        if (!(error instanceof WorkspaceError))
          console.error(JSON.stringify({ event: "workspace_storage_error", kind: "initialization" }));
        return error instanceof WorkspaceError
          ? error
          : new WorkspaceError(503, "Workspace initialization unavailable");
      }
    });
    const error = await ready;
    if (error) {
      // A failed attempt is retryable on the next request, with no redeploy or replay loop.
      if (this.ready === ready) this.ready = undefined;
      throw error;
    }
  }

  private sql<T extends Record<string, SqlStorageValue> = Record<string, SqlStorageValue>>(
    query: string,
    ...values: unknown[]
  ): T[] {
    return [...this.ctx.storage.sql.exec<T>(query, ...values)];
  }

  private async initialize(): Promise<void> {
    const sql = this.ctx.storage.sql;
    sql.exec(
      "CREATE TABLE IF NOT EXISTS workspace (id INTEGER PRIMARY KEY CHECK (id = 1), state TEXT NOT NULL, revision INTEGER NOT NULL, structure_revision INTEGER NOT NULL, migration TEXT NOT NULL)",
    );
    sql.exec(
      "CREATE TABLE IF NOT EXISTS commands (id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, scope TEXT NOT NULL)",
    );
    sql.exec(
      "CREATE TABLE IF NOT EXISTS recovery (command_id TEXT PRIMARY KEY, state TEXT NOT NULL, revision INTEGER NOT NULL, created_at INTEGER NOT NULL)",
    );
    if (this.sql("SELECT id FROM workspace WHERE id = 1").length) return;

    let legacy: string | null;
    try {
      legacy = await this.env.GOALKEEPER_KV.get(LEGACY_KEY, "text");
    } catch {
      console.warn(JSON.stringify({ event: "workspace_migration_failed", kind: "kv_unavailable" }));
      throw new WorkspaceError(503, "Legacy KV read unavailable; initialization will retry on the next request");
    }
    let state: SyncState;
    let migration: string;
    try {
      if (legacy === null) {
        if (this.env.ALLOW_EMPTY_WORKSPACE !== "true") throw new Error("Legacy workspace source is missing");
        state = createEmptyWorkspace();
        migration = "empty-preview";
      } else {
        state = parseMigrationState(legacy);
        migration = "legacy-imported";
      }
    } catch (error) {
      console.warn(
        JSON.stringify({
          event: "workspace_migration_failed",
          kind: "invalid_source",
          reason: error instanceof Error ? error.message : "Invalid workspace",
        }),
      );
      throw new WorkspaceError(503, `Workspace migration blocked: ${error instanceof Error ? error.message : "Invalid workspace"}`);
    }
    this.ctx.storage.transactionSync(() => {
      sql.exec(
        "INSERT OR IGNORE INTO workspace (id, state, revision, structure_revision, migration) VALUES (1, ?, 0, 0, ?)",
        JSON.stringify(state),
        migration,
      );
    });
    console.info(
      JSON.stringify({
        event: "workspace_initialized",
        migration,
        revision: 0,
        structureRevision: 0,
      }),
    );
  }

  private read(): StoredWorkspace {
    const row = this.sql<{
      state: string;
      revision: number;
      structure_revision: number;
      migration: string;
    }>("SELECT state, revision, structure_revision, migration FROM workspace WHERE id = 1")[0];
    if (!row) throw new WorkspaceError(503, "Workspace unavailable");
    return {
      state: normalizeWorkspace(JSON.parse(row.state)),
      revision: row.revision,
      structureRevision: row.structure_revision,
      migration: row.migration,
    };
  }

  private envelope(
    scope: "live" | "structural",
    stored: StoredWorkspace,
    commandId?: string,
  ): Record<string, unknown> {
    const common = {
      scope,
      workspaceId: this.env.WORKSPACE_ID || "goal-keeper",
      revision: stored.revision,
      structureRevision: stored.structureRevision,
      ...(commandId ? { commandId } : {}),
    };
    return scope === "live"
      ? {
          ...common,
          activeMatch: stored.state.activeMatch,
          activeSeasonId: stored.state.activeSeasonId ?? null,
        }
      : { ...common, state: stored.state };
  }

  private async execute(command: WorkspaceCommand): Promise<Response> {
    if (
      !command ||
      typeof command !== "object" ||
      typeof command.id !== "string" ||
      !command.id ||
      typeof command.type !== "string" ||
      !Object.hasOwn(COMMAND_SCOPES, command.type)
    ) {
      throw new WorkspaceError(400, "Invalid command");
    }
    const scope = COMMAND_SCOPES[command.type] as "live" | "structural";
    const canonicalCommand = canonical(command);
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(canonicalCommand),
    );
    const fingerprint = [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    const sql = this.ctx.storage.sql;
    let result: Record<string, unknown> | undefined;
    this.ctx.storage.transactionSync(() => {
      const prior = this.sql<{ fingerprint: string; scope: string }>(
        "SELECT fingerprint, scope FROM commands WHERE id = ?",
        command.id,
      )[0] as StoredCommand | undefined;
      const current = this.read();
      if (prior) {
        if (prior.fingerprint !== fingerprint) {
          console.warn(
            JSON.stringify({
              event: "workspace_command_conflict",
              commandId: command.id,
              type: command.type,
              scope,
              revision: current.revision,
              structureRevision: current.structureRevision,
              conflict: "command_id_reused",
            }),
          );
          throw new WorkspaceError(409, "Command ID already used");
        }
        result = this.envelope(prior.scope, current, command.id);
        return;
      }
      if (command.expectedRevision !== undefined && command.expectedRevision !== current.revision) {
        console.warn(
          JSON.stringify({
            event: "workspace_command_conflict",
            commandId: command.id,
            type: command.type,
            scope,
            revision: current.revision,
            structureRevision: current.structureRevision,
            conflict: "revision_mismatch",
          }),
        );
        throw new WorkspaceError(409, "Workspace revision changed");
      }
      if (
        command.type === "import-backup" &&
        (command.expectedRevision !== current.revision || command.payload?.confirmed !== true)
      ) {
        throw new WorkspaceError(409, "Backup import requires current revision and confirmation");
      }
      const update = applyWorkspaceCommand(current.state, command, Date.now());
      if (update.changed) {
        const nextState = normalizeWorkspace(update.state);
        const serialized = JSON.stringify(nextState);
        if (new TextEncoder().encode(serialized).byteLength > MAX_STATE_BYTES)
          throw new WorkspaceError(413, "Workspace state too large");
        if (command.type === "import-backup") {
          sql.exec(
            "INSERT INTO recovery (command_id, state, revision, created_at) VALUES (?, ?, ?, ?)",
            command.id,
            JSON.stringify(current.state),
            current.revision,
            Date.now(),
          );
        }
        current.revision++;
        if (update.structureChanged) current.structureRevision++;
        sql.exec(
          "UPDATE workspace SET state = ?, revision = ?, structure_revision = ? WHERE id = 1",
          serialized,
          current.revision,
          current.structureRevision,
        );
      }
      sql.exec(
        "INSERT INTO commands (id, fingerprint, scope) VALUES (?, ?, ?)",
        command.id,
        fingerprint,
        scope,
      );
      result = this.envelope(scope, { ...current, state: update.state }, command.id);
      console.info(
        JSON.stringify({
          event: "workspace_command",
          commandId: command.id,
          type: command.type,
          scope,
          revision: current.revision,
          structureRevision: current.structureRevision,
          changed: update.changed,
        }),
      );
    });
    return response(result);
  }

  async fetch(request: Request): Promise<Response> {
    try {
      await this.ensureReady();
      const url = new URL(request.url);
      if (request.method === "GET" && url.pathname === "/state")
        return response(this.envelope("structural", this.read()));
      if (request.method === "GET" && url.pathname === "/active-match")
        return response(this.envelope("live", this.read()));
      if (request.method === "POST" && url.pathname === "/command") {
        const raw = await request.text();
        if (new TextEncoder().encode(raw).byteLength > MAX_STATE_BYTES)
          throw new WorkspaceError(413, "Command too large");
        try {
          return await this.execute(JSON.parse(raw));
        } catch (error) {
          if (error instanceof SyntaxError) throw new WorkspaceError(400, "Invalid command JSON");
          throw error;
        }
      }
      return new Response("Not found", { status: 404 });
    } catch (error) {
      const status = error instanceof WorkspaceError ? error.status : 500;
      if (!(error instanceof WorkspaceError))
        console.error(
          JSON.stringify({
            event: "workspace_storage_error",
            kind: error instanceof Error ? error.name : "unknown",
          }),
        );
      return new Response(
        error instanceof WorkspaceError ? error.message : "Workspace unavailable",
        { status, headers: { "Cache-Control": "no-store" } },
      );
    }
  }
}

export default {
  async fetch(_request: Request, _env: Env): Promise<Response> {
    return new Response("Not found", { status: 404 });
  },
};
