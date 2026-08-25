import {
  integer,
  pgTable,
  serial,
  text,
  vector,
} from "drizzle-orm/pg-core";

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  docId: text("doc_id").notNull().unique(),
  title: text("title").notNull(),
  classification: text("classification").notNull().default("general"),
  owner: text("owner"),
  content: text("content").notNull(),
});

export const chunks = pgTable("chunks", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  chunkIndex: integer("chunk_index").notNull(),
  content: text("content").notNull(),
  embedding: vector("embedding", { dimensions: 1536 }),
});
