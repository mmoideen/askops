// Retrieval diagnostics. Runs every eval dataset question through the
// retriever with NO similarity threshold and prints what came back with
// scores, so threshold and chunking decisions rest on measured data
// instead of guesses. Referenced by the runbook for debugging "why did the
// assistant refuse / answer from the wrong document" reports.
//
// Usage: npx tsx scripts/retrieval-debug.ts [--question "..."] [--role member]
import { readFileSync } from "fs";
import { join } from "path";
import { sqlClient } from "../src/db/client";
import { allowedClassifications, type Role } from "../src/rbac/policy";
import { getRetriever } from "../src/rag/pipeline";
import type { EvalItem } from "../evals/gates";

async function show(question: string, role: Role, label: string) {
  const retriever = getRetriever();
  const results = await retriever.retrieve(question, {
    allowedClassifications: allowedClassifications(role),
    topK: 6,
    minSimilarity: 0,
  });
  console.log(`\n${label} [${role}] ${question}`);
  for (const r of results) {
    console.log(
      `  ${r.similarity.toFixed(3)}  ${r.docId} #${r.chunkIndex} (${r.classification})`,
    );
  }
}

async function main() {
  const args = process.argv.slice(2);
  const qIndex = args.indexOf("--question");
  if (qIndex >= 0) {
    const roleIndex = args.indexOf("--role");
    const role = (roleIndex >= 0 ? args[roleIndex + 1] : "member") as Role;
    await show(args[qIndex + 1], role, "adhoc");
  } else {
    const datasetPath = join(process.cwd(), "evals", "dataset.jsonl");
    const items: EvalItem[] = readFileSync(datasetPath, "utf8")
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l) as EvalItem);
    for (const item of items) {
      await show(item.question, item.role, `${item.category}/${item.id}`);
    }
  }
  await sqlClient.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
