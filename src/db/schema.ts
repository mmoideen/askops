import {
  bigint,
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  vector,
} from "drizzle-orm/pg-core";

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  docId: text("doc_id").notNull().unique(),
  title: text("title").notNull(),
  classification: text("classification").notNull().default("general"),
  owner: text("owner"),
  content: text("content").notNull(),
  // Hash of the source file content plus embedding provider. Ingest skips
  // documents whose hash is unchanged, which is what makes re-runs
  // idempotent.
  contentHash: text("content_hash").notNull().default(""),
  embeddedWith: text("embedded_with").notNull().default("local-hash"),
});

export const chunks = pgTable(
  "chunks",
  {
    id: serial("id").primaryKey(),
    documentId: integer("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: 1536 }),
  },
  (t) => [
    uniqueIndex("chunks_document_chunk_unique").on(t.documentId, t.chunkIndex),
    index("chunks_embedding_hnsw_idx").using(
      "hnsw",
      t.embedding.op("vector_cosine_ops"),
    ),
  ],
);

// Sliding window store for the postgres rate limiter. Rows expire after 60
// seconds and are pruned opportunistically on each check.
export const rateLimitEvents = pgTable(
  "rate_limit_events",
  {
    id: serial("id").primaryKey(),
    key: text("key").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("rate_limit_events_key_at_idx").on(t.key, t.at)],
);

// One row per ask. Questions are PII redacted before insert. Costs are
// stored as integer micro USD to avoid float drift in aggregates.
export const auditLog = pgTable(
  "audit_log",
  {
    id: serial("id").primaryKey(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    userId: text("user_id").notNull(),
    role: text("role").notNull(),
    question: text("question").notNull(),
    refused: boolean("refused").notNull(),
    retrievedChunkIds: integer("retrieved_chunk_ids").array().notNull(),
    citedChunkIds: integer("cited_chunk_ids").array().notNull(),
    injectionFlagged: boolean("injection_flagged").notNull().default(false),
    injectionLabels: text("injection_labels").array().notNull(),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").notNull(),
    outputTokens: integer("output_tokens").notNull(),
    estimatedCostMicroUsd: bigint("estimated_cost_micro_usd", {
      mode: "number",
    }).notNull(),
    latencyMs: integer("latency_ms").notNull(),
    traceId: text("trace_id").notNull(),
  },
  (t) => [
    index("audit_log_at_idx").on(t.at),
    index("audit_log_user_idx").on(t.userId, t.at),
  ],
);
