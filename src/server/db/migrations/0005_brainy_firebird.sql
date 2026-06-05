ALTER TYPE "public"."notification_type" ADD VALUE 'new_follower';--> statement-breakpoint
CREATE TABLE "bookmark" (
	"userId" text NOT NULL,
	"postId" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bookmark_userId_postId_pk" PRIMARY KEY("userId","postId")
);
--> statement-breakpoint
CREATE TABLE "follow" (
	"followerId" text NOT NULL,
	"followingId" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "follow_followerId_followingId_pk" PRIMARY KEY("followerId","followingId")
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "avatarEmoji" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "tasteKeywords" jsonb;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "onboardedAt" timestamp;--> statement-breakpoint
ALTER TABLE "post" ADD COLUMN "tags" jsonb;--> statement-breakpoint
ALTER TABLE "post" ADD COLUMN "palette" jsonb;--> statement-breakpoint
ALTER TABLE "bookmark" ADD CONSTRAINT "bookmark_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmark" ADD CONSTRAINT "bookmark_postId_post_id_fk" FOREIGN KEY ("postId") REFERENCES "public"."post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow" ADD CONSTRAINT "follow_followerId_user_id_fk" FOREIGN KEY ("followerId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow" ADD CONSTRAINT "follow_followingId_user_id_fk" FOREIGN KEY ("followingId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookmark_user_createdAt_idx" ON "bookmark" USING btree ("userId","createdAt" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "follow_following_idx" ON "follow" USING btree ("followingId");