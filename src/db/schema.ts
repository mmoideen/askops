import {
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
