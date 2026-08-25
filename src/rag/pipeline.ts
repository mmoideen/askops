import { env } from "../config/env";
import { allowedClassifications, type Role } from "../rbac/policy";
import { processCitations } from "./citations";
import { detectInjection, type InjectionVerdict } from "./guardrails";
import {
  estimateCostUsd,
  getLlmProvider,
  REFUSAL_TEXT,
  type LlmProvider,
} from "./llm";
import { buildSystemPrompt } from "./prompt";
import type { RetrievedChunk, Retriever } from "./retriever";
import { PgVectorRetriever } from "./retriever.pgvector";
import { AzureAISearchRetriever } from "./retriever.aisearch";

// The ask pipeline: retrieve (scoped to the caller's role), assemble the
// prompt with delimited context, generate, then validate citations. The
// pipeline never widens access: the role's allowed classifications are
// resolved here, server side, and applied inside the retriever's query.

export interface AskInput {
  question: string;
  role: Role;
}

export interface SourceRef {
  ref: number;
  chunkId: number;
  docId: string;
  title: string;
  similarity: number;
}

export interface AskResult {
  answer: string;
  refused: boolean;
  sources: SourceRef[];
  citedChunkIds: number[];
  invalidCitationRefs: number[];
  retrievedChunkIds: number[];
  injection: InjectionVerdict;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  retrievalMs: number;
  generationMs: number;
  totalMs: number;
}

export function getRetriever(): Retriever {
  if (env.RETRIEVER === "aisearch") {
    return new AzureAISearchRetriever();
  }
  return new PgVectorRetriever();
}

export interface PipelineDeps {
  retriever?: Retriever;
  llm?: LlmProvider;
}

export async function runAskPipeline(
  input: AskInput,
  deps: PipelineDeps = {},
): Promise<AskResult> {
  const startedAt = Date.now();
  const retriever = deps.retriever ?? getRetriever();
  const llm = deps.llm ?? getLlmProvider();

  // Heuristic injection detection. Flagged requests are not blocked (the
  // layered defenses contain them); the verdict travels with the result so
  // the audit log records the attempt.
  const injection = detectInjection(input.question);
  const allowed = allowedClassifications(input.role);

  const retrievalStart = Date.now();
  const retrieved: RetrievedChunk[] = await retriever.retrieve(
    input.question,
    {
      allowedClassifications: allowed,
      topK: env.RETRIEVAL_TOP_K,
      minSimilarity: env.RETRIEVAL_MIN_SIMILARITY,
    },
  );
  const retrievalMs = Date.now() - retrievalStart;

  // Nothing relevant above the threshold: refuse without calling the model.
  if (retrieved.length === 0) {
    const totalMs = Date.now() - startedAt;
    return {
      answer: REFUSAL_TEXT,
      refused: true,
      sources: [],
      citedChunkIds: [],
      invalidCitationRefs: [],
      retrievedChunkIds: [],
      injection,
      model: llm.name === "mock" ? "mock" : env.LLM_MODEL,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
      retrievalMs,
      generationMs: 0,
      totalMs,
    };
  }

  const generationStart = Date.now();
  const generation = await llm.generate({
    systemPrompt: buildSystemPrompt(),
    question: input.question,
    contextChunks: retrieved.map((c, i) => ({
      ref: i + 1,
      title: c.title,
      content: c.content,
    })),
  });
  const generationMs = Date.now() - generationStart;

  const refused = generation.text.trim().startsWith(REFUSAL_TEXT);
  const citations = processCitations(generation.text, retrieved);

  const totalMs = Date.now() - startedAt;
  return {
    answer: citations.text,
    refused,
    sources: retrieved.map((c, i) => ({
      ref: i + 1,
      chunkId: c.chunkId,
      docId: c.docId,
      title: c.title,
      similarity: c.similarity,
    })),
    citedChunkIds: citations.citedChunkIds,
    invalidCitationRefs: citations.invalidRefs,
    retrievedChunkIds: retrieved.map((c) => c.chunkId),
    injection,
    model: generation.model,
    inputTokens: generation.inputTokens,
    outputTokens: generation.outputTokens,
    estimatedCostUsd: estimateCostUsd(
      generation.model,
      generation.inputTokens,
      generation.outputTokens,
    ),
    retrievalMs,
    generationMs,
    totalMs,
  };
}
