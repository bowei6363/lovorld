/**
 * Static fixtures for demo mode. Used only when LOVORLD_DEMO_MODE=1.
 *
 * The intent is to let someone click around the full UI without provisioning
 * Postgres, OAuth providers, R2, or DeepSeek. Every data-access function in
 * the app checks isDemoMode() at the top and routes to the fixtures here.
 *
 * Image URLs use picsum.photos with stable seeds so reloads keep the same
 * pictures (great for screenshots / shareable demo).
 */
import "server-only";

export const DEMO_SELF_ID = "demo-self";

export type DemoUser = {
  id: string;
  name: string | null;
  handle: string | null;
  image: string | null;
  bio: string | null;
  email: string;
  createdAt: Date;
};

export type DemoPost = {
  id: string;
  userId: string;
  caption: string | null;
  description: string | null;
  imageUrl: string;
  width: number;
  height: number;
  status: "pending_analysis" | "ready" | "failed";
  createdAt: Date;
};

export type DemoComment = {
  id: string;
  postId: string;
  authorId: string;
  body: string;
  createdAt: Date;
};

export type DemoNotification = {
  id: string;
  type: "post_like" | "post_comment";
  actorId: string;
  postId: string | null;
  commentBody: string | null;
  readAt: Date | null;
  createdAt: Date;
};

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

function img(seed: string): string {
  return `https://picsum.photos/seed/${seed}/1200/900`;
}

export const demoUsers: DemoUser[] = [
  {
    id: DEMO_SELF_ID,
    name: "You",
    handle: "you",
    image: null,
    bio: "Trying lovorld in demo mode.",
    email: "you@example.com",
    createdAt: daysAgo(7),
  },
  {
    id: "demo-alice",
    name: "Alice Chen",
    handle: "alice",
    image: img("alice-avatar"),
    bio: "Color, texture, soft light. Lives for film stills.",
    email: "alice@example.com",
    createdAt: daysAgo(40),
  },
  {
    id: "demo-bob",
    name: "Bob Mendes",
    handle: "bob",
    image: img("bob-avatar"),
    bio: "Brutalism, coastline, long exposures.",
    email: "bob@example.com",
    createdAt: daysAgo(60),
  },
  {
    id: "demo-mia",
    name: "Mia Park",
    handle: "mia",
    image: img("mia-avatar"),
    bio: "Food, flowers, warm yellows.",
    email: "mia@example.com",
    createdAt: daysAgo(20),
  },
];

export const demoPosts: DemoPost[] = [
  {
    id: "demo-p1",
    userId: DEMO_SELF_ID,
    caption: "Foggy peaks at dawn",
    description:
      "A misty alpine landscape in pale blues and silver. The composition is wide and quiet, with overlapping mountain silhouettes fading into a soft horizon. Mood: contemplative, cold, expansive.",
    imageUrl: img("mountain-mist"),
    width: 1200,
    height: 900,
    status: "ready",
    createdAt: daysAgo(2),
  },
  {
    id: "demo-p2",
    userId: DEMO_SELF_ID,
    caption: "Neon Tokyo",
    description:
      "Saturated reds and electric purples reflect off wet pavement. Tight crop, low angle, heavy atmosphere. Mood: kinetic, nocturnal.",
    imageUrl: img("neon-city"),
    width: 1200,
    height: 900,
    status: "ready",
    createdAt: daysAgo(5),
  },
  {
    id: "demo-p3",
    userId: "demo-alice",
    caption: "Petal study",
    description:
      "Macro pastel study of a single flower. Soft pinks and creams, narrow depth of field. Reads like an oil painting.",
    imageUrl: img("petal-study"),
    width: 1200,
    height: 900,
    status: "ready",
    createdAt: daysAgo(1),
  },
  {
    id: "demo-p4",
    userId: "demo-alice",
    caption: null,
    description:
      "Concrete brutalist facade caught in raking afternoon light. Geometry-forward, warm grays.",
    imageUrl: img("brutalism-1"),
    width: 1200,
    height: 900,
    status: "ready",
    createdAt: daysAgo(3),
  },
  {
    id: "demo-p5",
    userId: "demo-alice",
    caption: "Wave",
    description:
      "Frozen mid-curl, the ocean shows aquamarine and white foam against deep navy. Motion implied by spray.",
    imageUrl: img("ocean-wave"),
    width: 1200,
    height: 900,
    status: "ready",
    createdAt: daysAgo(6),
  },
  {
    id: "demo-p6",
    userId: "demo-bob",
    caption: "Lonely lighthouse",
    description:
      "Cold coastal blues with a single red beacon. Long exposure smooths the sea into a flat plane.",
    imageUrl: img("lighthouse"),
    width: 1200,
    height: 900,
    status: "ready",
    createdAt: daysAgo(4),
  },
  {
    id: "demo-p7",
    userId: "demo-bob",
    caption: null,
    description:
      "Glass tower abstracted into vertical bands. Clean grays with one streak of late-day gold.",
    imageUrl: img("building-glass"),
    width: 1200,
    height: 900,
    status: "ready",
    createdAt: daysAgo(8),
  },
  {
    id: "demo-p8",
    userId: "demo-mia",
    caption: "Morning bread",
    description:
      "Warm yellows on linen. Steam visible against a dark backdrop. Cozy domestic still life.",
    imageUrl: img("bread"),
    width: 1200,
    height: 900,
    status: "ready",
    createdAt: daysAgo(1),
  },
  {
    id: "demo-p9",
    userId: "demo-mia",
    caption: "Velvet petal",
    description:
      "Deep crimson texture, almost too saturated to feel real. Single subject, black background.",
    imageUrl: img("velvet-petal"),
    width: 1200,
    height: 900,
    status: "ready",
    createdAt: daysAgo(9),
  },
];

export const demoComments: DemoComment[] = [
  {
    id: "demo-c1",
    postId: "demo-p3",
    authorId: "demo-bob",
    body: "The texture work here is amazing.",
    createdAt: daysAgo(1),
  },
  {
    id: "demo-c2",
    postId: "demo-p3",
    authorId: "demo-mia",
    body: "I keep coming back to this one.",
    createdAt: daysAgo(1),
  },
  {
    id: "demo-c3",
    postId: "demo-p3",
    authorId: DEMO_SELF_ID,
    body: "Same energy as my misty mountain — you'd dig my feed.",
    createdAt: daysAgo(0.5),
  },
  {
    id: "demo-c4",
    postId: "demo-p2",
    authorId: "demo-bob",
    body: "Beautiful tones. What was your shutter?",
    createdAt: daysAgo(4),
  },
];

export const demoNotifications: DemoNotification[] = [
  {
    id: "demo-n1",
    type: "post_like",
    actorId: "demo-alice",
    postId: "demo-p1",
    commentBody: null,
    readAt: null,
    createdAt: daysAgo(0.2),
  },
  {
    id: "demo-n2",
    type: "post_comment",
    actorId: "demo-bob",
    postId: "demo-p2",
    commentBody: "Beautiful tones. What was your shutter?",
    readAt: null,
    createdAt: daysAgo(4),
  },
  {
    id: "demo-n3",
    type: "post_like",
    actorId: "demo-mia",
    postId: "demo-p2",
    commentBody: null,
    readAt: daysAgo(5),
    createdAt: daysAgo(5),
  },
];

// Fake "X% taste match" similarity scores for the feed, indexed by post id.
export const demoSimilarity: Record<string, number> = {
  "demo-p3": 0.94,
  "demo-p9": 0.91,
  "demo-p8": 0.87,
  "demo-p4": 0.82,
  "demo-p5": 0.78,
  "demo-p6": 0.74,
  "demo-p7": 0.69,
};

// Fake like counts. demo-self liked exactly demo-p3 and demo-p9.
export const demoLikes: Record<string, { count: number; selfLiked: boolean }> = {
  "demo-p1": { count: 4, selfLiked: false },
  "demo-p2": { count: 7, selfLiked: false },
  "demo-p3": { count: 12, selfLiked: true },
  "demo-p4": { count: 2, selfLiked: false },
  "demo-p5": { count: 5, selfLiked: false },
  "demo-p6": { count: 3, selfLiked: false },
  "demo-p7": { count: 1, selfLiked: false },
  "demo-p8": { count: 6, selfLiked: false },
  "demo-p9": { count: 9, selfLiked: true },
};

export function findDemoUser(id: string): DemoUser | null {
  return demoUsers.find((u) => u.id === id) ?? null;
}

export function findDemoPost(id: string): DemoPost | null {
  return demoPosts.find((p) => p.id === id) ?? null;
}
