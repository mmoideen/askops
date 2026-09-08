import { defineConfig } from "@playwright/test";

// End to end smoke tests. Run `npm run build` first: the suite starts the
// production server. The dev bypass is intentionally NOT enabled here (the
// app refuses it under NODE_ENV=production).
//
// Two projects, two servers from the same build:
// - "gated": DEMO_MODE off. Covers the unauthenticated surface: health,
//   sign in redirect, API auth rejection.
// - "demo": DEMO_MODE on, the shape of the public portfolio instance.
//   Covers the automatic member session, the clearance switcher, and the
//   fact that the API still rejects callers without a session.

const sharedEnv = {
  AUTH_SECRET: "e2e-smoke-only-secret",
  LLM_PROVIDER: "mock",
  OTEL_EXPORTER: "none",
};

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  retries: 0,
  projects: [
    {
      name: "gated",
      testMatch: /smoke\.spec\.ts/,
      use: { baseURL: "http://localhost:3300" },
    },
    {
      name: "demo",
      testMatch: /demo\.spec\.ts/,
      use: { baseURL: "http://localhost:3301" },
    },
  ],
  webServer: [
    {
      command: "npx next start -p 3300",
      url: "http://localhost:3300/api/health",
      timeout: 30_000,
      reuseExistingServer: !process.env.CI,
      env: { ...sharedEnv, DEMO_MODE: "false" },
    },
    {
      command: "npx next start -p 3301",
      url: "http://localhost:3301/api/health",
      timeout: 30_000,
      reuseExistingServer: !process.env.CI,
      env: { ...sharedEnv, DEMO_MODE: "true" },
    },
  ],
});
