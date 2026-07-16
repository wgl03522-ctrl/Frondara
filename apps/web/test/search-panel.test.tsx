import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SearchPanel } from '../src/features/workspace/SearchPanel.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

const hits = [
  {
    path: 'Paper/notes.md',
    name: 'notes.md',
    matches: [{ line: 3, text: 'The QUICK brown fox' }]
  }
];

describe('SearchPanel', () => {
  it('searches on input and opens the document when a hit is clicked', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify(hits), { status: 200, headers: { 'content-type': 'application/json' } })
    ));
    const onOpenDocument = vi.fn();
    const user = userEvent.setup();
    render(<SearchPanel onOpenDocument={onOpenDocument} onClose={vi.fn()} />);

    await user.type(screen.getByRole('searchbox', { name: '搜索文档内容' }), 'quick');

    // Debounced results appear.
    expect(await screen.findByText('The QUICK brown fox')).toBeVisible();
    expect(screen.getByText('1 个文档 · 1 处匹配')).toBeVisible();

    await user.click(screen.getByRole('button', { name: /notes\.md/ }));
    await waitFor(() => expect(onOpenDocument).toHaveBeenCalledWith('Paper/notes.md'));
  });

  it('shows a no-match message when nothing is found', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } })
    ));
    const user = userEvent.setup();
    render(<SearchPanel onOpenDocument={vi.fn()} onClose={vi.fn()} />);

    await user.type(screen.getByRole('searchbox', { name: '搜索文档内容' }), 'zzz');
    expect(await screen.findByText(/没有匹配/)).toBeVisible();
  });
});
