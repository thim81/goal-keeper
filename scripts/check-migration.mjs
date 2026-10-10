import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { experimental_readRawConfig } from "wrangler";

try {
  const [file, mode, extra] = process.argv.slice(2);
  if (!file || extra || (mode && mode !== "--state-only"))
    throw new Error("Usage: npm run check:migration -- <export.json> [--state-only]");
  let raw = await readFile(file, "utf8");
  let source;
  try {
    source = JSON.parse(raw);
  } catch {
    throw new Error("Legacy workspace is not valid JSON");
  }
  const backup = source?.version === 1 && source?.state;
  if (backup) raw = JSON.stringify(source.state);

  // Compile the shared TypeScript validator using the already installed build tool.
  const [bundle] = await build({
    configFile: false,
    logLevel: "silent",
    resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
    build: {
      write: false,
      minify: false,
      lib: {
        entry: fileURLToPath(new URL("../src/lib/workspace-migration.ts", import.meta.url)),
        formats: ["es"],
      },
    },
  });
  const { parseMigrationState } = await import(
    `data:text/javascript;base64,${Buffer.from(bundle.output[0].code).toString("base64")}`
  );
  const state = parseMigrationState(raw);
  console.log(
    `Workspace data valid (${new TextEncoder().encode(JSON.stringify(state)).byteLength} normalized bytes).`,
  );
  if (backup)
    console.log(
      "Checked an app backup. Repeat with the exact KV export before production cutover.",
    );

  if (mode !== "--state-only") {
    const path = fileURLToPath(new URL("../worker/wrangler.jsonc", import.meta.url));
    let config;
    try {
      ({ rawConfig: config } = experimental_readRawConfig({ config: path }));
    } catch {
      throw new Error("Worker configuration is invalid; check worker/wrangler.jsonc");
    }
    const namespace = config.kv_namespaces?.find((binding) => binding.binding === "GOALKEEPER_KV");
    if (!namespace || !/^[a-f0-9]{32}$/i.test(namespace.id ?? ""))
      throw new Error(
        "Replace the placeholder GOALKEEPER_KV namespace ID in worker/wrangler.jsonc with the existing namespace ID",
      );
    if (config.vars?.ALLOW_EMPTY_WORKSPACE === "true")
      throw new Error("Set ALLOW_EMPTY_WORKSPACE to false before production cutover");
    console.log(
      "Local configuration valid. Verify KV access and migration in an isolated runtime before cutover.",
    );
  }
} catch (error) {
  console.error(`Migration preflight failed: ${error.message}`);
  process.exitCode = 1;
}
