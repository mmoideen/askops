import type { RetrievedChunk } from "./retriever";

// Deterministic citation post processing. The model cites [n] markers that
// map to the ref numbers of the retrieved chunks it was shown. Anything the
// model cites that was not actually retrieved is invalid: the marker is
// removed from the answer text and the event is reported so the eval harness
// and the audit log can see it. This keeps the citation validity metric
// objective, no judge involved.

export interface CitationResult {
  text: string;
  citedRefs: number[];
  citedChunkIds: number[];
  invalidRefs: number[];
}

const CITATION_RE = /\[(\d{1,3})\]/g;

export function processCitations(
  rawText: string,
  retrieved: RetrievedChunk[],
): CitationResult {
  const validRefs = new Set(retrieved.map((_, i) => i + 1));
  const cited = new Set<number>();
  const invalid = new Set<number>();

  for (const match of rawText.matchAll(CITATION_RE)) {
    const ref = Number(match[1]);
    if (validRefs.has(ref)) {
      cited.add(ref);
    } else {
      invalid.add(ref);
    }
  }

  let text = rawText;
  for (const ref of invalid) {
    text = text.split(`[${ref}]`).join("");
  }
  text = text.replace(/[ \t]{2,}/g, " ").trim();

  const citedRefs = [...cited].sort((a, b) => a - b);
  return {
    text,
    citedRefs,
    citedChunkIds: citedRefs.map((ref) => retrieved[ref - 1].chunkId),
    invalidRefs: [...invalid].sort((a, b) => a - b),
  };
}
