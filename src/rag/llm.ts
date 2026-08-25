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

// Deterministic extractive provider. Answers only from supplied context:
// picks the most lexically relevant chunk, quotes it, cites it. Refuses with
// the canonical refusal text when given no context. Never follows
// instructions embedded in the context, by construction.
export class MockProvider implements LlmProvider {
  readonly name = "mock";

  async generate(params: GenerateParams): Promise<GenerateResult> {
    const approxInput =
      Math.ceil(
        (params.systemPrompt.length +
          params.question.length +
          params.contextChunks.reduce((n, c) => n + c.content.length, 0)) /
          4,
      ) || 1;

    if (params.contextChunks.length === 0) {
      return {
        text: REFUSAL_TEXT,
        model: "mock",
        inputTokens: approxInput,
        outputTokens: Math.ceil(REFUSAL_TEXT.length / 4),
      };
    }

    const questionTokens = new Set(
      params.question
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((t) => t.length > 2),
    );
    let best = params.contextChunks[0];
    let bestScore = -1;
    for (const chunk of params.contextChunks) {
      const words = chunk.content.toLowerCase().split(/\s+/);
      let score = 0;
      for (const w of words) {
        if (questionTokens.has(w.replace(/[^a-z0-9]/g, ""))) score++;
      }
      if (score > bestScore) {
        bestScore = score;
        best = chunk;
      }
    }

    const snippet = best.content.split(/\n\n+/)[0].slice(0, 700).trim();
    const text = `${snippet} [${best.ref}]`;
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
