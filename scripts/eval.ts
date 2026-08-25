// Evaluation harness runner.
//
// Runs every golden dataset item through the real ask pipeline (real
// retriever, real database, the LLM provider selected by env) and scores it
// with deterministic judges. Writes eval-results/results.json and
// eval-results/summary.md, prints the summary, and exits non zero when any
// gate metric misses its threshold. That exit code is the deploy gate.
//
// Modes:
//   LLM_PROVIDER=mock       hermetic, no keys, CI default
//   LLM_PROVIDER=anthropic  live model answers, real quality numbers
//   EVAL_LLM_JUDGE=true     adds a supplementary LLM groundedness opinion
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { inArray } from "drizzle-orm";
import { db, sqlClient } from "../src/db/client";
import { chunks as chunksTable, documents } from "../src/db/schema";
import { runAskPipeline, type AskResult } from "../src/rag/pipeline";
import { checkGates, type EvalItem, type EvalMetrics } from "../evals/gates";
import {
  judgeCitationValidity,
  judgeGroundedness,
  judgeInjectionResistance,
  judgeRefusal,
  type ChunkLookup,
} from "../evals/judges/deterministic";
import { llmJudgeEnabled, llmJudgeGroundedness } from "../evals/judges/llm";
import { env } from "../src/config/env";

interface ItemRecord {
  item: EvalItem;
  result: AskResult;
  pass: boolean;
  reasons: string[];
  llmJudge?: { grounded: boolean; explanation: string };
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.ceil((p / 100) * sorted.length) - 1,
  );
  return sorted[Math.max(0, index)];
}

async function lookupChunkFacts(ids: number[]): Promise<ChunkLookup> {
  const lookup: ChunkLookup = new Map();
  if (ids.length === 0) return lookup;
  const rows = await db
    .select({
      chunkId: chunksTable.id,
      content: chunksTable.content,
      documentId: chunksTable.documentId,
    })
    .from(chunksTable)
    .where(inArray(chunksTable.id, ids));
  const docIds = [...new Set(rows.map((r) => r.documentId))];
  const docs = await db
    .select({
      id: documents.id,
      docId: documents.docId,
      classification: documents.classification,
    })
    .from(documents)
    .where(inArray(documents.id, docIds));
  const docMap = new Map(docs.map((d) => [d.id, d]));
  for (const row of rows) {
    const doc = docMap.get(row.documentId);
    if (doc) {
      lookup.set(row.chunkId, {
        docId: doc.docId,
        classification: doc.classification,
        content: row.content,
      });
    }
  }
  return lookup;
}

async function main() {
  const datasetPath = join(process.cwd(), "evals", "dataset.jsonl");
  const items: EvalItem[] = readFileSync(datasetPath, "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as EvalItem);

  console.log(
    `Running ${items.length} eval items (llm=${env.LLM_PROVIDER}, embeddings=${env.EMBEDDINGS_PROVIDER}, retriever=${env.RETRIEVER}, llm_judge=${llmJudgeEnabled()})`,
  );

  const records: ItemRecord[] = [];
  for (const item of items) {
    const result = await runAskPipeline({
      question: item.question,
      role: item.role,
    });
    const involvedIds = [
      ...new Set([...result.retrievedChunkIds, ...result.citedChunkIds]),
    ];
    const chunkFacts = await lookupChunkFacts(involvedIds);

    let pass = true;
    const reasons: string[] = [];

    const refusal = judgeRefusal(item, result);
    const citation = judgeCitationValidity(result);

    if (item.category === "grounded_qa") {
      const grounded = judgeGroundedness(item, result, chunkFacts);
      pass = grounded.pass && citation.pass;
      reasons.push(...grounded.reasons, ...citation.reasons);
    } else if (item.category === "prompt_injection") {
      const injection = judgeInjectionResistance(item, result, chunkFacts);
      pass = injection.pass;
      reasons.push(...injection.reasons);
    } else {
      pass = refusal.pass;
      reasons.push(...refusal.reasons);
    }

    const record: ItemRecord = { item, result, pass, reasons };

    if (
      item.category === "grounded_qa" &&
      !result.refused &&
      llmJudgeEnabled()
    ) {
      record.llmJudge = await llmJudgeGroundedness(item, result, chunkFacts);
    }

    records.push(record);
    console.log(
      `${pass ? "PASS" : "FAIL"} [${item.category}] ${item.id}${reasons.length ? `: ${reasons.join("; ")}` : ""}`,
    );
  }

  const byCategory = (category: EvalItem["category"]) =>
    records.filter((r) => r.item.category === category);
  const passRate = (rs: ItemRecord[]) =>
    rs.length === 0 ? 1 : rs.filter((r) => r.pass).length / rs.length;

  const answered = records.filter((r) => !r.result.refused);
  const citationValidity =
    answered.length === 0
      ? 1
      : answered.filter((r) => r.result.invalidCitationRefs.length === 0)
          .length / answered.length;

  const metrics: EvalMetrics = {
    groundedness: passRate(byCategory("grounded_qa")),
    refusalCorrectness: passRate([
      ...byCategory("out_of_scope_refusal"),
      ...byCategory("restricted_refusal"),
    ]),
    injectionResistance: passRate(byCategory("prompt_injection")),
    citationValidity,
  };

  const gates = checkGates(metrics);
  const allPass = gates.every((g) => g.pass);

  const latencies = records.map((r) => r.result.totalMs);
  const latencySummary = {
    p50Ms: percentile(latencies, 50),
    p95Ms: percentile(latencies, 95),
    maxMs: Math.max(...latencies),
  };
  const totalCostUsd = records.reduce(
    (s, r) => s + r.result.estimatedCostUsd,
    0,
  );

  const outDir = join(process.cwd(), "eval-results");
  mkdirSync(outDir, { recursive: true });

  writeFileSync(
    join(outDir, "results.json"),
    JSON.stringify(
      {
        ranAt: new Date().toISOString(),
        mode: {
          llmProvider: env.LLM_PROVIDER,
          model: env.LLM_PROVIDER === "mock" ? "mock" : env.LLM_MODEL,
          embeddingsProvider: env.EMBEDDINGS_PROVIDER,
          retriever: env.RETRIEVER,
          llmJudge: llmJudgeEnabled(),
          minSimilarity: env.RETRIEVAL_MIN_SIMILARITY,
          topK: env.RETRIEVAL_TOP_K,
        },
        metrics,
        gates,
        allPass,
        latency: latencySummary,
        totalCostUsd,
        items: records.map((r) => ({
          id: r.item.id,
          category: r.item.category,
          role: r.item.role,
          pass: r.pass,
          reasons: r.reasons,
          refused: r.result.refused,
          citedChunkIds: r.result.citedChunkIds,
          invalidCitationRefs: r.result.invalidCitationRefs,
          latencyMs: r.result.totalMs,
          llmJudge: r.llmJudge,
        })),
      },
      null,
      2,
    ),
  );

  const failLines = records
    .filter((r) => !r.pass)
    .map(
      (r) => `| ${r.item.id} | ${r.item.category} | ${r.reasons.join("; ")} |`,
    );
  const summary = [
    "# AskOps evaluation results",
    "",
    `Mode: llm=${env.LLM_PROVIDER}, embeddings=${env.EMBEDDINGS_PROVIDER}, retriever=${env.RETRIEVER}, min_similarity=${env.RETRIEVAL_MIN_SIMILARITY}, top_k=${env.RETRIEVAL_TOP_K}`,
    "",
    "| Metric | Value | Gate | Status |",
    "| --- | --- | --- | --- |",
    ...gates.map(
      (g) =>
        `| ${g.metric} | ${(g.value * 100).toFixed(1)}% | >= ${(g.gate * 100).toFixed(0)}% | ${g.pass ? "PASS" : "FAIL"} |`,
    ),
    "",
    `Latency: p50 ${latencySummary.p50Ms} ms, p95 ${latencySummary.p95Ms} ms over ${records.length} items. Estimated cost: $${totalCostUsd.toFixed(4)}.`,
    "",
    ...(failLines.length > 0
      ? [
          "## Failures",
          "",
          "| Item | Category | Reasons |",
          "| --- | --- | --- |",
          ...failLines,
        ]
      : ["All items passed."]),
    "",
    `Overall: ${allPass ? "PASS" : "FAIL"}`,
  ].join("\n");
  writeFileSync(join(outDir, "summary.md"), summary);

  console.log("\n" + summary);
  await sqlClient.end();

  if (!allPass) {
    console.error("\nEval gates FAILED.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
