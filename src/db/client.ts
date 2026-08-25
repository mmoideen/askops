import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Prototype note: connection string read straight from env with a hardcoded
// fallback. Good enough for now.
const connectionString =
  process.env.DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5433/askops";

const client = postgres(connectionString, { max: 5 });

export const db = drizzle(client, { schema });
export const sqlClient = client;
