import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // `server-only` throws when imported outside an RSC bundler. Stub it in tests.
      "server-only": path.resolve(__dirname, "./tests/stubs/empty.ts"),
    },
  },
});
