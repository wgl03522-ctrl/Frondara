import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/app/App.js';
import { api } from '../src/api/client.js';

function mockOpenWorkspace(overrides: Partial<{ theme: 'light' | 'dark' | 'system'; readingFont: 'sans' | 'serif' }> = {}) {
  vi.spyOn(api, 'readWorkspace').mockResolvedValue({ open: true, root: 'C:\\Research\\paper' });
  vi.spyOn(api, 'listDocuments').mockResolvedValue([]);
  vi.spyOn(api, 'readUiState').mockResolvedValue({
    filePanelWidth: 240,
    filePanelPinned: false,
    discussionWidth: 392,
    discussionOpen: false,
    theme: 'light',
    readingFont: 'sans',
    ...overrides
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  delete document.documentElement.dataset.theme;
  delete document.documentElement.dataset.readingFont;
});

describe('appearance', () => {
  it('applies the hydrated theme and reading font to the document element', async () => {
    mockOpenWorkspace({ theme: 'dark', readingFont: 'serif' });
    render(<App />);
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'));
    expect(document.documentElement.dataset.readingFont).toBe('serif');
  });

  it('cycles the theme and persists the change', async () => {
    const user = userEvent.setup();
    mockOpenWorkspace();
    const save = vi.spyOn(api, 'saveUiState').mockResolvedValue({
      filePanelWidth: 240,
      filePanelPinned: false,
      discussionWidth: 392,
      discussionOpen: false,
      theme: 'dark',
      readingFont: 'sans'
    });
    render(<App />);

    const themeButton = await screen.findByRole('button', { name: /浅色主题/ });
    await user.click(themeButton);
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'));
    expect(save).toHaveBeenCalled();
  });

  it('toggles the reading font and persists the change', async () => {
    const user = userEvent.setup();
    mockOpenWorkspace();
    const save = vi.spyOn(api, 'saveUiState').mockResolvedValue({
      filePanelWidth: 240,
      filePanelPinned: false,
      discussionWidth: 392,
      discussionOpen: false,
      theme: 'light',
      readingFont: 'serif'
    });
    render(<App />);

    const fontButton = await screen.findByRole('button', { name: /阅读字体：无衬线/ });
    await user.click(fontButton);
    await waitFor(() => expect(document.documentElement.dataset.readingFont).toBe('serif'));
    expect(save).toHaveBeenCalled();
  });
});
