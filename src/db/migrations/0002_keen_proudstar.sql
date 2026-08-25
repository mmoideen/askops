CREATE TABLE "rate_limit_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "rate_limit_events_key_at_idx" ON "rate_limit_events" USING btree ("key","at");