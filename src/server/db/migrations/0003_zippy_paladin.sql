ALTER TABLE "user" ADD COLUMN "tasteEmbedding" vector(1024);--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "tasteUpdatedAt" timestamp;