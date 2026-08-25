// Prototype ask endpoint. Everything happens inline here: embed the question,
// grab the top 5 chunks, stuff them into a prompt, call the model.
// No auth, no role filtering, no validation, no rate limit, no telemetry yet.
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { sql } from "drizzle-orm";
import { db } from "../../../src/db/client";
import { embed, toVectorLiteral } from "../../../src/lib/embed";

export const runtime = "nodejs";

interface RetrievedChunk {
  id: number;
  content: string;
  doc_id: string;
  title: string;
  classification: string;
  similarity: number;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const question: string = body.question;

  const qVec = embed(question);
  const result = await db.execute(sql`
    SELECT c.id, c.content, d.doc_id, d.title, d.classification,
           1 - (c.embedding <=> ${toVectorLiteral(qVec)}::vector) AS similarity
    FROM chunks c
    JOIN documents d ON d.id = c.document_id
    ORDER BY c.embedding <=> ${toVectorLiteral(qVec)}::vector
    LIMIT 5
  `);
  const retrieved = result as unknown as RetrievedChunk[];

  const context = retrieved
    .map((r, i) => `[${i + 1}] (${r.title})\n${r.content}`)
    .join("\n\n");

  let answer: string;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    const client = new Anthropic({ apiKey });
    const model = process.env.LLM_MODEL || "claude-sonnet-5";
    const msg = await client.messages.create({
      model,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `Answer the question using the context below. Cite sources like [1].\n\nContext:\n${context}\n\nQuestion: ${question}`,
        },
      ],
    });
    answer = msg.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("");
  } else {
    // No API key: return the best matching chunk as an extractive answer.
    answer =
      retrieved.length > 0
        ? `From "${retrieved[0].title}" [1]:\n\n${retrieved[0].content}`
        : "No matching documents found.";
  }

  return NextResponse.json({
    answer,
    sources: retrieved.map((r, i) => ({
      ref: i + 1,
      chunkId: r.id,
      docId: r.doc_id,
      title: r.title,
      similarity: Number(r.similarity),
    })),
  });
}
