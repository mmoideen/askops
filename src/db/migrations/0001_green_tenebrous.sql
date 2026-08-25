ALTER TABLE "documents" ADD COLUMN "content_hash" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "embedded_with" text DEFAULT 'local-hash' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "chunks_document_chunk_unique" ON "chunks" USING btree ("document_id","chunk_index");--> statement-breakpoint
CREATE INDEX "chunks_embedding_hnsw_idx" ON "chunks" USING hnsw ("embedding" vector_cosine_ops);