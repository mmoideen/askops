// Idempotent corpus ingestion.
//
// Each document's source content is hashed together with the active
// embedding provider name. A document whose hash is unchanged is skipped
// entirely. A changed or new document is replaced atomically (delete plus
// reinsert in one transaction, chunks cascade). Documents that no longer
// exist in data/corpus are removed. Running ingest twice in a row therefore
// produces zero writes on the second run.
import { createHash } from "crypto";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { eq, notInArray, sql } from "drizzle-orm";
import { db, sqlClient } from "../src/db/client";
import { documents } from "../src/db/schema";
import { getEmbeddingsProvider, toVectorLiteral } from "../src/rag/embeddings";

interface ParsedDoc {
  docId: string;
  title: string;
  classification: string;
  owner: string;
  body: string;
}

function parseFrontmatter(raw: string, fallbackId: string): ParsedDoc {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  const meta: Record<string, string> = {};
  let body = raw;
  if (match) {
    body = raw.slice(match[0].length);
    for (const line of match[1].split("\n")) {
      const idx = line.indexOf(":");
      if (idx > 0) {
        meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
      }
    }
  }
  return {
    docId: meta.id ?? fallbackId,
    title: meta.title ?? fallbackId,
    classification: meta.classification ?? "general",
    owner: meta.owner ?? "",
    body: body.trim(),
  };
}

interface Chunk {
  heading: string;
  content: string;
}

const MAX_CHUNK_CHARS = 900;

// Heading aware chunking: split on ## sections, then pack paragraphs into
// blocks of at most MAX_CHUNK_CHARS. Every chunk is prefixed with its
// document title and section heading so both retrieval and the model see
// the provenance context.
export function chunkDocument(title: string, body: string): Chunk[] {
  interface Section {
    heading: string;
    paragraphs: string[];
  }
  const sections: Section[] = [];
  let current: Section = { heading: "Overview", paragraphs: [] };
  for (const block of body.split(/\n\n+/)) {
    const trimmed = block.trim();
    if (trimmed.length === 0) continue;
    const headingMatch = trimmed.match(/^##\s+(.+)$/m);
    if (trimmed.startsWith("## ")) {
      if (current.paragraphs.length > 0) sections.push(current);
      const heading = headingMatch ? headingMatch[1].trim() : "Section";
      const rest = trimmed.replace(/^##\s+.+$/m, "").trim();
      current = { heading, paragraphs: rest ? [rest] : [] };
    } else {
      current.paragraphs.push(trimmed);
    }
  }
  if (current.paragraphs.length > 0) sections.push(current);

  const chunks: Chunk[] = [];
  for (const section of sections) {
    let buffer = "";
    const flush = () => {
      if (buffer.trim().length === 0) return;
      chunks.push({
        heading: section.heading,
        content: `# ${title}\n## ${section.heading}\n\n${buffer.trim()}`,
      });
      buffer = "";
    };
    for (const paragraph of section.paragraphs) {
      if (
        buffer.length > 0 &&
        buffer.length + paragraph.length > MAX_CHUNK_CHARS
      ) {
        flush();
      }
      buffer += paragraph + "\n\n";
    }
    flush();
  }
  return chunks;
}

async function main() {
  const corpusDir = join(process.cwd(), "data", "corpus");
  const files = readdirSync(corpusDir)
    .filter((f) => f.endsWith(".md"))
    .sort();
  const embeddings = getEmbeddingsProvider();
  console.log(
    `Ingesting ${files.length} corpus files with embeddings provider "${embeddings.name}"`,
  );

  const seenDocIds: string[] = [];
  let inserted = 0;
  let skipped = 0;

  for (const file of files) {
    const raw = readFileSync(join(corpusDir, file), "utf8");
    const doc = parseFrontmatter(raw, file.replace(/\.md$/, ""));
    seenDocIds.push(doc.docId);

    const contentHash = createHash("sha256")
      .update(raw)
      .update(embeddings.name)
      .digest("hex");

    const existing = await db
      .select({
        id: documents.id,
        contentHash: documents.contentHash,
      })
      .from(documents)
      .where(eq(documents.docId, doc.docId));

    if (existing.length > 0 && existing[0].contentHash === contentHash) {
      skipped++;
      continue;
    }

    const parts = chunkDocument(doc.title, doc.body);
    const vectors = await embeddings.embed(parts.map((p) => p.content));

    await db.transaction(async (tx) => {
      if (existing.length > 0) {
        await tx.delete(documents).where(eq(documents.docId, doc.docId));
      }
      const [insertedDoc] = await tx
        .insert(documents)
        .values({
          docId: doc.docId,
          title: doc.title,
          classification: doc.classification,
          owner: doc.owner,
          content: doc.body,
          contentHash,
          embeddedWith: embeddings.name,
        })
        .returning({ id: documents.id });

      for (let i = 0; i < parts.length; i++) {
        await tx.execute(sql`
          INSERT INTO chunks (document_id, chunk_index, content, embedding)
          VALUES (${insertedDoc.id}, ${i}, ${parts[i].content}, ${toVectorLiteral(vectors[i])}::vector)
        `);
      }
    });
    inserted++;
    console.log(
      `Ingested ${doc.docId} (${parts.length} chunks, ${doc.classification})`,
    );
  }

  // Remove documents whose source files are gone.
  const stale =
    seenDocIds.length > 0
      ? await db
          .delete(documents)
          .where(notInArray(documents.docId, seenDocIds))
          .returning({ docId: documents.docId })
      : [];
  for (const s of stale) {
    console.log(`Removed stale document ${s.docId}`);
  }

  console.log(
    `Done. ${inserted} ingested, ${skipped} unchanged, ${stale.length} removed.`,
  );
  await sqlClient.end();
}

const isDirectRun = process.argv[1]?.includes("ingest");
if (isDirectRun) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
