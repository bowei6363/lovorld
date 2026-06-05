"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { isDemoMode } from "@/lib/env";
import { verifySession } from "@/server/auth/dal";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema/auth";
import { messages } from "@/server/db/schema/social";
import { USER_WRITE_LIMIT, requireRateLimit } from "@/server/limits";

const sendSchema = z.object({
  recipientId: z.string().uuid(),
  body: z.string().trim().min(1).max(2000),
});

export async function sendMessage(input: z.input<typeof sendSchema>): Promise<{ ok: true }> {
  const { userId } = await verifySession();
  const { recipientId, body } = sendSchema.parse(input);
  if (recipientId === userId) throw new Error("不能给自己发私信。");
  requireRateLimit(`dm:${userId}`, USER_WRITE_LIMIT);

  if (isDemoMode()) {
    return { ok: true };
  }

  // Make sure the recipient exists (avoid orphan messages to bad ids).
  const [recipient] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, recipientId))
    .limit(1);
  if (!recipient) throw new Error("用户不存在。");

  await db.insert(messages).values({ senderId: userId, recipientId, body });

  revalidatePath(`/messages/${recipientId}`);
  revalidatePath("/messages");
  return { ok: true };
}

export async function markConversationRead(otherUserId: string): Promise<void> {
  const { userId } = await verifySession();
  if (isDemoMode()) return;
  await db
    .update(messages)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(messages.recipientId, userId),
        eq(messages.senderId, otherUserId),
        isNull(messages.readAt),
      ),
    );
  revalidatePath("/messages");
}
