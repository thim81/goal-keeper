/// <reference types="node" />
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  rmSync,
  mkdirSync,
  copyFileSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { createEmptyWorkspace } from "./workspace";

describe("migration export preflight", () => {
  it.each(["KV", "backup"])(
    "validates a %s export without changing it or exposing credentials",
    (format) => {
      const directory = mkdtempSync(join(tmpdir(), "goal-keeper-migration-check-"));
      try {
        const state = createEmptyWorkspace(100);
        state.settings.syncToken = "synthetic-private-token";
        const raw = JSON.stringify(
          format === "KV" ? state : { version: 1, exportedAt: "2026-10-06", state },
        );
        const file = join(directory, "export.json");
        writeFileSync(file, raw);
        const result = spawnSync(
          process.execPath,
          ["scripts/check-migration.mjs", file, "--state-only"],
          { encoding: "utf8" },
        );
        expect(result.status, result.stderr).toBe(0);
        expect(result.stdout).toContain("Workspace data valid");
        expect(result.stdout + result.stderr).not.toContain("synthetic-private-token");
        expect(readFileSync(file, "utf8")).toBe(raw);
        if (format === "backup") expect(result.stdout).toContain("exact KV export");
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    },
  );
  it("rejects invalid source with a useful error and does not echo its contents", () => {
    const directory = mkdtempSync(join(tmpdir(), "goal-keeper-migration-check-"));
    try {
      const file = join(directory, "export.json");
      writeFileSync(file, "synthetic-private-token");
      const result = spawnSync(
        process.execPath,
        ["scripts/check-migration.mjs", file, "--state-only"],
        { encoding: "utf8" },
      );
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("not valid JSON");
      expect(result.stdout + result.stderr).not.toContain("synthetic-private-token");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it.each([
    ["valid", "0".repeat(32), "false", 0, "Local configuration valid"],
    ["placeholder", "legacy-state", "false", 1, "Replace the placeholder"],
    ["empty production", "0".repeat(32), "true", 1, "ALLOW_EMPTY_WORKSPACE"],
  ])(
    "checks isolated %s configuration without touching deployment resources",
    (_name, id, allowEmpty, status, message) => {
      const directory = mkdtempSync(join(tmpdir(), "goal-keeper-migration-config-"));
      try {
        mkdirSync(join(directory, "scripts"));
        mkdirSync(join(directory, "worker"));
        copyFileSync("scripts/check-migration.mjs", join(directory, "scripts/check-migration.mjs"));
        symlinkSync(join(process.cwd(), "src"), join(directory, "src"), "dir");
        symlinkSync(join(process.cwd(), "node_modules"), join(directory, "node_modules"), "dir");
        writeFileSync(
          join(directory, "worker/wrangler.jsonc"),
          `// Synthetic configuration with JSONC comments
${JSON.stringify({ kv_namespaces: [{ binding: "GOALKEEPER_KV", id }], vars: { ALLOW_EMPTY_WORKSPACE: allowEmpty } })}`,
        );
        const file = join(directory, "export.json");
        writeFileSync(file, JSON.stringify(createEmptyWorkspace(100)));
        const result = spawnSync(
          process.execPath,
          [join(directory, "scripts/check-migration.mjs"), file],
          { encoding: "utf8" },
        );
        expect(result.status, result.stderr).toBe(status);
        expect(result.stdout + result.stderr).toContain(message);
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    },
  );
});
