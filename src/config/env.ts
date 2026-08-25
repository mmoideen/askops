import { z } from "zod";

// Central, validated configuration. Every environment variable the app reads
// is declared here. Modules import { env } instead of touching process.env,
// so a missing or malformed value fails loudly at startup rather than
// surfacing as undefined behavior deep in a request.

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  // Auth (Entra ID / OIDC)
  AUTH_SECRET: z.string().optional(),
  AZURE_AD_CLIENT_ID: z.string().optional(),
  AZURE_AD_CLIENT_SECRET: z.string().optional(),
  AZURE_AD_TENANT_ID: z.string().optional(),
  AUTH_DEV_BYPASS: z
    .string()
    .default("false")
    .transform((v) => v === "true"),

  // LLM + embeddings
  LLM_PROVIDER: z.enum(["anthropic", "mock"]).default("anthropic"),
  LLM_MODEL: z.string().default("claude-sonnet-5"),
  ANTHROPIC_API_KEY: z.string().optional(),
  EMBEDDINGS_PROVIDER: z.enum(["local", "openai"]).default("local"),
  EMBEDDINGS_API_KEY: z.string().optional(),
  EMBEDDINGS_MODEL: z.string().default("text-embedding-3-small"),

  // Data
  DATABASE_URL: z
    .string()
    .default("postgres://postgres:postgres@localhost:5433/askops"),

  // Retrieval
  RETRIEVER: z.enum(["pgvector", "aisearch"]).default("pgvector"),
  RETRIEVAL_MIN_SIMILARITY: z.coerce.number().min(0).max(1).default(0.18),
  RETRIEVAL_TOP_K: z.coerce.number().int().min(1).max(20).default(6),
  AZURE_SEARCH_ENDPOINT: z.string().optional(),
  AZURE_SEARCH_API_KEY: z.string().optional(),
  AZURE_SEARCH_INDEX: z.string().optional(),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  const env = parsed.data;

  // next build imports modules while collecting page data, with
  // NODE_ENV=production but without runtime secrets. Strict enforcement
  // belongs to runtime boot, not the build, so it is skipped during the
  // build phase only.
  const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

  // Refuse to boot with the dev bypass enabled anywhere near production.
  const isProductionLike =
    !isBuildPhase &&
    (env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production");
  if (env.AUTH_DEV_BYPASS && isProductionLike) {
    throw new Error(
      "AUTH_DEV_BYPASS must never be enabled in production. Refusing to start.",
    );
  }

  // The anthropic provider needs its key. Fail at startup, not mid-request.
  if (
    env.LLM_PROVIDER === "anthropic" &&
    !env.ANTHROPIC_API_KEY &&
    isProductionLike
  ) {
    throw new Error(
      "LLM_PROVIDER=anthropic requires ANTHROPIC_API_KEY in production.",
    );
  }

  return env;
}

export const env = loadEnv();
export type Env = ReturnType<typeof loadEnv>;
