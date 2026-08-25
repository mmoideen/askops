CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"question" text NOT NULL,
	"refused" boolean NOT NULL,
	"retrieved_chunk_ids" integer[] NOT NULL,
	"cited_chunk_ids" integer[] NOT NULL,
	"injection_flagged" boolean DEFAULT false NOT NULL,
	"injection_labels" text[] NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer NOT NULL,
	"output_tokens" integer NOT NULL,
	"estimated_cost_micro_usd" bigint NOT NULL,
	"latency_ms" integer NOT NULL,
	"trace_id" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "audit_log_at_idx" ON "audit_log" USING btree ("at");--> statement-breakpoint
CREATE INDEX "audit_log_user_idx" ON "audit_log" USING btree ("user_id","at");