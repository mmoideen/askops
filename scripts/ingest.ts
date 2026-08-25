// Prototype ingest: wipes the tables and reloads everything from data/corpus.
// Chunks by paragraph groups up to ~1000 chars. No incremental logic yet.
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { db, sqlClient } from "../src/db/client";
import { documents } from "../src/db/schema";
import { embed, toVectorLiteral } from "../src/lib/embed";
import { sql } from "drizzle-orm";

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

function chunkText(body: string): string[] {
  const paragraphs = body.split(/\n\n+/);
  const out: string[] = [];
  let current = "";
  for (const p of paragraphs) {
    if (current.length + p.length > 1000 && current.length > 0) {
      out.push(current.trim());
      current = "";
    }
    current += p + "\n\n";
  }
  if (current.trim().length > 0) out.push(current.trim());
  return out;
}

async function main() {
  const corpusDir = join(process.cwd(), "data", "corpus");
  const files = readdirSync(corpusDir).filter((f) => f.endsWith(".md"));
  console.log(`Found ${files.length} corpus files`);

  // Wipe and reload. Crude but effective for a prototype.
  await db.execute(sql`TRUNCATE TABLE chunks, documents RESTART IDENTITY CASCADE`);

  let totalChunks = 0;
  for (const file of files) {
    const raw = readFileSync(join(corpusDir, file), "utf8");
    const doc = parseFrontmatter(raw, file.replace(/\.md$/, ""));
    const [inserted] = await db
      .insert(documents)
      .values({
        docId: doc.docId,
        title: doc.title,
        classification: doc.classification,
        owner: doc.owner,
        content: doc.body,
      })
      .returning({ id: documents.id });

    const parts = chunkText(doc.body);
    for (let i = 0; i < parts.length; i++) {
      const vec = embed(doc.title + "\n" + parts[i]);
      await db.execute(sql`
        INSERT INTO chunks (document_id, chunk_index, content, embedding)
        VALUES (${inserted.id}, ${i}, ${parts[i]}, ${toVectorLiteral(vec)}::vector)
      `);
      totalChunks++;
    }
    console.log(`Ingested ${doc.docId} (${parts.length} chunks, ${doc.classification})`);
  }

  console.log(`Done. ${files.length} documents, ${totalChunks} chunks.`);
  await sqlClient.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
