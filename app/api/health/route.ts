import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "../../../src/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public health check for load balancers and uptime monitors. Reports
// component status without leaking configuration details.

export async function GET() {
  let dbStatus: "up" | "down" = "down";
  try {
    await Promise.race([
      db.execute(sql`SELECT 1`),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("db health check timeout")), 3000),
      ),
    ]);
    dbStatus = "up";
  } catch {
    dbStatus = "down";
  }

  const healthy = dbStatus === "up";
  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      db: dbStatus,
      time: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 },
  );
}
