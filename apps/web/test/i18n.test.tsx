import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { I18nProvider, useI18n } from '../src/i18n/I18nProvider.js';
import { LOCALE_STORAGE_KEY, readStoredLocale, translate } from '../src/i18n/messages.js';

function LocaleProbe() {
  const { locale, setLocale, t } = useI18n();
  return (
    <div>
      <span>{locale}</span>
      <span>{t('search.summary', { documents: 2, matches: 5 })}</span>
      <button type="button" onClick={() => setLocale('en-US')}>English</button>
    </div>
  );
}

afterEach(() => {
  window.localStorage.clear();
  document.documentElement.lang = 'zh-CN';
});

describe('i18n', () => {
  it('defaults missing or invalid stored values to Chinese', () => {
    expect(readStoredLocale()).toBe('zh-CN');
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'fr-FR');
    expect(readStoredLocale()).toBe('zh-CN');
  });

  it('formats parameterized messages in each language', () => {
    expect(translate('zh-CN', 'search.summary', { documents: 2, matches: 5 })).toBe('2 个文档 · 5 处匹配');
    expect(translate('en-US', 'search.summary', { documents: 2, matches: 5 })).toBe('2 documents · 5 matches');
  });

  it('switches language, persists it, and updates the document language', async () => {
    const user = userEvent.setup();
    render(<I18nProvider><LocaleProbe /></I18nProvider>);

    expect(screen.getByText('zh-CN')).toBeVisible();
    expect(screen.getByText('2 个文档 · 5 处匹配')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'English' }));

    expect(screen.getByText('en-US')).toBeVisible();
    expect(screen.getByText('2 documents · 5 matches')).toBeVisible();
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en-US');
    await waitFor(() => expect(document.documentElement.lang).toBe('en-US'));
  });

  it('hydrates English synchronously from device storage', async () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en-US');
    render(<I18nProvider><LocaleProbe /></I18nProvider>);

    expect(screen.getByText('en-US')).toBeVisible();
    expect(screen.getByText('2 documents · 5 matches')).toBeVisible();
    await waitFor(() => expect(document.documentElement.lang).toBe('en-US'));
  });
});
