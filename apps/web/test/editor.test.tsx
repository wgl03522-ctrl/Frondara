import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditorWorkspace } from '../src/features/editor/EditorWorkspace.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('EditorWorkspace', () => {
  it('loads Markdown and autosaves without replacing the editor', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      requests.push(init ? { url, init } : { url });
      if (init?.method === 'PUT') {
        return new Response(JSON.stringify({ path: 'Paper/main.md', versionId: 'v2' }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({
        path: 'Paper/main.md',
        content: '# 标题\n\n正文',
        versionId: 'v1'
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    render(<EditorWorkspace documentPath="Paper/main.md" />);

    expect(await screen.findByRole('heading', { name: '标题' })).toBeVisible();
    const editor = screen.getByRole('textbox', { name: 'Markdown 编辑器' });
    const paragraph = editor.querySelector('p');
    if (!paragraph?.firstChild) throw new Error('PARAGRAPH_MISSING');
    const selection = window.getSelection();
    const range = document.createRange();
    range.setStart(paragraph.firstChild, paragraph.firstChild.textContent?.length ?? 0);
    range.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(range);
    editor.focus();
    await user.keyboard(' 新内容');

    await waitFor(() => {
      expect(requests.some((request) => request.init?.method === 'PUT')).toBe(true);
    }, { timeout: 2_000 });
    expect(editor).toHaveFocus();

    const saveRequest = requests.find((request) => request.init?.method === 'PUT');
    expect(JSON.parse(String(saveRequest?.init?.body))).toMatchObject({ expectedVersionId: 'v1' });
  });

  it('preserves editor content and pauses autosave on a version conflict', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        return new Response(JSON.stringify({ code: 'VERSION_CONFLICT', message: 'VERSION_CONFLICT' }), {
          status: 409,
          headers: { 'content-type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({
        path: 'Paper/main.md',
        content: '# 标题\n\n正文',
        versionId: 'v1'
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    render(<EditorWorkspace documentPath="Paper/main.md" />);
    const editor = await screen.findByRole('textbox', { name: 'Markdown 编辑器' });
    await screen.findByRole('heading', { name: '标题' });
    const paragraph = editor.querySelector('p');
    if (!paragraph?.firstChild) throw new Error('PARAGRAPH_MISSING');
    const selection = window.getSelection();
    const range = document.createRange();
    range.setStart(paragraph.firstChild, paragraph.firstChild.textContent?.length ?? 0);
    range.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(range);
    editor.focus();
    await user.keyboard(' 保留这段内容');

    expect(await screen.findByRole('alert', {}, { timeout: 2_000 })).toHaveTextContent('磁盘版本已变化');
    expect(editor).toHaveTextContent('保留这段内容');
  });
});
