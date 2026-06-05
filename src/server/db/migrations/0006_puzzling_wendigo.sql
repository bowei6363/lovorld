CREATE TYPE "public"."report_reason" AS ENUM('spam', 'nsfw', 'copyright', 'other');--> statement-breakpoint
CREATE TABLE "message" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"senderId" text NOT NULL,
	"recipientId" text NOT NULL,
	"body" text NOT NULL,
	"readAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporterId" text NOT NULL,
	"postId" text NOT NULL,
	"reason" "report_reason" NOT NULL,
	"note" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "taste_cluster" (
	"userId" text NOT NULL,
	"idx" integer NOT NULL,
	"centroid" vector(1024) NOT NULL,
	"size" integer NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "taste_cluster_userId_idx_pk" PRIMARY KEY("userId","idx")
);
--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_senderId_user_id_fk" FOREIGN KEY ("senderId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_recipientId_user_id_fk" FOREIGN KEY ("recipientId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report" ADD CONSTRAINT "report_reporterId_user_id_fk" FOREIGN KEY ("reporterId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report" ADD CONSTRAINT "report_postId_post_id_fk" FOREIGN KEY ("postId") REFERENCES "public"."post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taste_cluster" ADD CONSTRAINT "taste_cluster_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "message_pair_idx" ON "message" USING btree ("senderId","recipientId","createdAt" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "message_recipient_unread_idx" ON "message" USING btree ("recipientId","readAt");--> statement-breakpoint
CREATE UNIQUE INDEX "report_reporter_post_unique" ON "report" USING btree ("reporterId","postId");