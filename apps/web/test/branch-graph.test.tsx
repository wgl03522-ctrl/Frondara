import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Discussion } from '@pnode/core';
import { BranchGraphOverlay } from '../src/features/discussions/BranchGraphOverlay.js';

const anchor = {
  documentPath: 'Paper/main.md', quote: '需要讨论的句子', prefix: '', suffix: '',
  headingPath: ['结论'], documentVersionId: 'v1'
};

const root: Discussion = {
  id: 'disc-1', title: '当前结论是否表达过强', status: 'active', anchor, messages: [],
  createdAt: '2026-07-14T00:00:00.000Z', updatedAt: '2026-07-14T00:00:00.000Z'
};

const branch: Discussion = {
  id: 'disc-2', title: '如何定义和测量学习效率', status: 'active', anchor, messages: [],
  parentDiscussionId: 'disc-1', forkedFromMessageId: 'm-ai',
  createdAt: '2026-07-14T00:01:00.000Z', updatedAt: '2026-07-14T00:01:00.000Z'
};

describe('BranchGraphOverlay', () => {
  it('renders every discussion as a graph node and marks the current one', () => {
    render(
      <BranchGraphOverlay
        discussions={[root, branch]}
        currentId="disc-1"
        onOpenBranch={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const graph = screen.getByRole('tree', { name: '讨论关系图' });
    expect(within(graph).getByText('当前结论是否表达过强')).toBeVisible();
    expect(within(graph).getByText('如何定义和测量学习效率')).toBeVisible();
    // The current node is not a switch target.
    expect(within(graph).getByRole('treeitem', { name: /当前结论是否表达过强/ })).toBeDisabled();
  });

  it('switches to a branch on click', async () => {
    const user = userEvent.setup();
    const onOpenBranch = vi.fn();
    render(
      <BranchGraphOverlay
        discussions={[root, branch]}
        currentId="disc-1"
        onOpenBranch={onOpenBranch}
        onClose={vi.fn()}
      />
    );

    await user.click(screen.getByRole('treeitem', { name: /如何定义和测量学习效率/ }));
    expect(onOpenBranch).toHaveBeenCalledWith(branch);
  });

  it('closes on the close button', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <BranchGraphOverlay discussions={[root, branch]} onOpenBranch={vi.fn()} onClose={onClose} />
    );

    await user.click(screen.getByRole('button', { name: '关闭关系图' }));
    expect(onClose).toHaveBeenCalled();
  });
});
