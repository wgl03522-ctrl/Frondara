import { describe, expect, it } from 'vitest';
import type { Discussion } from '@pnode/core';
import { connectedDiscussions } from '../src/features/discussions/branch-family.js';

const anchor = {
  documentPath: 'main.md', quote: 'q', prefix: '', suffix: '',
  headingPath: [], documentVersionId: 'v1'
};

function make(id: string, parentId?: string, quote = 'q'): Discussion {
  return {
    id,
    title: id,
    status: 'active',
    anchor: { ...anchor, quote },
    messages: [],
    ...(parentId ? { parentDiscussionId: parentId } : {}),
    createdAt: '2026-07-14T00:00:00.000Z',
    updatedAt: '2026-07-14T00:00:00.000Z'
  };
}

describe('connectedDiscussions', () => {
  it('returns the whole family when starting from a child (walks up and down)', () => {
    // root → a → a1, plus sibling b. Starting from the deep child a1 must surface
    // root, a, a1 and b (b is reachable through root), but not an unrelated tree.
    const root = make('root');
    const a = make('a', 'root');
    const a1 = make('a1', 'a');
    const b = make('b', 'root');
    const other = make('other');
    const otherChild = make('other-child', 'other');

    const ids = connectedDiscussions([root, a, a1, b, other, otherChild], 'a1').map((d) => d.id);
    expect(ids.sort()).toEqual(['a', 'a1', 'b', 'root']);
  });

  it('surfaces the full family even when quotes differ (structure beats quote)', () => {
    // A fork whose anchor has drifted to a different quote must still be part of
    // the family — the tree is defined by parent links, not quote equality.
    const root = make('root', undefined, 'original');
    const child = make('child', 'root', 'drifted quote');

    const ids = connectedDiscussions([root, child], 'child').map((d) => d.id);
    expect(ids.sort()).toEqual(['child', 'root']);
  });

  it('returns a lone discussion with no links as just itself', () => {
    const solo = make('solo');
    const unrelated = make('unrelated');
    expect(connectedDiscussions([solo, unrelated], 'solo').map((d) => d.id)).toEqual(['solo']);
  });

  it('ignores a dangling parent link that points outside the set', () => {
    const orphan = make('orphan', 'missing-parent');
    expect(connectedDiscussions([orphan], 'orphan').map((d) => d.id)).toEqual(['orphan']);
  });

  it('returns empty when the start id is absent', () => {
    expect(connectedDiscussions([make('a')], 'nope')).toEqual([]);
  });
});
