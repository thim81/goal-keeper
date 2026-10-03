import { defineConfig } from "vitest/config";
import { cloudflareTest } from "@cloudflare/vitest-plugin";

export default defineConfig({
  root: "./worker/test-runtime",
  plugins: [cloudflareTest({ wrangler: { configPath: "../wrangler.jsonc" } })],
  test: {
    include: ["worker/*.test.ts"],
  },
});
