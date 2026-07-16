import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FilePanel } from '../src/features/workspace/FilePanel.js';

const entries = [
  { type: 'folder' as const, path: 'Paper', name: 'Paper' },
  { type: 'file' as const, path: 'Paper/main.md', name: 'main.md' }
];

describe('file panel', () => {
  it('renders an accessible tree and opens a selected Markdown document', async () => {
    const user = userEvent.setup();
    const onOpenDocument = vi.fn();
    render(
      <FilePanel
        entries={entries}
        loading={false}
        activeDocument={undefined}
        onOpenDocument={onOpenDocument}
        onCreateDocument={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole('tree', { name: '工作区文件' })).toBeVisible();
    await user.click(screen.getByRole('treeitem', { name: 'main.md' }));
    expect(onOpenDocument).toHaveBeenCalledWith('Paper/main.md');
  });

  it('validates new document paths before submitting', async () => {
    const user = userEvent.setup();
    const onCreateDocument = vi.fn();
    render(
      <FilePanel
        entries={entries}
        loading={false}
        activeDocument={undefined}
        onOpenDocument={vi.fn()}
        onCreateDocument={onCreateDocument}
        onClose={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: '新建文档' }));
    await user.type(screen.getByRole('textbox', { name: '文档路径' }), '../outside.md');
    await user.click(screen.getByRole('button', { name: '创建' }));
    expect(screen.getByRole('alert')).toHaveTextContent('请输入工作区内的 .md 相对路径');
    expect(onCreateDocument).not.toHaveBeenCalled();
  });
});
