import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../src/auth";
import { askRequestSchema } from "../../../src/rag/guardrails";
import { runAskPipeline } from "../../../src/rag/pipeline";
import { getRateLimiter } from "../../../src/ratelimit/limiter";

export const runtime = "nodejs";

// Authenticated ask endpoint. The session is checked here (in addition to
// the middleware) and the role used for retrieval scoping comes exclusively
// from the server side session token, never from the request body.

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rate = await getRateLimiter().check(`ask:${session.user.id}`);
  if (!rate.allowed) {
    return NextResponse.json(
      {
        error: `Rate limit exceeded. Try again in ${rate.retryAfterSeconds} seconds.`,
      },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = askRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  try {
    const result = await runAskPipeline({
      question: parsed.data.question,
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
