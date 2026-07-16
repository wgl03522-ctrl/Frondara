import type { Discussion } from '@pnode/core';

// The "family" of a discussion is its connected component in the graph formed by
// parentDiscussionId links, treated as undirected edges. Starting from one node
// we walk to its parent and to every child, transitively, so switching into a
// child branch still surfaces the whole tree. This is deliberately independent of
// the anchor quote: quote equality is fragile (anchors can drift, and pre-existing
// forks may not match), whereas parent links are the real structure.
export function connectedDiscussions(discussions: Discussion[], startId: string): Discussion[] {
  const byId = new Map(discussions.map((item) => [item.id, item]));
  if (!byId.has(startId)) return [];

  // Adjacency: each parent link is an undirected edge between child and parent.
  const neighbours = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    if (!neighbours.has(a)) neighbours.set(a, new Set());
    neighbours.get(a)!.add(b);
  };
  for (const item of discussions) {
    const parentId = item.parentDiscussionId;
    if (parentId && byId.has(parentId)) {
      link(item.id, parentId);
      link(parentId, item.id);
    }
  }

  const seen = new Set<string>([startId]);
  const queue = [startId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of neighbours.get(current) ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }

  return discussions.filter((item) => seen.has(item.id));
}
