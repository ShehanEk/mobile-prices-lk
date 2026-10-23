CREATE TYPE "public"."category" AS ENUM('phones');--> statement-breakpoint
CREATE TYPE "public"."run_actor" AS ENUM('ci', 'desktop', 'cli');--> statement-breakpoint
CREATE TYPE "public"."run_kind" AS ENUM('scrape', 'normalize');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('running', 'ok', 'failed', 'abandoned');--> statement-breakpoint
CREATE TABLE "pipeline_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" "run_kind" NOT NULL,
	"shop" text,
	"status" "run_status" DEFAULT 'running' NOT NULL,
	"actor" "run_actor" NOT NULL,
	"host" text,
	"dry_run" boolean DEFAULT false NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"duration_ms" integer,
	"scraped" integer,
	"inserted" integer,
	"with_price" integer,
	"stats" jsonb,
	"error" text,
	"log_tail" text
);
--> statement-breakpoint
CREATE TABLE "raw_listings" (
	"id" serial PRIMARY KEY NOT NULL,
	"shop" text NOT NULL,
	"source_url" text NOT NULL,
	"raw_title" text NOT NULL,
	"raw_price_text" text,
	"raw_payload" jsonb,
	"scraped_at" timestamp with time zone DEFAULT now() NOT NULL,
	"normalized_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "pipeline_runs_recent_idx" ON "pipeline_runs" USING btree ("kind","shop","started_at");--> statement-breakpoint
CREATE INDEX "raw_listings_pending_idx" ON "raw_listings" USING btree ("normalized_at","scraped_at");