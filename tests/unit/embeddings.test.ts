import { describe, expect, it } from "vitest";
import {
  EMBEDDING_DIMENSIONS,
  LocalHashEmbeddings,
  localEmbed,
  toVectorLiteral,
} from "../../src/rag/embeddings";

describe("local hash embeddings", () => {
  it("emits vectors of the fixed dimension", () => {
    const vec = localEmbed("How do I set up the VPN?");
    expect(vec).toHaveLength(EMBEDDING_DIMENSIONS);
  });

  it("is deterministic", () => {
    const a = localEmbed("incident escalation for SEV1");
    const b = localEmbed("incident escalation for SEV1");
    expect(a).toEqual(b);
  });

  it("is L2 normalized", () => {
    const vec = localEmbed("expense policy receipts and approvals");
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
    expect(norm).toBeCloseTo(1, 6);
  });

  it("produces different vectors for different texts", () => {
    const a = localEmbed("vpn split tunnel configuration");
    const b = localEmbed("quarterly backup restore test");
    expect(a).not.toEqual(b);
  });

  it("similar texts score higher than unrelated texts", () => {
    const query = localEmbed("vpn client setup");
    const related = localEmbed("setting up the vpn client on a laptop");
    const unrelated = localEmbed("travel per diem rates for international trips");
    const dot = (x: number[], y: number[]) =>
      x.reduce((s, v, i) => s + v * y[i], 0);
    expect(dot(query, related)).toBeGreaterThan(dot(query, unrelated));
  });

  it("provider wrapper embeds batches", async () => {
    const provider = new LocalHashEmbeddings();
    const out = await provider.embed(["one text", "another text"]);
    expect(out).toHaveLength(2);
    expect(out[0]).toHaveLength(EMBEDDING_DIMENSIONS);
  });

  it("renders pgvector literals", () => {
    const literal = toVectorLiteral([0.5, -0.25]);
    expect(literal).toBe("[0.500000,-0.250000]");
  });
});
