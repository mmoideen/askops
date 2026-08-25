import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env";

// LLM access behind an interface. The anthropic provider is the default in
// real deployments. The mock provider is deterministic, needs no key, and
// honors the same prompt contract (grounded answers with [n] citations,
// refusal string when unsupported), which lets tests, CI, and the eval
// harness run hermetically.

export const REFUSAL_TEXT =
  "I do not have information on that in the current corpus.";

export interface LlmContextChunk {
  ref: number;
  title: string;
  content: string;
}

export interface GenerateParams {
  systemPrompt: string;
  question: string;
  contextChunks: LlmContextChunk[];
}

export interface GenerateResult {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export interface LlmProvider {
  readonly name: string;
  generate(params: GenerateParams): Promise<GenerateResult>;
}

// USD per million tokens, taken from the published Anthropic pricing table.
// Used for the estimated cost attribute on traces and audit entries.
const PRICING_PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-opus-5": { input: 5, output: 25 },
  "claude-fable-5": { input: 10, output: 50 },
  "claude-haiku-4-5": { input: 1, output: 5 },
  "claude-haiku-4-5-20251001": { input: 1, output: 5 },
  mock: { input: 0, output: 0 },
};

export function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = PRICING_PER_MTOK[model] ?? { input: 0, output: 0 };
  return (
    (inputTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output
  );
}

function buildUserMessage(params: GenerateParams): string {
  const contextBlock = params.contextChunks
    .map(
      (c) =>
        `<document ref="${c.ref}" title="${c.title.replace(/"/g, "'")}">\n${c.content}\n</document>`,
    )
    .join("\n");
  return [
    "<retrieved_context>",
    contextBlock,
    "</retrieved_context>",
    "",
    "<user_question>",
    params.question,
    "</user_question>",
  ].join("\n");
}

export class AnthropicProvider implements LlmProvider {
  readonly name = "anthropic";
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(apiKey?: string, model?: string) {
    const key = apiKey ?? env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new Error("LLM_PROVIDER=anthropic requires ANTHROPIC_API_KEY");
    }
    this.client = new Anthropic({ apiKey: key });
    this.model = model ?? env.LLM_MODEL;
  }

  async generate(params: GenerateParams): Promise<GenerateResult> {
    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      system: params.systemPrompt,
      messages: [{ role: "user", content: buildUserMessage(params) }],
    });
    const text = message.content
      .filter((block) => block.type === "text")
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("");
    return {
      text,
      model: this.model,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    };
  }
}

// Deterministic extractive provider. Honors the same behavioral contract
// the system prompt demands of the real model: answers only from supplied
// context (best matching paragraph of the best matching chunk, cited),
// refuses with the canonical phrase when it has no context, and refuses
// requests that read as prompt injection, using the same heuristics module
// the guardrails use. It never emits system prompt text and never follows
// instructions embedded in the context, by construction.
export class MockProvider implements LlmProvider {
  readonly name = "mock";

  private contentWords(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 3);
  }

  private overlapScore(questionWords: Set<string>, text: string): number {
    let score = 0;
    for (const w of this.contentWords(text)) {
      // Longer tokens are more distinctive; weight them accordingly.
      if (questionWords.has(w)) score += w.length;
    }
    return score;
  }

  async generate(params: GenerateParams): Promise<GenerateResult> {
    const approxInput =
      Math.ceil(
        (params.systemPrompt.length +
          params.question.length +
          params.contextChunks.reduce((n, c) => n + c.content.length, 0)) /
          4,
      ) || 1;
    const refuse = () => ({
      text: REFUSAL_TEXT,
      model: "mock",
      inputTokens: approxInput,
      outputTokens: Math.ceil(REFUSAL_TEXT.length / 4),
    });

    if (params.contextChunks.length === 0) {
      return refuse();
    }

    // A well behaved model follows the system prompt's rule 5 and refuses
    // injection attempts; the deterministic stand-in detects them with the
    // shared heuristics instead of judgment.
    const { detectInjection } = await import("./guardrails");
    if (detectInjection(params.question).flagged) {
      return refuse();
    }

    // Score every paragraph across every retrieved chunk and answer with
    // the best one, citing the chunk it came from. Matched words (naive
    // plural stemming) are weighted by inverse document frequency computed
    // over the retrieved paragraphs themselves, so words exclusive to one
    // paragraph (the actual answer terms) outweigh topic words that appear
    // everywhere, including in summary paragraphs. Density normalization
    // keeps short precise paragraphs ahead of long rambling ones.
    const stem = (w: string) => (w.endsWith("s") ? w.slice(0, -1) : w);
    const questionWords = new Set(
      this.contentWords(params.question).map(stem),
    );

    interface Candidate {
      paragraph: string;
      ref: number;
      stems: Set<string>;
      wordCount: number;
    }
    const candidates: Candidate[] = [];
    for (const chunk of params.contextChunks) {
      for (const paragraph of chunk.content
        .split(/\n\n+/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0 && !/^#/.test(p))) {
        const words = this.contentWords(paragraph);
        candidates.push({
          paragraph,
          ref: chunk.ref,
          stems: new Set(words.map(stem)),
          wordCount: words.length,
        });
      }
    }
    if (candidates.length === 0) {
      return refuse();
    }

    const df = new Map<string, number>();
    for (const c of candidates) {
      for (const s of c.stems) df.set(s, (df.get(s) ?? 0) + 1);
    }

    let best = candidates[0];
    let bestScore = -1;
    for (const c of candidates) {
      let raw = 0;
      for (const s of c.stems) {
        if (questionWords.has(s)) {
          const idf = 1 + Math.log(candidates.length / (df.get(s) ?? 1));
          raw += s.length * idf;
        }
      }
      const score = c.wordCount > 0 ? raw / Math.sqrt(c.wordCount) : 0;
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    const bestParagraph = best.paragraph;
    const bestRef = best.ref;

    const text = `${bestParagraph.slice(0, 700).trim()} [${bestRef}]`;
    return {
      text,
      model: "mock",
      inputTokens: approxInput,
      outputTokens: Math.ceil(text.length / 4),
    };
  }
}

export function getLlmProvider(): LlmProvider {
  if (env.LLM_PROVIDER === "mock") {
    return new MockProvider();
  }
  return new AnthropicProvider();
}
