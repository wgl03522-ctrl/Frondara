import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Discussion } from '@pnode/core';
import { DiscussionPanel } from '../src/features/discussions/DiscussionPanel.js';

const active: Discussion = {
  id: 'd-1',
  title: '讨论',
  status: 'active',
  anchor: {
    documentPath: 'main.md',
    quote: '需要讨论的句子',
    prefix: '',
    suffix: '',
    headingPath: [],
    documentVersionId: 'v1'
  },
  messages: [
    { id: 'u1', role: 'user', delivery: 'sent', content: '第一个问题', createdAt: '2026-07-14T00:00:00.000Z' }
  ],
  createdAt: '2026-07-14T00:00:00.000Z',
  updatedAt: '2026-07-14T00:00:00.000Z'
};

describe('discussion send failure feedback', () => {
  it('shows an inline error and keeps the input usable for retry', () => {
    render(
      <DiscussionPanel
        discussion={active}
        error="API 密钥无效或已过期，请检查后重试。"
        onClose={vi.fn()}
        onSend={vi.fn()}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('API 密钥无效或已过期');
    const input = screen.getByRole('textbox', { name: '讨论输入' });
    expect(input).toBeEnabled();
    expect(screen.getByRole('button', { name: '发送' })).toBeInTheDocument();
  });
});
