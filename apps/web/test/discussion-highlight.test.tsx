import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Discussion } from '@pnode/core';
import { EditorWorkspace } from '../src/features/editor/EditorWorkspace.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubDocument(content: string) {
  const fetchMock = vi.fn(async () =>
    new Response(JSON.stringify({ path: 'Paper/main.md', content, versionId: 'v1' }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    })
  );
  vi.stubGlobal('fetch', fetchMock);
}

const discussion: Discussion = {
  id: 'disc-1',
  title: '论证是否过强',
  status: 'active',
  anchor: {
    documentPath: 'Paper/main.md',
    quote: '结构化反馈能够显著提高学习效率',
    prefix: '',
    suffix: '',
    headingPath: ['结论'],
    documentVersionId: 'v1'
  },
  messages: [
    { id: 'm-user', role: 'user', delivery: 'sent', content: '这里表达是否过强?', createdAt: '2026-07-14T00:00:00.000Z' }
  ],
  createdAt: '2026-07-14T00:00:00.000Z',
  updatedAt: '2026-07-14T00:00:00.000Z'
};

describe('paragraph-level discussion highlight', () => {
  it('renders an inline highlight over the anchored quote and opens the discussion on click', async () => {
    stubDocument('# 结论\n\n结构化反馈能够显著提高学习效率，值得推广。');
    const onOpenExistingDiscussion = vi.fn();
    const user = userEvent.setup();

    render(
      <EditorWorkspace
        documentPath="Paper/main.md"
        discussions={[discussion]}
        onOpenExistingDiscussion={onOpenExistingDiscussion}
      />
    );

    await screen.findByRole('heading', { name: '结论' });

    const highlight = await waitFor(() => {
      const node = document.querySelector('.discussion-highlight');
      if (!node) throw new Error('HIGHLIGHT_MISSING');
      return node as HTMLElement;
    });
    expect(highlight.getAttribute('data-status')).toBe('active');
    expect(highlight.textContent).toContain('结构化反馈能够显著提高学习效率');

    await user.click(highlight);
    expect(onOpenExistingDiscussion).toHaveBeenCalledWith(discussion);
  });

  it('does not render a highlight when the quote is absent from the document', async () => {
    stubDocument('# 结论\n\n完全不同的一段文字。');
    render(<EditorWorkspace documentPath="Paper/main.md" discussions={[discussion]} />);

    await screen.findByRole('heading', { name: '结论' });
    // Give the decoration effect a chance to run before asserting absence.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(document.querySelector('.discussion-highlight')).toBeNull();
  });
});
