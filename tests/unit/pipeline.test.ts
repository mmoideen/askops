import { describe, expect, it } from "vitest";
import { MockProvider, REFUSAL_TEXT } from "../../src/rag/llm";
import { runAskPipeline } from "../../src/rag/pipeline";
import type {
  RetrievedChunk,
  RetrieveOptions,
  Retriever,
} from "../../src/rag/retriever";

class FakeRetriever implements Retriever {
  readonly name = "fake";
  constructor(private readonly chunks: RetrievedChunk[]) {}
  lastOptions: RetrieveOptions | null = null;
  async retrieve(
    _query: string,
    options: RetrieveOptions,
  ): Promise<RetrievedChunk[]> {
    this.lastOptions = options;
    return this.chunks.filter((c) =>
      (options.allowedClassifications as readonly string[]).includes(
        c.classification,
      ),
    );
  }
}

function chunk(
  chunkId: number,
  classification: string,
  content: string,
): RetrievedChunk {
  return {
    chunkId,
    documentId: chunkId,
    docId: `doc-${chunkId}`,
    title: `Doc ${chunkId}`,
    classification,
    chunkIndex: 0,
    content,
    similarity: 0.6,
  };
}

describe("ask pipeline", () => {
  it("refuses without calling the model when nothing is retrieved", async () => {
    const result = await runAskPipeline(
      { question: "What is the meaning of life?", role: "member" },
      { retriever: new FakeRetriever([]), llm: new MockProvider() },
    );
    expect(result.refused).toBe(true);
    expect(result.answer).toBe(REFUSAL_TEXT);
    expect(result.sources).toEqual([]);
    expect(result.outputTokens).toBe(0);
  });

  it("answers with citations from retrieved chunks", async () => {
    const retriever = new FakeRetriever([
      chunk(1, "general", "The VPN uses port 443 with fallback to 8443."),
    ]);
    const result = await runAskPipeline(
      { question: "Which port does the VPN use?", role: "member" },
      { retriever, llm: new MockProvider() },
    );
    expect(result.refused).toBe(false);
    expect(result.citedChunkIds).toEqual([1]);
    expect(result.answer).toContain("[1]");
    expect(result.model).toBe("mock");
    expect(result.inputTokens).toBeGreaterThan(0);
  });

  it("passes only the caller's allowed classifications to the retriever", async () => {
    const retriever = new FakeRetriever([
      chunk(1, "general", "General info."),
      chunk(2, "restricted", "Restricted info."),
    ]);
    const memberResult = await runAskPipeline(
      { question: "info", role: "member" },
      { retriever, llm: new MockProvider() },
    );
    expect(retriever.lastOptions?.allowedClassifications).toEqual(["general"]);
    expect(memberResult.sources.every((s) => s.chunkId !== 2)).toBe(true);

    await runAskPipeline(
      { question: "info", role: "ops_admin" },
      { retriever, llm: new MockProvider() },
    );
    expect(retriever.lastOptions?.allowedClassifications).toEqual([
      "general",
      "restricted",
    ]);
  });

  it("reports timing and cost fields", async () => {
    const retriever = new FakeRetriever([chunk(1, "general", "Some content.")]);
    const result = await runAskPipeline(
      { question: "some question", role: "member" },
      { retriever, llm: new MockProvider() },
    );
    expect(result.totalMs).toBeGreaterThanOrEqual(0);
    expect(result.retrievalMs).toBeGreaterThanOrEqual(0);
    expect(result.estimatedCostUsd).toBe(0);
  });
});
