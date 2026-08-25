// Small load test against the ask pipeline (retrieval plus generation),
// bypassing HTTP so it measures the application layer the runbook cares
// about. Defaults: 10 concurrent workers, 20 asks each, mock provider
// unless LLM_PROVIDER says otherwise. Results feed docs/RUNBOOK.md.
//
// Usage: OTEL_EXPORTER=none npx tsx scripts/loadtest.ts [workers] [asksPerWorker]
import { sqlClient } from "../src/db/client";
import { runAskPipeline } from "../src/rag/pipeline";

const QUESTIONS = [
  "How do I set up the GlobalConnect VPN?",
  "What is the domestic daily meal spending limit?",
  "How many PTO days do full time employees accrue?",
  "What is the per diem for domestic travel?",
  "How do I report a phishing email?",
  "How do I book a meeting room with video?",
  "What laptop hardware tiers are available?",
  "How does the on call rotation handoff work?",
];

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[
    Math.max(
      0,
      Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1),
    )
  ];
}

async function main() {
  const workers = Number(process.argv[2] ?? 10);
  const asksPerWorker = Number(process.argv[3] ?? 20);
  const latencies: number[] = [];
  let errors = 0;

  const startedAt = Date.now();
  await Promise.all(
    Array.from({ length: workers }, async (_, w) => {
      for (let i = 0; i < asksPerWorker; i++) {
        const question =
          QUESTIONS[(w * asksPerWorker + i) % QUESTIONS.length] +
          ` (load ${w}-${i})`;
        const start = Date.now();
        try {
          await runAskPipeline({ question, role: "member" });
          latencies.push(Date.now() - start);
        } catch {
          errors++;
        }
      }
    }),
  );
  const wallMs = Date.now() - startedAt;
  const total = workers * asksPerWorker;

  console.log(
    JSON.stringify(
      {
        workers,
        totalRequests: total,
        errors,
        wallSeconds: Number((wallMs / 1000).toFixed(2)),
        throughputPerSecond: Number((total / (wallMs / 1000)).toFixed(1)),
        latencyMs: {
          p50: percentile(latencies, 50),
          p95: percentile(latencies, 95),
          p99: percentile(latencies, 99),
          max: Math.max(...latencies),
        },
      },
      null,
      2,
    ),
  );
  await sqlClient.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
