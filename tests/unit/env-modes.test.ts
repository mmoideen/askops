// The two special sign in flags have opposite production semantics:
// AUTH_DEV_BYPASS must refuse to boot in production, while DEMO_MODE is a
// deliberate, documented production affordance for demo deployments. These
// tests pin that distinction by re-importing the env module under
// different environments.
import { afterEach, describe, expect, it, vi } from "vitest";

const BASE_ENV = { ...process.env };

function resetEnv(overrides: Record<string, string | undefined>) {
  process.env = { ...BASE_ENV };
  delete process.env.AUTH_DEV_BYPASS;
  delete process.env.DEMO_MODE;
  delete process.env.VERCEL_ENV;
  delete process.env.NEXT_PHASE;
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

async function loadEnvModule() {
  vi.resetModules();
  return import("../../src/config/env");
}

afterEach(() => {
  process.env = { ...BASE_ENV };
});

describe("sign in mode flags", () => {
  it("parses DEMO_MODE and defaults it off", async () => {
    resetEnv({});
    const { env } = await loadEnvModule();
    expect(env.DEMO_MODE).toBe(false);

    resetEnv({ DEMO_MODE: "true" });
    const { env: envOn } = await loadEnvModule();
    expect(envOn.DEMO_MODE).toBe(true);
  });

  it("refuses to boot with AUTH_DEV_BYPASS in a production environment", async () => {
    resetEnv({ AUTH_DEV_BYPASS: "true", VERCEL_ENV: "production" });
    await expect(loadEnvModule()).rejects.toThrow(
      /AUTH_DEV_BYPASS must never be enabled in production/,
    );
  });

  it("allows DEMO_MODE in a production environment", async () => {
    resetEnv({
      DEMO_MODE: "true",
      VERCEL_ENV: "production",
      LLM_PROVIDER: "mock",
    });
    const { env } = await loadEnvModule();
    expect(env.DEMO_MODE).toBe(true);
  });
});
