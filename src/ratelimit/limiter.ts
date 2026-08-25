import { sql } from "drizzle-orm";
import { env } from "../config/env";
import { db } from "../db/client";

// Per user rate limiting behind an interface.
//
// The in memory limiter is correct for a single long lived process (local
// dev, tests). On Vercel, instances are ephemeral and concurrent, so memory
// is not a shared store; the postgres limiter keeps the sliding window in
// the database the app already has, which keeps the production path honest
// without adding another service. Selection is by RATE_LIMIT_STORE.

export interface RateLimitVerdict {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export interface RateLimiter {
  readonly name: string;
  check(key: string): Promise<RateLimitVerdict>;
}

const WINDOW_MS = 60_000;

export class MemoryRateLimiter implements RateLimiter {
  readonly name = "memory";
  private readonly hits = new Map<string, number[]>();

  constructor(private readonly limitPerMinute: number) {}

  async check(key: string): Promise<RateLimitVerdict> {
    const now = Date.now();
    const cutoff = now - WINDOW_MS;
    const recent = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
    if (recent.length >= this.limitPerMinute) {
      const oldest = Math.min(...recent);
      this.hits.set(key, recent);
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((oldest + WINDOW_MS - now) / 1000),
        ),
      };
    }
    recent.push(now);
    this.hits.set(key, recent);
    return {
      allowed: true,
      remaining: this.limitPerMinute - recent.length,
      retryAfterSeconds: 0,
    };
  }
}

export class PostgresRateLimiter implements RateLimiter {
  readonly name = "postgres";

  constructor(private readonly limitPerMinute: number) {}

  async check(key: string): Promise<RateLimitVerdict> {
    // Prune expired events for this key, then count and insert atomically
    // enough for a per user limit (a small overshoot under a race is
    // acceptable; the limit exists to stop abuse, not to bill).
    await db.execute(sql`
      DELETE FROM rate_limit_events
      WHERE key = ${key} AND at < now() - interval '60 seconds'
    `);
    const rows = (await db.execute(sql`
      SELECT count(*)::int AS count FROM rate_limit_events WHERE key = ${key}
    `)) as unknown as { count: number }[];
    const count = Number(rows[0]?.count ?? 0);
    if (count >= this.limitPerMinute) {
      const oldestRows = (await db.execute(sql`
        SELECT extract(epoch FROM (min(at) + interval '60 seconds' - now()))::int AS wait
        FROM rate_limit_events WHERE key = ${key}
      `)) as unknown as { wait: number }[];
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Number(oldestRows[0]?.wait ?? 60)),
      };
    }
    await db.execute(sql`
      INSERT INTO rate_limit_events (key) VALUES (${key})
    `);
    return {
      allowed: true,
      remaining: this.limitPerMinute - count - 1,
      retryAfterSeconds: 0,
    };
  }
}

let limiterSingleton: RateLimiter | null = null;

export function getRateLimiter(): RateLimiter {
  if (!limiterSingleton) {
    limiterSingleton =
      env.RATE_LIMIT_STORE === "postgres"
        ? new PostgresRateLimiter(env.RATE_LIMIT_PER_MINUTE)
        : new MemoryRateLimiter(env.RATE_LIMIT_PER_MINUTE);
  }
  return limiterSingleton;
}
