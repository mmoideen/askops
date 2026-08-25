// Proves at the database level that a member can never retrieve restricted
// chunks. Inserts its own marker documents (one general, one restricted,
// each containing a token that appears nowhere else), runs real pgvector
// retrieval through the production retriever, and asserts on classification.
// Requires the local Postgres from docker compose (or the CI service).
import { inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, sqlClient } from "../../src/db/client";
import { documents } from "../../src/db/schema";
import {
  LocalHashEmbeddings,
  toVectorLiteral,
} from "../../src/rag/embeddings";
import { PgVectorRetriever } from "../../src/rag/retriever.pgvector";

const MARKER = "zephyrquartz";
const TEST_DOC_IDS = ["test-rbac-general", "test-rbac-restricted"];

const embeddings = new LocalHashEmbeddings();

async function insertTestDoc(
  docId: string,
  classification: string,
  content: string,
) {
  const [doc] = await db
    .insert(documents)
    .values({
      docId,
      title: `Test ${classification}`,
      classification,
      owner: "test",
      content,
      contentHash: `test-${docId}`,
      embeddedWith: embeddings.name,
    })
    .returning({ id: documents.id });
  const [vec] = await embeddings.embed([content]);
  await db.execute(sql`
    INSERT INTO chunks (document_id, chunk_index, content, embedding)
    VALUES (${doc.id}, 0, ${content}, ${toVectorLiteral(vec)}::vector)
  `);
}

beforeAll(async () => {
  await db.delete(documents).where(inArray(documents.docId, TEST_DOC_IDS));
  await insertTestDoc(
    "test-rbac-general",
    "general",
    `The ${MARKER} process for general staff requires a standard request form.`,
  );
  await insertTestDoc(
    "test-rbac-restricted",
    "restricted",
    `The ${MARKER} process escalation path pages the security desk directly.`,
  );
});

afterAll(async () => {
  await db.delete(documents).where(inArray(documents.docId, TEST_DOC_IDS));
  await sqlClient.end();
});

describe("rbac enforced inside retrieval", () => {
  const retriever = new PgVectorRetriever(embeddings);

  it("member retrieval never returns restricted chunks", async () => {
    const results = await retriever.retrieve(`${MARKER} process`, {
      allowedClassifications: ["general"],
      topK: 10,
      minSimilarity: 0,
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.classification === "general")).toBe(true);
    expect(
      results.some((r) => r.docId === "test-rbac-restricted"),
    ).toBe(false);
  });

  it("ops_admin retrieval includes restricted chunks", async () => {
    const results = await retriever.retrieve(`${MARKER} process escalation`, {
      allowedClassifications: ["general", "restricted"],
      topK: 10,
      minSimilarity: 0,
    });
    expect(
      results.some((r) => r.classification === "restricted"),
    ).toBe(true);
  });

  it("empty classification allowlist retrieves nothing", async () => {
    const results = await retriever.retrieve(`${MARKER}`, {
      allowedClassifications: [],
      topK: 10,
      minSimilarity: 0,
    });
    expect(results).toEqual([]);
  });
});
