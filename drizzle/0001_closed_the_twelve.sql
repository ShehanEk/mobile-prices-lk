CREATE TYPE "public"."warranty" AS ENUM('company', 'shop', 'apple', 'unstated');--> statement-breakpoint
CREATE TABLE "listings" (
	"phone_id" text NOT NULL,
	"shop" text NOT NULL,
	"warranty" "warranty" NOT NULL,
	"warranty_text" text,
	"price_lkr" numeric(12, 2) NOT NULL,
	"url" text NOT NULL,
	"in_stock" boolean NOT NULL,
	"scraped_at" timestamp with time zone NOT NULL,
	CONSTRAINT "listings_phone_id_shop_warranty_pk" PRIMARY KEY("phone_id","shop","warranty")
);
--> statement-breakpoint
CREATE TABLE "model_decisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"input" text NOT NULL,
	"answer" text,
	"confidence" text NOT NULL,
	"reason" text NOT NULL,
	"model" text NOT NULL,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "phones" (
	"phone_id" text PRIMARY KEY NOT NULL,
	"brand" text NOT NULL,
	"model" text NOT NULL,
	"ram_gb" integer,
	"storage_gb" integer NOT NULL,
	"esim_only" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_history" (
	"phone_id" text NOT NULL,
	"shop" text NOT NULL,
	"warranty" "warranty" NOT NULL,
	"recorded_on" date NOT NULL,
	"price_lkr" numeric(12, 2) NOT NULL,
	"in_stock" boolean NOT NULL,
	CONSTRAINT "price_history_phone_id_shop_warranty_recorded_on_pk" PRIMARY KEY("phone_id","shop","warranty","recorded_on")
);
--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_phone_id_phones_phone_id_fk" FOREIGN KEY ("phone_id") REFERENCES "public"."phones"("phone_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_phone_id_phones_phone_id_fk" FOREIGN KEY ("phone_id") REFERENCES "public"."phones"("phone_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "model_decisions_kind_input_idx" ON "model_decisions" USING btree ("kind","input");