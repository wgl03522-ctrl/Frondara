import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VersionPanel } from '../src/features/workspace/VersionPanel.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

const versions = [
  { id: 'v-2', documentPath: 'Paper/main.md', contentHash: 'h2', contentFile: '.pnode/versions/content/v-2.md', reason: 'autosave', createdAt: '2026-07-14T02:00:00.000Z' },
  { id: 'v-1', documentPath: 'Paper/main.md', contentHash: 'h1', contentFile: '.pnode/versions/content/v-1.md', reason: 'autosave', createdAt: '2026-07-14T01:00:00.000Z' }
];

describe('VersionPanel', () => {
  it('lists versions and restores one, notifying the parent', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/versions/') && url.endsWith('/restore') && init?.method === 'POST') {
        return new Response(JSON.stringify({ recoveryVersion: versions[0], restoredVersion: versions[1] }), {
          status: 200, headers: { 'content-type': 'application/json' }
        });
      }
      // list versions
      return new Response(JSON.stringify(versions), {
        status: 200, headers: { 'content-type': 'application/json' }
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const onRestored = vi.fn();
    const user = userEvent.setup();
    render(<VersionPanel documentPath="Paper/main.md" onClose={vi.fn()} onRestored={onRestored} />);

    const list = await screen.findByLabelText('版本列表');
    expect(within(list).getAllByText('自动保存')).toHaveLength(2);
    expect(within(list).getByText('最新')).toBeVisible();

    await user.click(within(list).getAllByRole('button', { name: '恢复此版本' })[1]!);
    await waitFor(() => expect(onRestored).toHaveBeenCalled());
  });

  it('shows an empty state when there are no versions', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } })
    ));
    render(<VersionPanel documentPath="Paper/main.md" onClose={vi.fn()} onRestored={vi.fn()} />);
    expect(await screen.findByText('还没有历史版本')).toBeVisible();
  });
});
