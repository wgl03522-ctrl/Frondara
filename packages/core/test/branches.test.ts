import { expect, it } from 'vitest';
import { buildBranchTree } from '../src/index.js';

it('projects parent-child discussions into a stable tree', () => {
  const tree = buildBranchTree([
    { id: 'root', title: 'root', updatedAt: '2026-07-13T00:00:00.000Z' },
    { id: 'child', parentDiscussionId: 'root', title: 'child', updatedAt: '2026-07-13T01:00:00.000Z' }
  ]);
  expect(tree[0]?.children[0]?.id).toBe('child');
});

it('keeps orphans as roots instead of dropping them', () => {
  const tree = buildBranchTree([
    { id: 'orphan', parentDiscussionId: 'missing', title: 'orphan', updatedAt: '2026-07-13T00:00:00.000Z' }
  ]);
  expect(tree[0]?.id).toBe('orphan');
});
