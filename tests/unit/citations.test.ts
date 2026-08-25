import { describe, expect, it } from "vitest";
import { processCitations } from "../../src/rag/citations";
import type { RetrievedChunk } from "../../src/rag/retriever";

function chunk(chunkId: number): RetrievedChunk {
  return {
    chunkId,
    documentId: 1,
    docId: "doc",
    title: "Doc",
    classification: "general",
    chunkIndex: 0,
    content: "content",
    similarity: 0.5,
  };
}

describe("citation post processing", () => {
  it("maps valid refs to chunk ids", () => {
    const result = processCitations("Use port 443 [1] and MFA [2].", [
      chunk(11),
      chunk(22),
    ]);
    expect(result.citedRefs).toEqual([1, 2]);
    expect(result.citedChunkIds).toEqual([11, 22]);
    expect(result.invalidRefs).toEqual([]);
    expect(result.text).toBe("Use port 443 [1] and MFA [2].");
  });

  it("strips citations that were never retrieved", () => {
    const result = processCitations("A claim [1] and a fake one [7].", [
      chunk(11),
    ]);
    expect(result.citedRefs).toEqual([1]);
    expect(result.invalidRefs).toEqual([7]);
    expect(result.text).toBe("A claim [1] and a fake one .");
  });

  it("deduplicates repeated citations", () => {
    const result = processCitations("First [1]. Again [1]. Also [2] [1].", [
      chunk(5),
      chunk(6),
    ]);
    expect(result.citedRefs).toEqual([1, 2]);
    expect(result.citedChunkIds).toEqual([5, 6]);
  });

  it("handles answers with no citations", () => {
    const result = processCitations("No citations here.", [chunk(1)]);
    expect(result.citedRefs).toEqual([]);
    expect(result.citedChunkIds).toEqual([]);
  });
});
