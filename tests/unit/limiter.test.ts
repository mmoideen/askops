import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { db, sqlClient } from "../../src/db/client";
import {
  MemoryRateLimiter,
  PostgresRateLimiter,
} from "../../src/ratelimit/limiter";

afterAll(async () => {
  await db.execute(sql`DELETE FROM rate_limit_events WHERE key LIKE 'test:%'`);
  await sqlClient.end();
});

describe("memory rate limiter", () => {
  it("allows up to the limit and then blocks", async () => {
    const limiter = new MemoryRateLimiter(3);
    expect((await limiter.check("u1")).allowed).toBe(true);
    expect((await limiter.check("u1")).allowed).toBe(true);
    expect((await limiter.check("u1")).allowed).toBe(true);
    const blocked = await limiter.check("u1");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("tracks keys independently", async () => {
    const limiter = new MemoryRateLimiter(1);
    expect((await limiter.check("a")).allowed).toBe(true);
    expect((await limiter.check("b")).allowed).toBe(true);
    expect((await limiter.check("a")).allowed).toBe(false);
  });

  it("reports remaining allowance", async () => {
    const limiter = new MemoryRateLimiter(5);
    const first = await limiter.check("c");
    expect(first.remaining).toBe(4);
  });
});

describe("postgres rate limiter", () => {
  it("allows up to the limit and then blocks, per key", async () => {
    const limiter = new PostgresRateLimiter(2);
    const key = `test:pg-${Date.now()}`;
    expect((await limiter.check(key)).allowed).toBe(true);
    expect((await limiter.check(key)).allowed).toBe(true);
    const blocked = await limiter.check(key);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);

    const otherKey = `test:pg-other-${Date.now()}`;
    expect((await limiter.check(otherKey)).allowed).toBe(true);
  });
});
