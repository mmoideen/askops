import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../src/auth";
import { runAskPipeline } from "../../../src/rag/pipeline";

export const runtime = "nodejs";

// Authenticated ask endpoint. The session is checked here (in addition to
// the middleware) and the role used for retrieval scoping comes exclusively
// from the server side session token, never from the request body.

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const question = (body as { question?: unknown })?.question;
  if (typeof question !== "string" || question.trim().length < 3) {
    return NextResponse.json(
      { error: "question must be a string of at least 3 characters" },
      { status: 400 },
    );
  }

  try {
    const result = await runAskPipeline({
      question: question.trim(),
      role: session.user.role,
    });

    return NextResponse.json({
      answer: result.answer,
      refused: result.refused,
      sources: result.sources,
      citedChunkIds: result.citedChunkIds,
      meta: {
        model: result.model,
        totalMs: result.totalMs,
      },
    });
  } catch (err) {
    console.error("ask pipeline failed", err);
    return NextResponse.json(
      { error: "The assistant is unavailable right now. Try again shortly." },
      { status: 502 },
    );
  }
}
