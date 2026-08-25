import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../src/auth";
import {
  currentTraceId,
  forceFlushTracing,
  withSpan,
} from "../../../src/observability/otel";
import { writeAuditEntry } from "../../../src/observability/audit";
import { askRequestSchema } from "../../../src/rag/guardrails";
import { runAskPipeline } from "../../../src/rag/pipeline";
import { getRateLimiter } from "../../../src/ratelimit/limiter";

export const runtime = "nodejs";

// Authenticated ask endpoint. The session is checked here (in addition to
// the middleware) and the role used for retrieval scoping comes exclusively
// from the server side session token, never from the request body. Every
// accepted ask produces one trace (request, retrieve, generate spans) and
// one audit log row, and spans are flushed before the response returns
// because serverless instances may freeze immediately afterward.

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
    return await withSpan(
      "ask.request",
      {
        "askops.user_id": session.user.id,
        "askops.role": session.user.role,
      },
      async (span) => {
        const traceId = currentTraceId(span);
        const result = await runAskPipeline({
          question: parsed.data.question,
          role: session.user.role,
        });

        span.setAttribute("askops.refused", result.refused);
        span.setAttribute("askops.injection_flagged", result.injection.flagged);
        span.setAttribute("gen_ai.usage.input_tokens", result.inputTokens);
        span.setAttribute("gen_ai.usage.output_tokens", result.outputTokens);
        span.setAttribute("askops.estimated_cost_usd", result.estimatedCostUsd);
        span.setAttribute("askops.latency_ms", result.totalMs);

        await writeAuditEntry({
          userId: session.user.id,
          role: session.user.role,
          question: parsed.data.question,
          refused: result.refused,
          retrievedChunkIds: result.retrievedChunkIds,
          citedChunkIds: result.citedChunkIds,
          injectionFlagged: result.injection.flagged,
          injectionLabels: result.injection.labels,
          model: result.model,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          estimatedCostUsd: result.estimatedCostUsd,
          latencyMs: result.totalMs,
          traceId,
        });

        return NextResponse.json({
          answer: result.answer,
          refused: result.refused,
          sources: result.sources,
          citedChunkIds: result.citedChunkIds,
          // Echoed back so the caller can distinguish an injection block from
          // an ordinary "nothing retrieved" refusal. This only reports on the
          // caller's own input and reveals no corpus or policy detail.
          injection: {
            flagged: result.injection.flagged,
            labels: result.injection.labels,
          },
          meta: {
            model: result.model,
            totalMs: result.totalMs,
            traceId,
          },
        });
      },
    );
  } catch (err) {
    console.error("ask pipeline failed", err);
    return NextResponse.json(
      { error: "The assistant is unavailable right now. Try again shortly." },
      { status: 502 },
    );
  } finally {
    await forceFlushTracing();
  }
}
