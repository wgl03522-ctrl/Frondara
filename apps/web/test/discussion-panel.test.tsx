import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Discussion } from '@pnode/core';
import { DiscussionPanel } from '../src/features/discussions/DiscussionPanel.js';

const active: Discussion = {
  id: 'discussion-id',
  title: '论证强度',
  status: 'active',
  anchor: {
    documentPath: 'Paper/main.md',
    quote: '本研究证明结果有效。',
    prefix: '',
    suffix: '',
    headingPath: ['结果'],
    documentVersionId: 'v1'
  },
  messages: [{
    id: 'message-id',
    role: 'user',
    delivery: 'sent',
    content: '检查论证',
    createdAt: '2026-07-14T00:00:00.000Z'
  }],
  createdAt: '2026-07-14T00:00:00.000Z',
  updatedAt: '2026-07-14T00:00:00.000Z'
};

describe('discussion panel contexts', () => {
  it('shows the anchor, opens context management, and sends the plain question', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    const onOpenContext = vi.fn();
    render(
      <DiscussionPanel
        discussion={active}
        contextSummary="文档 · 段落 · 历史"
        onClose={vi.fn()}
        onSend={onSend}
        onOpenContext={onOpenContext}
      />
    );

    expect(screen.getByText('“本研究证明结果有效。”')).toBeVisible();
    // The composer surfaces a context summary and opens the panel on click.
    await user.click(screen.getByRole('button', { name: '管理上下文' }));
    expect(onOpenContext).toHaveBeenCalled();

    await user.type(screen.getByRole('textbox', { name: '讨论输入' }), '继续分析');
    await user.click(screen.getByRole('button', { name: '发送' }));
    // Context is managed by the panel now; send carries only the question text.
    expect(onSend).toHaveBeenCalledWith('继续分析');
  });

  it('fills the composer from an empty-state task chip', async () => {
    const user = userEvent.setup();
    const pendingAnchor: Discussion['anchor'] = {
      documentPath: 'Paper/main.md',
      quote: '本研究证明结果有效。',
      prefix: '',
      suffix: '',
      headingPath: ['结果'],
      documentVersionId: 'v1'
    };
    const draft: Discussion = {
      ...active,
      id: 'draft-id',
      status: 'draft',
      anchor: pendingAnchor,
      messages: []
    };
    render(<DiscussionPanel discussion={draft} onClose={vi.fn()} onSend={vi.fn()} />);

    const input = screen.getByRole('textbox', { name: '讨论输入' });
    expect(input).toHaveValue('');
    await user.click(screen.getByRole('button', { name: '检查论证强度' }));
    expect(input).toHaveValue('检查这段论证的前提、证据和结论强度。');
  });

  it('shows the anchor position from the heading path', () => {
    render(<DiscussionPanel discussion={active} onClose={vi.fn()} onSend={vi.fn()} />);
    expect(screen.getByText('结果')).toBeVisible();
  });
});
