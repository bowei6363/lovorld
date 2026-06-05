/**
 * Multi-taste clustering. Instead of averaging a user's post embeddings into
 * one vector (which collapses someone who loves both "暗调极简" and
 * "高饱和治愈" into a meaningless midpoint), we k-means them into up to 3
 * centroids. The feed then recalls content close to ANY of the user's
 * clusters, so both tastes get represented.
 */
import "server-only";

import { and, eq, isNotNull } from "drizzle-orm";

import { db } from "@/server/db/client";
import { posts } from "@/server/db/schema/posts";
import { tasteClusters } from "@/server/db/schema/social";

function sqDist(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return s;
}

/** Deterministic-ish spread initialization (k-means++ lite). */
function initCentroids(vectors: number[][], k: number): number[][] {
  const centroids: number[][] = [vectors[0].slice()];
  while (centroids.length < k) {
    // pick the point farthest from its nearest existing centroid
    let bestIdx = 0;
    let bestD = -1;
    for (let i = 0; i < vectors.length; i++) {
      let nearest = Infinity;
      for (const c of centroids) {
        const d = sqDist(vectors[i], c);
        if (d < nearest) nearest = d;
      }
      if (nearest > bestD) {
        bestD = nearest;
        bestIdx = i;
      }
    }
    centroids.push(vectors[bestIdx].slice());
  }
  return centroids;
}

function kmeans(
  vectors: number[][],
  k: number,
  iters = 12,
): { centroids: number[][]; sizes: number[] } {
  const n = vectors.length;
  const dim = vectors[0].length;
  const centroids = initCentroids(vectors, k);
  const assign = new Array(n).fill(-1);

  for (let it = 0; it < iters; it++) {
    let changed = false;
    for (let i = 0; i < n; i++) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < k; c++) {
        const d = sqDist(vectors[i], centroids[c]);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      if (assign[i] !== best) {
        assign[i] = best;
        changed = true;
      }
    }

    const sums = Array.from({ length: k }, () => new Array(dim).fill(0));
    const counts = new Array(k).fill(0);
    for (let i = 0; i < n; i++) {
      counts[assign[i]]++;
      const s = sums[assign[i]];
      const v = vectors[i];
      for (let d = 0; d < dim; d++) s[d] += v[d];
    }
    for (let c = 0; c < k; c++) {
      if (counts[c] === 0) continue;
      for (let d = 0; d < dim; d++) centroids[c][d] = sums[c][d] / counts[c];
    }

    if (!changed && it > 0) break;
  }

  const sizes = new Array(k).fill(0);
  for (const a of assign) sizes[a]++;
  return { centroids, sizes };
}

/**
 * Recompute a user's taste clusters from their ready posts. Called after each
 * post finishes analysis. Clears and rewrites the user's cluster rows.
 */
export async function recomputeUserClusters(userId: string): Promise<void> {
  const rows = await db
    .select({ embedding: posts.embedding })
    .from(posts)
    .where(and(eq(posts.userId, userId), eq(posts.status, "ready"), isNotNull(posts.embedding)));

  const vectors = rows
    .map((r) => r.embedding)
    .filter((v): v is number[] => Array.isArray(v) && v.length === 1024);

  await db.delete(tasteClusters).where(eq(tasteClusters.userId, userId));

  if (vectors.length === 0) return;

  // 1-2 posts: a single centroid (the average) is all we can justify.
  const k = Math.max(1, Math.min(3, Math.floor(vectors.length / 3)));
  const { centroids, sizes } = kmeans(vectors, k);

  const values = centroids
    .map((centroid, idx) => ({ userId, idx, centroid, size: sizes[idx] }))
    .filter((v) => v.size > 0);

  if (values.length > 0) {
    await db.insert(tasteClusters).values(values);
  }
}

export async function getUserClusterCentroids(userId: string): Promise<number[][]> {
  const rows = await db
    .select({ centroid: tasteClusters.centroid })
    .from(tasteClusters)
    .where(eq(tasteClusters.userId, userId));
  return rows
    .map((r) => r.centroid)
    .filter((c): c is number[] => Array.isArray(c) && c.length === 1024);
}
