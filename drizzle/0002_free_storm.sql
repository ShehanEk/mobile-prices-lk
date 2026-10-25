ALTER TYPE "public"."run_kind" ADD VALUE 'specs';--> statement-breakpoint
CREATE TABLE "phone_specs" (
	"brand" text NOT NULL,
	"model" text NOT NULL,
	"matched" boolean NOT NULL,
	"gsmarena_url" text,
	"main_camera" text,
	"display" text,
	"network" text,
	"colours" text,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "phone_specs_brand_model_pk" PRIMARY KEY("brand","model")
);
