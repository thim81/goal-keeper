import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Both processes are local. Every run gets fresh synthetic storage.
const directory = await mkdtemp(join(tmpdir(), "goal-keeper-e2e-"));
const children = [];
let stopping = false;
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  await Promise.all(
    children.map((child) =>
      child.exitCode !== null
        ? Promise.resolve()
        : new Promise((resolve) => child.once("exit", resolve)),
    ),
  );
  await rm(directory, { recursive: true, force: true });
  process.exit(code);
}
process.on("SIGINT", () => void stop());
process.on("SIGTERM", () => void stop());
function start(args) {
  const child = spawn(process.execPath, ["node_modules/wrangler/bin/wrangler.js", ...args], {
    stdio: "inherit",
    env: {
      ...process.env,
      WRANGLER_SEND_METRICS: "false",
      WRANGLER_REGISTRY_PATH: join(directory, "registry"),
    },
  });
  children.push(child);
  child.once("exit", (code) => {
    if (!stopping) void stop(code ?? 1);
  });
}
async function ready(url, options, requireSuccess = false) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, options);
      if (!requireSuccess || response.ok) return;
    } catch {
      /* Wait for the local runtime to become ready. */
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Local runtime failed to start: ${url}`);
}
try {
  start([
    "dev",
    "--config",
    "worker/wrangler.jsonc",
    "--local",
    "--var",
    "ALLOW_EMPTY_WORKSPACE:true",
    "--var",
    "WORKSPACE_ID:goal-keeper-e2e",
    "--port",
    "8791",
    "--persist-to",
    join(directory, "worker"),
  ]);
  await ready("http://127.0.0.1:8791/");
  start([
    "pages",
    "dev",
    "dist",
    "--compatibility-date",
    "2026-10-03",
    "--port",
    "8790",
    "--do",
    "WORKSPACES=Workspace@goal-keeper-workspace",
    "--binding",
    "AUTH_TOKEN=e2e-editor",
    "--binding",
    "VIEWER_TOKEN=e2e-viewer",
    "--binding",
    "WORKSPACE_ID=goal-keeper-e2e",
    "--persist-to",
    join(directory, "pages"),
  ]);
  await ready(
    "http://127.0.0.1:8790/api/state",
    { headers: { "x-auth-token": "e2e-editor", "X-Workspace-Protocol": "2" } },
    true,
  );
  console.log("Synthetic Pages and Durable Object runtime ready.");
} catch (error) {
  console.error(error);
  await stop(1);
}
