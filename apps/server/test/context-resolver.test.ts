import { describe, expect, it } from 'vitest';
import type { Discussion } from '@pnode/core';
import {
  DEFAULT_CONTEXT_SPEC,
  resolveContexts,
  type ContextSpec
} from '../src/services/context-resolver.js';

const anchor = {
  documentPath: 'Paper/main.md', quote: '选定的这段话', prefix: '', suffix: '',
  headingPath: ['结论'], documentVersionId: 'v1'
};

const discussion: Discussion = {
  id: 'd-current',
  title: '当前讨论',
  status: 'active',
  anchor,
  messages: [
    { id: 'm1', role: 'user', delivery: 'sent', content: '第一个问题', createdAt: '2026-07-14T00:00:00.000Z' },
    { id: 'm2', role: 'assistant', delivery: 'complete', content: '第一个回答', createdAt: '2026-07-14T00:00:01.000Z' }
  ],
  createdAt: '2026-07-14T00:00:00.000Z',
  updatedAt: '2026-07-14T00:00:01.000Z'
};

const other: Discussion = {
  id: 'd-other',
  title: '另一个讨论',
  status: 'active',
  anchor,
  messages: [
    { id: 'o1', role: 'user', delivery: 'sent', content: '别处的问题', createdAt: '2026-07-14T00:00:00.000Z' },
    { id: 'o2', role: 'assistant', delivery: 'complete', content: '别处的回答', createdAt: '2026-07-14T00:00:01.000Z' }
  ],
  createdAt: '2026-07-14T00:00:00.000Z',
  updatedAt: '2026-07-14T00:00:01.000Z'
};

function stores(overrides: { document?: string; discussions?: Record<string, Discussion> } = {}) {
  const map = overrides.discussions ?? { 'd-other': other };
  return {
    documents: {
      read: async (path: string) => ({
        path,
        content: overrides.document ?? '# 结论\n\n选定的这段话，以及更多正文。',
        versionId: 'v1'
      })
    },
    discussions: {
      get: async (id: string) => {
        const found = map[id];
        if (!found) throw new Error('DISCUSSION_NOT_FOUND');
        return found;
      }
    }
  };
}

describe('resolveContexts', () => {
  it('by default includes document + paragraph as contexts and history as turns', async () => {
    const { contexts, history } = await resolveContexts(DEFAULT_CONTEXT_SPEC, discussion, stores());
    expect(contexts.map((c) => c.label)).toEqual(['整篇文档', '选定段落']);
    expect(contexts[0]!.content).toContain('更多正文');
    expect(contexts[1]!.content).toBe('选定的这段话');
    // History is the discussion's prior turns, expanded (not folded into contexts).
    expect(history).toEqual([
      { role: 'user', content: '第一个问题' },
      { role: 'assistant', content: '第一个回答' }
    ]);
  });

  it('drops a default block when its toggle is off', async () => {
    const spec: ContextSpec = { ...DEFAULT_CONTEXT_SPEC, includeDocument: false, includeHistory: false };
    const { contexts, history } = await resolveContexts(spec, discussion, stores());
    expect(contexts.map((c) => c.label)).toEqual(['选定段落']);
    expect(history).toEqual([]);
  });

  it('adds checked files as contexts labelled by path', async () => {
    const spec: ContextSpec = { ...DEFAULT_CONTEXT_SPEC, filePaths: ['Paper/方法.md'] };
    const { contexts } = await resolveContexts(spec, discussion, stores({ document: '文件正文' }));
    expect(contexts.some((c) => c.label === '文件：Paper/方法.md')).toBe(true);
  });

  it('formats a referenced discussion into a 问/答 transcript', async () => {
    const spec: ContextSpec = { ...DEFAULT_CONTEXT_SPEC, discussionIds: ['d-other'] };
    const { contexts } = await resolveContexts(spec, discussion, stores());
    const block = contexts.find((c) => c.label === '讨论：另一个讨论');
    expect(block).toBeTruthy();
    expect(block!.content).toBe('问：别处的问题\n答：别处的回答');
  });

  it('skips a missing discussion rather than throwing', async () => {
    const spec: ContextSpec = { ...DEFAULT_CONTEXT_SPEC, discussionIds: ['d-nope'] };
    const { contexts } = await resolveContexts(spec, discussion, stores());
    expect(contexts.some((c) => c.label.startsWith('讨论：'))).toBe(false);
  });
});
