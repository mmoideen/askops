import type { Classification } from "../rbac/policy";

// Retrieval behind an interface. The pgvector implementation is the default
// for local development and the current deployment. The Azure AI Search
// implementation targets the production data tier described in infra/ and
// satisfies the same contract, so swapping is a config change, not a rewrite.

export interface RetrievedChunk {
  chunkId: number;
  documentId: number;
  docId: string;
  title: string;
  classification: string;
  chunkIndex: number;
  content: string;
  similarity: number;
}

export interface RetrieveOptions {
  // The classifications the requesting user is allowed to see. The retriever
  // MUST apply this filter inside the query, never after the fact.
  allowedClassifications: readonly Classification[];
  topK: number;
  minSimilarity: number;
}

export interface Retriever {
  readonly name: string;
  retrieve(query: string, options: RetrieveOptions): Promise<RetrievedChunk[]>;
}
