import { env } from "../config/env";
import { getEmbeddingsProvider, type EmbeddingsProvider } from "./embeddings";
import type { RetrievedChunk, RetrieveOptions, Retriever } from "./retriever";

// Azure AI Search implementation of the Retriever contract. This is the
// production target documented in infra/ and docs/ARCHITECTURE.md. It expects
// an index whose fields mirror the pgvector schema: chunkId, documentId,
// docId, title, classification, chunkIndex, content, and a vector field
// named embedding (1536 dimensions).
//
// The classification filter is applied server side through the search
// $filter expression, mirroring the SQL WHERE clause in the pgvector
// implementation, so unauthorized chunks never leave the search service.
//
// This adapter is exercised by contract-shaped unit tests with a stubbed
// fetch. Live verification requires a provisioned search service; the steps
// are documented in docs/RUNBOOK.md.

interface SearchHit {
  "@search.score": number;
  chunkId: number;
  documentId: number;
  docId: string;
  title: string;
  classification: string;
  chunkIndex: number;
  content: string;
}

export class AzureAISearchRetriever implements Retriever {
  readonly name = "aisearch";
  private readonly embeddings: EmbeddingsProvider;
  private readonly endpoint: string;
  private readonly apiKey: string;
  private readonly index: string;

  constructor(embeddings?: EmbeddingsProvider) {
    if (
      !env.AZURE_SEARCH_ENDPOINT ||
      !env.AZURE_SEARCH_API_KEY ||
      !env.AZURE_SEARCH_INDEX
    ) {
      throw new Error(
        "RETRIEVER=aisearch requires AZURE_SEARCH_ENDPOINT, AZURE_SEARCH_API_KEY, and AZURE_SEARCH_INDEX",
      );
    }
    this.endpoint = env.AZURE_SEARCH_ENDPOINT.replace(/\/$/, "");
    this.apiKey = env.AZURE_SEARCH_API_KEY;
    this.index = env.AZURE_SEARCH_INDEX;
    this.embeddings = embeddings ?? getEmbeddingsProvider();
  }

  async retrieve(
    query: string,
    options: RetrieveOptions,
  ): Promise<RetrievedChunk[]> {
    if (options.allowedClassifications.length === 0) {
      return [];
    }
    const [queryVec] = await this.embeddings.embed([query]);

    const filter = options.allowedClassifications
      .map((c) => `classification eq '${c}'`)
      .join(" or ");

    const url = `${this.endpoint}/indexes/${this.index}/docs/search?api-version=2024-07-01`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": this.apiKey,
      },
      body: JSON.stringify({
        count: false,
        top: options.topK,
        filter,
        select:
          "chunkId,documentId,docId,title,classification,chunkIndex,content",
        vectorQueries: [
          {
            kind: "vector",
            vector: queryVec,
            fields: "embedding",
            k: options.topK,
          },
        ],
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(
        `Azure AI Search error ${res.status}: ${detail.slice(0, 200)}`,
      );
    }
    const data = (await res.json()) as { value: SearchHit[] };

    return data.value
      .map((hit) => ({
        chunkId: hit.chunkId,
        documentId: hit.documentId,
        docId: hit.docId,
        title: hit.title,
        classification: hit.classification,
        chunkIndex: hit.chunkIndex,
        content: hit.content,
        // Cosine similarity from the search score. For vector queries the
        // score is 1 / (1 + distance); invert to a 0..1 similarity so the
        // shared threshold semantics hold across retrievers.
        similarity: Math.max(0, Math.min(1, 2 * hit["@search.score"] - 1)),
      }))
      .filter((r) => r.similarity >= options.minSimilarity);
  }
}
