import { defineConfig } from "@playwright/test";

// End to end smoke tests. Run `npm run build` first: the suite starts the
// production server. The dev bypass is intentionally NOT enabled here (the
// app refuses it under NODE_ENV=production), so the suite covers the
// unauthenticated surface: health, sign in redirect, API auth rejection.

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: "http://localhost:3300",
  },
  webServer: {
    command: "npx next start -p 3300",
    url: "http://localhost:3300/api/health",
    timeout: 30_000,
    reuseExistingServer: !process.env.CI,
    env: {
      AUTH_SECRET: "e2e-smoke-only-secret",
      LLM_PROVIDER: "mock",
      OTEL_EXPORTER: "none",
    },
  },
});
