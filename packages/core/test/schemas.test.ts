import { describe, expect, it } from 'vitest';
import {
  DiscussionSchema,
  MessageSchema,
  SuggestionSchema,
  TextAnchorSchema,
  UiStateSchema,
  VersionSchema
} from '../src/index.js';

describe('domain schemas', () => {
  const anchorInput = {
    documentPath: 'Paper/main.md',
    quote: '原文',
    prefix: '前文',
    suffix: '后文',
    headingPath: ['结果解释'],
    documentVersionId: 'v1'
  };

  it('accepts a draft discussion with one unsent user message', () => {
    const anchor = TextAnchorSchema.parse(anchorInput);
    const message = MessageSchema.parse({
      id: 'm1',
      role: 'user',
      delivery: 'unsent',
      content: '稍后讨论这一点',
      createdAt: '2026-07-13T00:00:00.000Z'
    });

    const discussion = DiscussionSchema.parse({
      id: 'd1',
      title: '稍后讨论这一点',
      status: 'draft',
      anchor,
      messages: [message],
      createdAt: '2026-07-13T00:00:00.000Z',
      updatedAt: '2026-07-13T00:00:00.000Z'
    });

    expect(discussion.status).toBe('draft');
    expect(discussion.messages[0]?.delivery).toBe('unsent');
  });

  it('rejects assistant messages marked as unsent', () => {
    expect(() => MessageSchema.parse({
      id: 'm2',
      role: 'assistant',
      delivery: 'unsent',
      content: '',
      createdAt: '2026-07-13T00:00:00.000Z'
    })).toThrow();
  });

  it('accepts persisted suggestions, versions, and UI state', () => {
    expect(SuggestionSchema.parse({
      id: 's1',
      discussionId: 'd1',
      sourceMessageId: 'm2',
      documentVersionId: 'v1',
      anchor: anchorInput,
      originalText: '原文',
      suggestedText: '修改后的原文',
      blocks: [{ id: 'b1', originalText: '原文', suggestedText: '修改后的原文' }],
      status: 'pending',
      createdAt: '2026-07-13T00:00:00.000Z'
    }).blocks).toHaveLength(1);

    expect(VersionSchema.parse({
      id: 'v1', documentPath: 'Paper/main.md', contentHash: 'abc',
      contentFile: 'versions/v1.md', reason: 'manual', createdAt: '2026-07-13T00:00:00.000Z'
    }).reason).toBe('manual');

    expect(UiStateSchema.parse({
      filePanelWidth: 240, filePanelPinned: false, discussionWidth: 392,
      theme: 'light', readingFont: 'sans'
    }).theme).toBe('light');
  });
});
