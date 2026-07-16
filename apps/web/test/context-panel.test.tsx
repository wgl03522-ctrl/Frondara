import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Discussion } from '@pnode/core';
import { ContextPanel } from '../src/features/discussions/ContextPanel.js';
import type { ContextSpec, DocumentEntry } from '../src/api/client.js';

const DEFAULT_SPEC: ContextSpec = {
  includeDocument: true,
  includeParagraph: true,
  includeHistory: true,
  filePaths: [],
  discussionIds: []
};

const anchor = {
  documentPath: 'Paper/main.md', quote: '选定段落', prefix: '', suffix: '',
  headingPath: ['结论'], documentVersionId: 'v1'
};

function discussion(id: string, title: string, parentId?: string): Discussion {
  return {
    id, title, status: 'active', anchor, messages: [],
    ...(parentId ? { parentDiscussionId: parentId, forkedFromMessageId: 'm-x' } : {}),
    createdAt: '2026-07-14T00:00:00.000Z',
    updatedAt: '2026-07-14T00:00:00.000Z'
  };
}

const discussions: Discussion[] = [
  discussion('d-current', '当前讨论'),
  discussion('d-child', '子讨论', 'd-current'),
  discussion('d-other', '另一个讨论')
];

const entries: DocumentEntry[] = [
  { type: 'file', path: 'Paper/main.md', name: 'main.md' },
  { type: 'file', path: 'Paper/方法.md', name: '方法.md' },
  { type: 'folder', path: 'Paper', name: 'Paper' }
];

describe('ContextPanel', () => {
  it('renders the three default toggles all checked', () => {
    render(
      <ContextPanel
        spec={DEFAULT_SPEC}
        onChange={vi.fn()}
        discussions={discussions}
        currentDiscussionId="d-current"
        entries={entries}
        currentDocumentPath="Paper/main.md"
        onClose={vi.fn()}
      />
    );
    const defaults = screen.getByLabelText('默认上下文');
    for (const name of ['整篇文档', '选定段落', '本讨论历史']) {
      expect(within(defaults).getByRole('checkbox', { name })).toBeChecked();
    }
  });

  it('excludes the current discussion and current document from the pick lists', () => {
    render(
      <ContextPanel
        spec={DEFAULT_SPEC}
        onChange={vi.fn()}
        discussions={discussions}
        currentDiscussionId="d-current"
        entries={entries}
        currentDocumentPath="Paper/main.md"
        onClose={vi.fn()}
      />
    );
    const tree = screen.getByLabelText('其他讨论');
    expect(within(tree).queryByText('当前讨论')).not.toBeInTheDocument();
    expect(within(tree).getByText('子讨论')).toBeVisible();
    expect(within(tree).getByText('另一个讨论')).toBeVisible();

    const filesSection = screen.getByLabelText('工作区文件');
    expect(within(filesSection).queryByText('main.md')).not.toBeInTheDocument();
    expect(within(filesSection).getByText('方法.md')).toBeVisible();
  });

  it('toggles a default off through onChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ContextPanel
        spec={DEFAULT_SPEC}
        onChange={onChange}
        discussions={discussions}
        currentDiscussionId="d-current"
        entries={entries}
        currentDocumentPath="Paper/main.md"
        onClose={vi.fn()}
      />
    );
    await user.click(screen.getByRole('checkbox', { name: '整篇文档' }));
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_SPEC, includeDocument: false });
  });

  it('checks another discussion and reports it in discussionIds', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ContextPanel
        spec={DEFAULT_SPEC}
        onChange={onChange}
        discussions={discussions}
        currentDiscussionId="d-current"
        entries={entries}
        currentDocumentPath="Paper/main.md"
        onClose={vi.fn()}
      />
    );
    await user.click(screen.getByRole('checkbox', { name: '另一个讨论' }));
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_SPEC, discussionIds: ['d-other'] });
  });

  it('checks another file and reports it in filePaths', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ContextPanel
        spec={DEFAULT_SPEC}
        onChange={onChange}
        discussions={discussions}
        currentDiscussionId="d-current"
        entries={entries}
        currentDocumentPath="Paper/main.md"
        onClose={vi.fn()}
      />
    );
    await user.click(screen.getByRole('checkbox', { name: '方法.md' }));
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_SPEC, filePaths: ['Paper/方法.md'] });
  });
});
