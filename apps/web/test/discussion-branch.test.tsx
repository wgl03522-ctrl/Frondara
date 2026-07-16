import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Discussion } from '@pnode/core';
import { DiscussionPanel } from '../src/features/discussions/DiscussionPanel.js';

const anchor = {
  documentPath: 'Paper/main.md', quote: '需要讨论的句子', prefix: '', suffix: '',
  headingPath: ['结论'], documentVersionId: 'v1'
};

const active: Discussion = {
  id: 'disc-1',
  title: '当前结论是否表达过强',
  status: 'active',
  anchor,
  messages: [
    { id: 'm-user', role: 'user', delivery: 'sent', content: '这里表达是否过强?', createdAt: '2026-07-14T00:00:00.000Z' },
    { id: 'm-ai', role: 'assistant', delivery: 'complete', content: '可能超出证据范围。', createdAt: '2026-07-14T00:00:01.000Z' }
  ],
  createdAt: '2026-07-14T00:00:00.000Z',
  updatedAt: '2026-07-14T00:00:01.000Z'
};

const branch: Discussion = {
  id: 'disc-2',
  title: '如何定义和测量学习效率',
  status: 'active',
  anchor,
  messages: [],
  parentDiscussionId: 'disc-1',
  forkedFromMessageId: 'm-ai',
  createdAt: '2026-07-14T00:01:00.000Z',
  updatedAt: '2026-07-14T00:01:00.000Z'
};

describe('DiscussionPanel branching (hidden advanced action)', () => {
  it('does not show the fork action until the message more-menu is opened', () => {
    render(<DiscussionPanel discussion={active} onClose={vi.fn()} onSend={vi.fn()} onFork={vi.fn()} />);
    // The advanced action is not surfaced by default — it stays hidden behind "更多操作".
    expect(screen.queryByRole('button', { name: '从这里另行讨论' })).not.toBeInTheDocument();
  });

  it('forks by asking for the new question first, not a name (backlog #1)', async () => {
    const user = userEvent.setup();
    const onFork = vi.fn().mockResolvedValue(undefined);
    render(<DiscussionPanel discussion={active} onClose={vi.fn()} onSend={vi.fn()} onFork={onFork} />);

    const aiMessage = screen.getByText('可能超出证据范围。').closest('article')!;
    await user.click(within(aiMessage).getByRole('button', { name: '更多操作' }));
    await user.click(screen.getByRole('button', { name: '从这里另行讨论' }));
    // The first thing asked for is the new question, not a title.
    await user.type(screen.getByRole('textbox', { name: '新讨论问题' }), '如何定义和测量学习效率?');
    await user.click(screen.getByRole('button', { name: '开始讨论' }));

    // No title is passed — the server derives it from the question.
    expect(onFork).toHaveBeenCalledWith('m-ai', '如何定义和测量学习效率?');
  });

  it('surfaces existing discussion directions under the source message and switches on click', async () => {
    const user = userEvent.setup();
    const onOpenBranch = vi.fn();
    render(
      <DiscussionPanel
        discussion={active}
        branches={[branch]}
        onClose={vi.fn()}
        onSend={vi.fn()}
        onFork={vi.fn()}
        onOpenBranch={onOpenBranch}
      />
    );

    expect(screen.getByText(/该消息产生了 1 个讨论方向/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: '如何定义和测量学习效率' }));
    expect(onOpenBranch).toHaveBeenCalledWith(branch);
  });

  it('renames the current discussion in place (naming is deferred and optional)', async () => {
    const user = userEvent.setup();
    const onRename = vi.fn().mockResolvedValue(undefined);
    render(<DiscussionPanel discussion={active} onClose={vi.fn()} onSend={vi.fn()} onRename={onRename} />);

    await user.click(screen.getByRole('button', { name: '重命名讨论' }));
    const input = screen.getByRole('textbox', { name: '讨论名称' });
    await user.clear(input);
    await user.type(input, '结论强度复核');
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(onRename).toHaveBeenCalledWith('disc-1', '结论强度复核');
  });

  it('offers a way back to the parent discussion from a child branch', async () => {
    const user = userEvent.setup();
    const onOpenBranch = vi.fn();
    render(
      <DiscussionPanel
        discussion={branch}
        parent={active}
        onClose={vi.fn()}
        onSend={vi.fn()}
        onFork={vi.fn()}
        onOpenBranch={onOpenBranch}
      />
    );

    await user.click(screen.getByRole('button', { name: /返回上级讨论/ }));
    expect(onOpenBranch).toHaveBeenCalledWith(active);
  });

  it('does not show a back button when there is no parent', () => {
    render(<DiscussionPanel discussion={active} onClose={vi.fn()} onSend={vi.fn()} onOpenBranch={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /返回上级讨论/ })).not.toBeInTheDocument();
  });
});
