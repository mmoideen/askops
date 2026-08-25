import { env } from "../config/env";

// Embeddings behind an interface so the app can swap providers by env var.
// Every provider must emit vectors of EMBEDDING_DIMENSIONS so a single
// pgvector column serves all of them. The local provider is deterministic,
// dependency free, and requires no key, which keeps tests and CI hermetic.

export const EMBEDDING_DIMENSIONS = 1536;

export interface EmbeddingsProvider {
  readonly name: string;
  embed(texts: string[]): Promise<number[][]>;
}

function fnv1a(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

// Function words carry no retrieval signal but dominate raw token counts,
// which inflates similarity between unrelated texts and buries the real
// matches. Dropping them measurably separates signal from noise (see
// scripts/retrieval-debug.ts for the measurement workflow).
const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "if",
  "then",
  "than",
  "that",
  "this",
  "these",
  "those",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "am",
  "do",
  "does",
  "did",
  "doing",
  "have",
  "has",
  "had",
  "having",
  "will",
  "would",
  "can",
  "could",
  "should",
  "shall",
  "may",
  "might",
  "must",
  "of",
  "in",
  "on",
  "at",
  "to",
  "for",
  "from",
  "by",
  "with",
  "about",
  "into",
  "through",
  "during",
  "before",
  "after",
  "above",
  "below",
  "between",
  "out",
  "off",
  "over",
  "under",
  "up",
  "down",
  "again",
  "further",
  "how",
  "what",
  "when",
  "where",
  "which",
  "who",
  "whom",
  "why",
  "it",
  "its",
  "you",
  "your",
  "yours",
  "we",
  "our",
  "ours",
  "they",
  "their",
  "them",
  "he",
  "she",
  "his",
  "her",
  "i",
  "me",
  "my",
  "mine",
  "not",
  "no",
  "nor",
  "so",
  "too",
  "very",
  "just",
  "also",
  "as",
  "there",
  "here",
  "any",
  "all",
  "each",
  "both",
  "some",
  "such",
  "own",
  "same",
  "other",
  "more",
  "most",
  "many",
  "much",
  "need",
  "like",
  "get",
  "one",
  "per",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

export function localEmbed(text: string): number[] {
  const vec = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  const tokens = tokenize(text);
  const features: { feature: string; weight: number }[] = [];
  for (const t of tokens) {
    // Longer tokens tend to be rarer and more distinctive; weighting by
    // length is a cheap corpus free stand in for inverse document
    // frequency.
    features.push({ feature: t, weight: Math.min(t.length, 12) });
  }
  for (let i = 0; i < tokens.length - 1; i++) {
    const bigram = tokens[i] + "_" + tokens[i + 1];
    features.push({
      feature: bigram,
      weight: Math.min((tokens[i].length + tokens[i + 1].length) / 2, 12),
    });
  }
  for (const { feature, weight } of features) {
    // Two independent hash positions per feature halve the damage a single
    // hash collision can do to similarity between unrelated texts.
    for (const salt of ["", "#2"]) {
      const h = fnv1a(feature + salt);
      const index = h % EMBEDDING_DIMENSIONS;
      const sign = (h & 0x80000000) === 0 ? 1 : -1;
      vec[index] += sign * weight;
    }
  }
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm);
  if (norm === 0) return vec;
  return vec.map((v) => v / norm);
}

export class LocalHashEmbeddings implements EmbeddingsProvider {
  // Version suffix: bumping it changes every document's content hash, which
  // makes the next ingest run re embed the whole corpus automatically.
  readonly name = "local-hash@3";
  async embed(texts: string[]): Promise<number[][]> {
    return texts.map(localEmbed);
  }
}

// Calls the OpenAI embeddings REST API directly. Kept to plain fetch so the
// dependency surface stays small. text-embedding-3-small emits 1536 dims,
// matching the pgvector column.
export class OpenAIEmbeddings implements EmbeddingsProvider {
  readonly name: string;
  constructor(
    private readonly apiKey: string,
    private readonly model: string = "text-embedding-3-small",
  ) {
    this.name = `openai:${model}`;
  }

  async embed(texts: string[]): Promise<number[][]> {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ model: this.model, input: texts }),
    });
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(
        `Embeddings API error ${res.status}: ${detail.slice(0, 200)}`,
      );
    }
    const data = (await res.json()) as {
      data: { index: number; embedding: number[] }[];
    };
    const sorted = [...data.data].sort((a, b) => a.index - b.index);
    for (const item of sorted) {
      if (item.embedding.length !== EMBEDDING_DIMENSIONS) {
        throw new Error(
          `Embedding dimension mismatch: got ${item.embedding.length}, expected ${EMBEDDING_DIMENSIONS}`,
        );
      }
    }
    return sorted.map((d) => d.embedding);
  }
}

export function getEmbeddingsProvider(): EmbeddingsProvider {
  if (env.EMBEDDINGS_PROVIDER === "openai") {
    if (!env.EMBEDDINGS_API_KEY) {
      throw new Error("EMBEDDINGS_PROVIDER=openai requires EMBEDDINGS_API_KEY");
    }
    return new OpenAIEmbeddings(env.EMBEDDINGS_API_KEY, env.EMBEDDINGS_MODEL);
  }
  return new LocalHashEmbeddings();
}

export function toVectorLiteral(vec: number[]): string {
  return "[" + vec.map((v) => v.toFixed(6)).join(",") + "]";
}
