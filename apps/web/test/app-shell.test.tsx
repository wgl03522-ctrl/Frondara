import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/app/App.js';
import { api } from '../src/api/client.js';

function mockClosedWorkspace() {
  vi.spyOn(api, 'readWorkspace').mockResolvedValue({ open: false });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('application shell', () => {
  it('uses the focused editor layout and keeps discussions closed initially', async () => {
    mockClosedWorkspace();
    render(<App />);

    expect(screen.getByRole('navigation', { name: '工作区工具' })).toBeVisible();
    expect(screen.getByRole('main', { name: '主文档' })).toBeVisible();
    expect(screen.queryByRole('complementary', { name: '段落讨论' })).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '打开一个本地工作区' })).toBeVisible();
  });

  it('opens a local workspace from the empty state', async () => {
    const user = userEvent.setup();
    mockClosedWorkspace();
    vi.spyOn(api, 'openWorkspace').mockResolvedValue({ root: 'C:\\Research\\paper' });
    vi.spyOn(api, 'listDocuments').mockResolvedValue([
      { type: 'file', path: 'main.md', name: 'main.md' }
    ]);
    vi.spyOn(api, 'readUiState').mockResolvedValue({
      filePanelWidth: 240,
      filePanelPinned: false,
      discussionWidth: 392,
      discussionOpen: false,
      theme: 'light',
      readingFont: 'sans'
    });
    render(<App />);

    await user.type(await screen.findByRole('textbox', { name: '工作区文件夹路径' }), 'C:\\Research\\paper');
    await user.click(screen.getByRole('button', { name: '打开工作区' }));
    await waitFor(() => expect(api.openWorkspace).toHaveBeenCalledWith('C:\\Research\\paper'));
    expect(await screen.findByRole('heading', { name: '选择或创建一个 Markdown 文档' })).toBeVisible();
  });

  it('retries transient startup failures before showing the workspace', async () => {
    vi.useFakeTimers();
    vi.spyOn(api, 'readWorkspace')
      .mockRejectedValueOnce(new Error('fetch failed'))
      .mockRejectedValueOnce(new Error('fetch failed'))
      .mockResolvedValue({ open: true, root: 'C:\\Research\\paper' });
    vi.spyOn(api, 'listDocuments').mockResolvedValue([]);
    vi.spyOn(api, 'readUiState').mockResolvedValue({
      filePanelWidth: 240,
      filePanelPinned: false,
      discussionWidth: 392,
      discussionOpen: false,
      theme: 'light',
      readingFont: 'sans'
    });
    render(<App />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(750);
    });

    expect(api.readWorkspace).toHaveBeenCalledTimes(3);
    expect(screen.getByRole('heading', { name: '选择或创建一个 Markdown 文档' })).toBeVisible();
  });
});
