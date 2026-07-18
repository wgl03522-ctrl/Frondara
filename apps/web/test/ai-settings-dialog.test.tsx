import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsDialog } from '../src/features/settings/SettingsDialog.js';
import { I18nProvider } from '../src/i18n/I18nProvider.js';
import { LOCALE_STORAGE_KEY } from '../src/i18n/messages.js';
import { api, ApiError } from '../src/api/client.js';

function renderSettings(props: Parameters<typeof SettingsDialog>[0]) {
  return render(<I18nProvider><SettingsDialog {...props} /></I18nProvider>);
}

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

function mockDemoSettings() {
  vi.spyOn(api, 'readAiSettings').mockResolvedValue({ mode: 'demo', baseUrl: '', model: '', hasApiKey: false });
}

describe('SettingsDialog', () => {
  it('defaults to demo mode with a blank, provider-free compatible form', async () => {
    mockDemoSettings();
    renderSettings({ onClose: vi.fn() });

    await waitFor(() => expect(api.readAiSettings).toHaveBeenCalled());
    const demoRadio = await screen.findByRole('radio', { name: /演示模式/ });
    expect(demoRadio).toBeChecked();

    await userEvent.click(screen.getByRole('radio', { name: /使用自己的 API/ }));
    const baseUrl = screen.getByRole('textbox', { name: 'API 地址' });
    const model = screen.getByRole('textbox', { name: '模型名称' });
    expect(baseUrl).toHaveValue('');
    expect(model).toHaveValue('');
    // Placeholder is a neutral example, not a real provider.
    expect(baseUrl).toHaveAttribute('placeholder', expect.stringContaining('example.com'));
  });

  it('shows a stored-key hint and keeps the password field empty', async () => {
    vi.spyOn(api, 'readAiSettings').mockResolvedValue({
      mode: 'compatible', baseUrl: 'https://api.example.com/v1/', model: 'demo-model', hasApiKey: true
    });
    renderSettings({ onClose: vi.fn() });

    expect(await screen.findByText(/已保存 API 密钥；留空将继续使用/)).toBeVisible();
    expect(screen.getByLabelText('API Key')).toHaveValue('');
    expect(screen.getByRole('textbox', { name: 'API 地址' })).toHaveValue('https://api.example.com/v1/');
  });

  it('saves a compatible configuration and reports immediate effect', async () => {
    mockDemoSettings();
    const save = vi.spyOn(api, 'saveAiSettings').mockResolvedValue({
      mode: 'compatible', baseUrl: 'https://api.example.com/v1/', model: 'demo-model', hasApiKey: true
    });
    const onSaved = vi.fn();
    renderSettings({ onClose: vi.fn(), onSaved });

    await screen.findByRole('radio', { name: /演示模式/ });
    await userEvent.click(screen.getByRole('radio', { name: /使用自己的 API/ }));
    await userEvent.type(screen.getByRole('textbox', { name: 'API 地址' }), 'https://api.example.com/v1');
    await userEvent.type(screen.getByRole('textbox', { name: '模型名称' }), 'demo-model');
    await userEvent.type(screen.getByLabelText('API Key'), 'k-secret');
    await userEvent.click(screen.getByRole('button', { name: '保存设置' }));

    await waitFor(() => expect(save).toHaveBeenCalledWith({
      mode: 'compatible', baseUrl: 'https://api.example.com/v1', model: 'demo-model', apiKey: 'k-secret'
    }));
    expect(await screen.findByText(/设置已保存并立即生效/)).toBeVisible();
    expect(onSaved).toHaveBeenCalled();
  });

  it('tests the current unsaved values and reports success', async () => {
    mockDemoSettings();
    const test = vi.spyOn(api, 'testAiSettings').mockResolvedValue({ ok: true, model: 'demo-model', latencyMs: 42 });
    renderSettings({ onClose: vi.fn() });

    await screen.findByRole('radio', { name: /演示模式/ });
    await userEvent.click(screen.getByRole('radio', { name: /使用自己的 API/ }));
    await userEvent.type(screen.getByRole('textbox', { name: 'API 地址' }), 'https://api.example.com/v1');
    await userEvent.type(screen.getByRole('textbox', { name: '模型名称' }), 'demo-model');
    await userEvent.type(screen.getByLabelText('API Key'), 'k-secret');
    await userEvent.click(screen.getByRole('button', { name: '测试连接' }));

    await waitFor(() => expect(test).toHaveBeenCalledWith({
      baseUrl: 'https://api.example.com/v1', model: 'demo-model', apiKey: 'k-secret'
    }));
    expect(await screen.findByText(/连接成功/)).toBeVisible();
  });

  it('translates a stable error code on save failure and keeps the form', async () => {
    mockDemoSettings();
    vi.spyOn(api, 'saveAiSettings').mockRejectedValue(new ApiError(401, 'AI_AUTH_FAILED', 'boom'));
    renderSettings({ onClose: vi.fn() });

    await screen.findByRole('radio', { name: /演示模式/ });
    await userEvent.click(screen.getByRole('radio', { name: /使用自己的 API/ }));
    await userEvent.type(screen.getByRole('textbox', { name: 'API 地址' }), 'https://api.example.com/v1');
    await userEvent.type(screen.getByRole('textbox', { name: '模型名称' }), 'demo-model');
    await userEvent.type(screen.getByLabelText('API Key'), 'bad-key');
    await userEvent.click(screen.getByRole('button', { name: '保存设置' }));

    expect(await screen.findByText(/API 密钥无效或已过期/)).toBeVisible();
    // Form content is retained.
    expect(screen.getByRole('textbox', { name: '模型名称' })).toHaveValue('demo-model');
  });

  it('summarizes the saved compatible config without revealing the key', async () => {
    vi.spyOn(api, 'readAiSettings').mockResolvedValue({
      mode: 'compatible', baseUrl: 'https://api.example.com/v1/', model: 'demo-model', hasApiKey: true
    });
    renderSettings({ onClose: vi.fn() });

    const summary = await screen.findByRole('region', { name: '当前生效配置' });
    expect(summary).toHaveTextContent('使用自己的 API');
    expect(summary).toHaveTextContent('https://api.example.com/v1/');
    expect(summary).toHaveTextContent('demo-model');
    expect(summary).toHaveTextContent('已保存密钥');
    expect(summary).not.toHaveTextContent('apiKey');
  });

  it('summarizes demo mode as the active config', async () => {
    mockDemoSettings();
    renderSettings({ onClose: vi.fn() });
    const summary = await screen.findByRole('region', { name: '当前生效配置' });
    expect(summary).toHaveTextContent('演示模式');
  });

  it('keeps the summary on the saved state while the form is edited', async () => {
    vi.spyOn(api, 'readAiSettings').mockResolvedValue({
      mode: 'compatible', baseUrl: 'https://api.example.com/v1/', model: 'saved-model', hasApiKey: true
    });
    renderSettings({ onClose: vi.fn() });

    const summary = await screen.findByRole('region', { name: '当前生效配置' });
    await userEvent.clear(screen.getByRole('textbox', { name: '模型名称' }));
    await userEvent.type(screen.getByRole('textbox', { name: '模型名称' }), 'draft-model');
    // Summary still reflects the persisted config, not the in-progress edit.
    expect(summary).toHaveTextContent('saved-model');
    expect(summary).not.toHaveTextContent('draft-model');
  });

  it('switches the whole settings dialog to English and persists the device preference', async () => {
    mockDemoSettings();
    renderSettings({ onClose: vi.fn() });

    await userEvent.click(await screen.findByRole('radio', { name: 'English' }));

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'AI settings' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save settings' })).toBeVisible();
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en-US');
  });

  it('does not save the language through workspace UI state', async () => {
    mockDemoSettings();
    const saveUiState = vi.spyOn(api, 'saveUiState');
    renderSettings({ onClose: vi.fn() });

    await userEvent.click(await screen.findByRole('radio', { name: 'English' }));

    expect(saveUiState).not.toHaveBeenCalled();
  });

  it('switches the whole settings dialog to English and persists the device preference', async () => {
    mockDemoSettings();
    renderSettings({ onClose: vi.fn() });

    await userEvent.click(await screen.findByRole('radio', { name: 'English' }));

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'AI settings' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save settings' })).toBeVisible();
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en-US');
  });

  it('does not save the language through workspace UI state', async () => {
    mockDemoSettings();
    const saveUiState = vi.spyOn(api, 'saveUiState');
    renderSettings({ onClose: vi.fn() });

    await userEvent.click(await screen.findByRole('radio', { name: 'English' }));

    expect(saveUiState).not.toHaveBeenCalled();
  });

  it('closes on Escape', async () => {
    mockDemoSettings();
    const onClose = vi.fn();
    renderSettings({ onClose });
    await screen.findByRole('radio', { name: /演示模式/ });
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});
