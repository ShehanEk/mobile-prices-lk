ALTER TYPE "public"."run_kind" ADD VALUE 'reviews';--> statement-breakpoint
CREATE TABLE "phone_reviews" (
	"brand" text NOT NULL,
	"model" text NOT NULL,
	"video_id" text NOT NULL,
	"position" integer NOT NULL,
	"title" text NOT NULL,
	"channel" text NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "phone_reviews_brand_model_video_id_pk" PRIMARY KEY("brand","model","video_id")
);
