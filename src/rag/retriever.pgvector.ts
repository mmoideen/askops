import { sql } from "drizzle-orm";
import { db } from "../db/client";
import {
  getEmbeddingsProvider,
  toVectorLiteral,
  type EmbeddingsProvider,
} from "./embeddings";
import type { RetrievedChunk, RetrieveOptions, Retriever } from "./retriever";

interface Row {
  chunk_id: number;
  document_id: number;
  doc_id: string;
  title: string;
  classification: string;
  chunk_index: number;
  content: string;
  similarity: number | string;
}

export class PgVectorRetriever implements Retriever {
  readonly name = "pgvector";
  private readonly embeddings: EmbeddingsProvider;

  constructor(embeddings?: EmbeddingsProvider) {
    this.embeddings = embeddings ?? getEmbeddingsProvider();
  }

  async retrieve(
    query: string,
    options: RetrieveOptions,
  ): Promise<RetrievedChunk[]> {
    if (options.allowedClassifications.length === 0) {
      return [];
    }
    const [queryVec] = await this.embeddings.embed([query]);
    const vecLiteral = toVectorLiteral(queryVec);

    // The classification filter is part of the SQL itself. A caller cannot
    // receive rows outside its allowed classifications, and anything the
    // model later sees has already passed this filter.
    const allowedList = sql.join(
      options.allowedClassifications.map((c) => sql`${c}`),
      sql`, `,
    );
    const rows = (await db.execute(sql`
      SELECT c.id AS chunk_id,
             d.id AS document_id,
             d.doc_id,
             d.title,
             d.classification,
             c.chunk_index,
             c.content,
             1 - (c.embedding <=> ${vecLiteral}::vector) AS similarity
      FROM chunks c
      JOIN documents d ON d.id = c.document_id
      WHERE d.classification IN (${allowedList})
      ORDER BY c.embedding <=> ${vecLiteral}::vector
      LIMIT ${options.topK}
    `)) as unknown as Row[];

    return rows
      .map((r) => ({
        chunkId: Number(r.chunk_id),
        documentId: Number(r.document_id),
        docId: r.doc_id,
        title: r.title,
        classification: r.classification,
        chunkIndex: Number(r.chunk_index),
        content: r.content,
        similarity: Number(r.similarity),
      }))
      .filter((r) => r.similarity >= options.minSimilarity);
  }
}
