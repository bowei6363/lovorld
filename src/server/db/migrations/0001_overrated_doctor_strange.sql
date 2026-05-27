-- The vector(N) column type below requires the pgvector extension.
-- Idempotent so re-running the migration on a fresh DB Just Works.
CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TYPE "public"."post_status" AS ENUM('pending_analysis', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE "post" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" text NOT NULL,
	"r2Key" text NOT NULL,
	"mimeType" text NOT NULL,
	"byteSize" integer NOT NULL,
	"width" integer,
	"height" integer,
	"caption" text,
	"description" text,
	"embedding" vector(1024),
	"visionModel" text,
	"embeddingModel" text,
	"status" "post_status" DEFAULT 'pending_analysis' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "post" ADD CONSTRAINT "post_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "post_r2Key_unique" ON "post" USING btree ("r2Key");--> statement-breakpoint
CREATE INDEX "post_userId_createdAt_idx" ON "post" USING btree ("userId","createdAt" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "post_status_idx" ON "post" USING btree ("status");