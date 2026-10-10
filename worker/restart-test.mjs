import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(new URL("./test-runtime/package.json", import.meta.url));
const { Miniflare } = require("miniflare");
const esbuild = require("esbuild");

const { outputFiles } = await esbuild.build({
  absWorkingDir: root,
  entryPoints: ["worker/workspace.ts"],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  external: ["cloudflare:workers"],
  write: false,
});
const script = outputFiles[0].text;
const persistence = await mkdtemp(join(tmpdir(), "goal-keeper-worker-restart-"));
const config = {
  name: "goal-keeper-workspace",
  compatibilityDate: "2026-10-03",
  compatibilityFlags: ["nodejs_compat"],
  env: {
    ALLOW_EMPTY_WORKSPACE: { type: "text", value: "true" },
    WORKSPACE_ID: { type: "text", value: "goal-keeper-restart-test" },
    GOALKEEPER_KV: { type: "kv", id: "legacy-state" },
    WORKSPACES: { type: "durable-object", worker: "goal-keeper-workspace", exportName: "Workspace" },
  },
  exports: { Workspace: { type: "durable-object", storage: "sqlite" } },
  manifest: { mainModule: "index.js", modules: { "index.js": { type: "esm", contents: script } } },
};
const options = {
  workers: [{ config }],
  resourcePersistencePath: persistence,
};

async function response(stub, path, command) {
  return stub.fetch(`http://workspace${path}`, command ? {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(command),
  } : undefined);
}

let runtime;
try {
  runtime = new Miniflare(options);
  const namespace = await runtime.getDurableObjectNamespace("WORKSPACES");
  const id = namespace.idFromName("goal-keeper-restart-test");
  const stub = namespace.get(id);
  const startedResponse = await response(stub, "/command", { id: "start", type: "start-match", payload: { isHome: true } });
  assert.equal(startedResponse.status, 200);
  const started = await startedResponse.json();
  const matchId = started.state.activeMatch.id;
  const command = { id: "persisted-goal", type: "add-goal", matchId, payload: { team: "my-team", scorer: "Alex" } };
  const first = await response(stub, "/command", command);
  assert.equal(first.status, 200);
  const firstBody = await first.json();
  assert.equal(firstBody.revision, 2);
  await runtime.dispose();
  runtime = undefined;

  runtime = new Miniflare(options);
  const restartedNamespace = await runtime.getDurableObjectNamespace("WORKSPACES");
  const restartedStub = restartedNamespace.get(restartedNamespace.idFromName("goal-keeper-restart-test"));
  const beforeRetry = await (await response(restartedStub, "/state")).json();
  assert.equal(beforeRetry.revision, 2);
  assert.equal(beforeRetry.state.activeMatch.goals.filter((goal) => goal.id === "persisted-goal:goal").length, 1);
  const retry = await response(restartedStub, "/command", command);
  assert.equal(retry.status, 200);
  assert.deepEqual(await retry.json(), { ...firstBody, revision: 2 });
  const conflict = await response(restartedStub, "/command", { ...command, payload: { team: "opponent" } });
  assert.equal(conflict.status, 409);
  assert.equal((await (await response(restartedStub, "/state")).json()).revision, 2);
  console.log("Worker restart test passed: SQLite state and command dedup survived runtime recreation.");
} finally {
  if (runtime) await runtime.dispose();
  await rm(persistence, { recursive: true, force: true });
}
