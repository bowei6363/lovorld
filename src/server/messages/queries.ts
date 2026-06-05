import "server-only";

import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";

import { isDemoMode } from "@/lib/env";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema/auth";
import { messages } from "@/server/db/schema/social";

export type ConversationSummary = {
  otherUser: {
    id: string;
    name: string | null;
    handle: string | null;
    avatarEmoji: string | null;
    image: string | null;
  };
  lastBody: string;
  lastAt: Date;
  unread: number;
};

export type ChatMessage = {
  id: string;
  mine: boolean;
  body: string;
  createdAt: Date;
};

export async function getConversations(userId: string): Promise<ConversationSummary[]> {
  if (isDemoMode()) return [];

  const rows = await db
    .select({
      senderId: messages.senderId,
      recipientId: messages.recipientId,
      body: messages.body,
      readAt: messages.readAt,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(or(eq(messages.senderId, userId), eq(messages.recipientId, userId)))
    .orderBy(desc(messages.createdAt))
    .limit(500);

  const byOther = new Map<string, { lastBody: string; lastAt: Date; unread: number }>();
  for (const m of rows) {
    const other = m.senderId === userId ? m.recipientId : m.senderId;
    let e = byOther.get(other);
    if (!e) {
      // rows are desc by createdAt, so the first one seen per peer is latest
      e = { lastBody: m.body, lastAt: m.createdAt, unread: 0 };
      byOther.set(other, e);
    }
    if (m.recipientId === userId && m.readAt === null) e.unread++;
  }

  const otherIds = [...byOther.keys()];
  if (otherIds.length === 0) return [];

  const us = await db
    .select({
      id: users.id,
      name: users.name,
      handle: users.handle,
      avatarEmoji: users.avatarEmoji,
      image: users.image,
    })
    .from(users)
    .where(inArray(users.id, otherIds));
  const uMap = new Map(us.map((u) => [u.id, u]));

  return otherIds
    .map((id) => {
      const e = byOther.get(id)!;
      const u = uMap.get(id);
      return {
        otherUser: {
          id,
          name: u?.name ?? null,
          handle: u?.handle ?? null,
          avatarEmoji: u?.avatarEmoji ?? null,
          image: u?.image ?? null,
        },
        lastBody: e.lastBody,
        lastAt: e.lastAt,
        unread: e.unread,
      };
    })
    .sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime());
}

export async function getConversation(userId: string, otherId: string): Promise<ChatMessage[]> {
  if (isDemoMode()) return [];

  const rows = await db
    .select({
      id: messages.id,
      senderId: messages.senderId,
      body: messages.body,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(
      or(
        and(eq(messages.senderId, userId), eq(messages.recipientId, otherId)),
        and(eq(messages.senderId, otherId), eq(messages.recipientId, userId)),
      ),
    )
    .orderBy(messages.createdAt)
    .limit(500);

  return rows.map((r) => ({
    id: r.id,
    mine: r.senderId === userId,
    body: r.body,
    createdAt: r.createdAt,
  }));
}

export async function countUnreadMessages(userId: string): Promise<number> {
  if (isDemoMode()) return 0;
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(messages)
    .where(and(eq(messages.recipientId, userId), isNull(messages.readAt)));
  return Number(row?.count ?? 0);
}

export async function getUserBrief(otherId: string) {
  const [u] = await db
    .select({
      id: users.id,
      name: users.name,
      handle: users.handle,
      avatarEmoji: users.avatarEmoji,
      image: users.image,
    })
    .from(users)
    .where(eq(users.id, otherId))
    .limit(1);
  return u ?? null;
}
