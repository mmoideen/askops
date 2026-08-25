import { InMemorySpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-node";
import { beforeAll, describe, expect, it } from "vitest";
import { registerTestProvider, withSpan } from "../../src/observability/otel";
import { MockProvider } from "../../src/rag/llm";
import { runAskPipeline } from "../../src/rag/pipeline";
import type {
  RetrievedChunk,
  RetrieveOptions,
  Retriever,
} from "../../src/rag/retriever";

const exporter = new InMemorySpanExporter();

beforeAll(() => {
  registerTestProvider(new SimpleSpanProcessor(exporter));
});

class OneChunkRetriever implements Retriever {
  readonly name = "fake";
  async retrieve(
    _query: string,
    _options: RetrieveOptions,
  ): Promise<RetrievedChunk[]> {
    return [
      {
        chunkId: 1,
        documentId: 1,
        docId: "doc-1",
        title: "Doc 1",
        classification: "general",
        chunkIndex: 0,
        content: "The VPN uses port 443.",
        similarity: 0.9,
      },
    ];
  }
}

describe("tracing", () => {
  it("withSpan records attributes and ends the span", async () => {
    exporter.reset();
    const value = await withSpan("test.span", { "test.attr": "x" }, async (span) => {
      span.setAttribute("test.later", 42);
      return "done";
    });
    expect(value).toBe("done");
    const spans = exporter.getFinishedSpans();
    expect(spans).toHaveLength(1);
    expect(spans[0].name).toBe("test.span");
    expect(spans[0].attributes["test.attr"]).toBe("x");
    expect(spans[0].attributes["test.later"]).toBe(42);
  });

  it("withSpan marks errors and rethrows", async () => {
    exporter.reset();
    await expect(
      withSpan("test.error", {}, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    const spans = exporter.getFinishedSpans();
    expect(spans).toHaveLength(1);
    expect(spans[0].status.code).toBe(2);
  });

  it("an ask produces retrieve and generate spans with token and cost attributes", async () => {
    exporter.reset();
    await runAskPipeline(
      { question: "Which port does the VPN use?", role: "member" },
      { retriever: new OneChunkRetriever(), llm: new MockProvider() },
    );
    const spans = exporter.getFinishedSpans();
    const names = spans.map((s) => s.name);
    expect(names).toContain("ask.retrieve");
    expect(names).toContain("ask.generate");

    const retrieve = spans.find((s) => s.name === "ask.retrieve")!;
    expect(retrieve.attributes["askops.role"]).toBe("member");
    expect(retrieve.attributes["askops.retrieved_count"]).toBe(1);

    const generate = spans.find((s) => s.name === "ask.generate")!;
    expect(generate.attributes["gen_ai.usage.input_tokens"]).toBeTypeOf(
      "number",
    );
    expect(generate.attributes["gen_ai.usage.output_tokens"]).toBeTypeOf(
      "number",
    );
    expect(generate.attributes["askops.estimated_cost_usd"]).toBeTypeOf(
      "number",
    );
  });
});
