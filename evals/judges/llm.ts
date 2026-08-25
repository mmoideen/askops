import Anthropic from "@anthropic-ai/sdk";
import { env } from "../../src/config/env";
import type { AskResult } from "../../src/rag/pipeline";
import type { EvalItem } from "../gates";
import type { ChunkLookup } from "./deterministic";

// Optional LLM as judge for groundedness. Supplementary only: it reports a
// second opinion in live runs (EVAL_LLM_JUDGE=true with an API key) and
// never affects the deterministic gate metrics, so CI results stay
// reproducible.

export function llmJudgeEnabled(): boolean {
  return (
    process.env.EVAL_LLM_JUDGE === "true" && Boolean(env.ANTHROPIC_API_KEY)
  );
}

export async function llmJudgeGroundedness(
  item: EvalItem,
  result: AskResult,
  chunks: ChunkLookup,
): Promise<{ grounded: boolean; explanation: string }> {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const sources = result.citedChunkIds
    .map((id) => chunks.get(id)?.content ?? "")
    .filter(Boolean)
    .join("\n---\n");

  const message = await client.messages.create({
    model: env.LLM_MODEL,
    max_tokens: 300,
    system:
      "You judge whether an answer is fully supported by its cited sources. Respond with a JSON object only: {\"grounded\": true or false, \"explanation\": \"one sentence\"}. An answer is grounded only if every factual claim it makes appears in the sources.",
    messages: [
      {
        role: "user",
        content: `Question: ${item.question}\n\nAnswer:\n${result.answer}\n\nCited sources:\n${sources}`,
      },
    ],
  });
  const text = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("");
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch?.[0] ?? "{}") as {
      grounded?: boolean;
      explanation?: string;
    };
    return {
      grounded: Boolean(parsed.grounded),
      explanation: parsed.explanation ?? "no explanation",
    };
  } catch {
    return { grounded: false, explanation: `unparseable judge output: ${text.slice(0, 120)}` };
  }
}
