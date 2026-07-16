import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Discussion } from '@pnode/core';
import { DiscussionPanel } from '../src/features/discussions/DiscussionPanel.js';

const draft: Discussion = {
  id: 'draft-id',
  title: '稍后验证引用',
  status: 'draft',
  anchor: {
    documentPath: 'Paper/main.md',
    quote: '需要讨论的句子',
    prefix: '前文',
    suffix: '后文',
    headingPath: ['结论'],
    documentVersionId: 'v1'
  },
  messages: [{
    id: 'message-id',
    role: 'user',
    delivery: 'unsent',
    content: '稍后验证引用',
    createdAt: '2026-07-14T00:00:00.000Z'
  }],
  createdAt: '2026-07-14T00:00:00.000Z',
  updatedAt: '2026-07-14T00:00:00.000Z'
};

describe('draft discussion activation', () => {
  it('prefills the draft and activates only after explicit send', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<DiscussionPanel discussion={draft} onClose={vi.fn()} onSend={onSend} />);

    expect(screen.getByRole('textbox', { name: '讨论输入' })).toHaveValue('稍后验证引用');
    expect(onSend).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '发送' }));
    expect(onSend).toHaveBeenCalledWith('稍后验证引用');
  });
});
