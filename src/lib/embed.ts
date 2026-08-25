// Local deterministic embeddings using the hashing trick.
// Tokens and token bigrams are hashed into a fixed 1536 dimension space with
// a sign bit, then the vector is L2 normalized. Not a semantic model, but
// deterministic, dependency free, and good enough for keyword-ish retrieval
// over a small corpus. Cosine similarity works on the normalized output.

export const EMBEDDING_DIMENSIONS = 1536;

function fnv1a(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

export function embed(text: string): number[] {
  const vec = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  const tokens = tokenize(text);
  const features: string[] = [...tokens];
  for (let i = 0; i < tokens.length - 1; i++) {
    features.push(tokens[i] + "_" + tokens[i + 1]);
  }
  for (const feature of features) {
    const h = fnv1a(feature);
    const index = h % EMBEDDING_DIMENSIONS;
    const sign = (h & 0x80000000) === 0 ? 1 : -1;
    vec[index] += sign;
  }
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm);
  if (norm === 0) return vec;
  return vec.map((v) => v / norm);
}

export function toVectorLiteral(vec: number[]): string {
  return "[" + vec.map((v) => v.toFixed(6)).join(",") + "]";
}
