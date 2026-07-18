import { useEffect, useState } from 'react';
import type { PublicAiSettings } from '@pnode/core';
import {
  api,
  type AiConnectionTestPayload,
  type AiSettingsUpdatePayload
} from '../../api/client.js';
import { useI18n } from '../../i18n/I18nProvider.js';
import { aiErrorMessage } from './ai-error-message.js';

interface SettingsDialogProps {
  onClose(): void;
  onSaved?(settings: PublicAiSettings): void;
}

type Mode = 'demo' | 'compatible';

export function SettingsDialog({ onClose, onSaved }: SettingsDialogProps) {
  const { locale, setLocale, t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>('demo');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const [saved, setSaved] = useState<PublicAiSettings>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [testMessage, setTestMessage] = useState<string>();
  const [savedMessage, setSavedMessage] = useState<string>();

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    void api.readAiSettings()
      .then((settings) => {
        if (cancelled) return;
        setSaved(settings);
        setMode(settings.mode);
        setBaseUrl(settings.baseUrl);
        setModel(settings.model);
        setHasStoredKey(settings.hasApiKey);
        setLoading(false);
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setError(aiErrorMessage(caught, locale, t('settings.readFailed')));
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  function markDirty() {
    setTestMessage(undefined);
    setSavedMessage(undefined);
    setError(undefined);
  }

  function changeMode(next: Mode) {
    setMode(next);
    markDirty();
  }

  async function save() {
    setBusy(true);
    setError(undefined);
    setSavedMessage(undefined);
    setTestMessage(undefined);
    try {
      const payload: AiSettingsUpdatePayload = { mode, baseUrl: baseUrl.trim(), model: model.trim() };
      if (apiKey) payload.apiKey = apiKey;
      const result = await api.saveAiSettings(payload);
      setSaved(result);
      setMode(result.mode);
      setBaseUrl(result.baseUrl);
      setModel(result.model);
      setHasStoredKey(result.hasApiKey);
      setApiKey('');
      setSavedMessage(t('settings.saved'));
      onSaved?.(result);
    } catch (caught: unknown) {
      setError(aiErrorMessage(caught, locale, t('settings.saveFailed')));
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setError(undefined);
    setTestMessage(undefined);
    try {
      const payload: AiConnectionTestPayload = { baseUrl: baseUrl.trim(), model: model.trim() };
      if (apiKey) payload.apiKey = apiKey;
      const result = await api.testAiSettings(payload);
      setTestMessage(t('settings.connectionSuccess', { model: result.model, latency: result.latencyMs }));
    } catch (caught: unknown) {
      setError(aiErrorMessage(caught, locale, t('settings.connectionFailed')));
    } finally {
      setBusy(false);
    }
  }

  async function clearStoredKey() {
    setBusy(true);
    setError(undefined);
    setSavedMessage(undefined);
    try {
      const result = await api.saveAiSettings({ mode, baseUrl: baseUrl.trim(), model: model.trim(), clearApiKey: true });
      setSaved(result);
      setHasStoredKey(result.hasApiKey);
      setApiKey('');
      setSavedMessage(t('settings.keyDeleted'));
      onSaved?.(result);
    } catch (caught: unknown) {
      setError(aiErrorMessage(caught, locale, t('settings.keyDeleteFailed')));
    } finally {
      setBusy(false);
    }
  }

  async function restore() {
    markDirty();
    setLoading(true);
    try {
      const settings = await api.readAiSettings();
      setSaved(settings);
      setMode(settings.mode);
      setBaseUrl(settings.baseUrl);
      setModel(settings.model);
      setHasStoredKey(settings.hasApiKey);
      setApiKey('');
    } catch (caught: unknown) {
      setError(aiErrorMessage(caught, locale, t('settings.restoreFailed')));
    } finally {
      setLoading(false);
    }
  }

  function chooseLocale(next: typeof locale) {
    markDirty();
    setLocale(next);
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="ai-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header className="panel-header">
          <div>
            <span className="eyebrow">Frondara</span>
            <h2 id="settings-title">{t('settings.title')}</h2>
          </div>
          <button type="button" className="icon-button" aria-label={t('settings.close')} onClick={onClose}>×</button>
        </header>

        <section className="settings-section" aria-labelledby="language-settings-title">
          <span className="eyebrow">{t('settings.application')}</span>
          <fieldset className="language-options">
            <legend id="language-settings-title">{t('common.language')}</legend>
            <label>
              <input type="radio" name="locale" checked={locale === 'zh-CN'} onChange={() => chooseLocale('zh-CN')} />
              {t('common.chinese')}
            </label>
            <label>
              <input type="radio" name="locale" checked={locale === 'en-US'} onChange={() => chooseLocale('en-US')} />
              {t('common.english')}
            </label>
          </fieldset>
          <p className="ai-hint">{t('settings.languageHint')}</p>
        </section>

        <section className="settings-section" aria-labelledby="ai-settings-title">
          <div className="settings-section-heading">
            <span className="eyebrow">{t('settings.aiService')}</span>
            <h3 id="ai-settings-title">{t('settings.aiTitle')}</h3>
          </div>

          {saved && (
            <section className="ai-current-config" aria-label={t('settings.currentConfig')}>
              <span className="eyebrow">{t('settings.currentConfig')}</span>
              {saved.mode === 'demo' ? (
                <p className="ai-config-line">{t('settings.demoSummary')}</p>
              ) : (
                <dl className="ai-config-details">
                  <div><dt>{t('settings.mode')}</dt><dd>{t('settings.ownApi')}</dd></div>
                  <div><dt>{t('settings.apiAddress')}</dt><dd>{saved.baseUrl || t('settings.notFilled')}</dd></div>
                  <div><dt>{t('settings.model')}</dt><dd>{saved.model || t('settings.notFilled')}</dd></div>
                  <div><dt>{t('settings.key')}</dt><dd>{saved.hasApiKey ? t('settings.keyStored') : t('settings.keyNotStored')}</dd></div>
                </dl>
              )}
            </section>
          )}

          {loading ? (
            <p role="status">{t('settings.loading')}</p>
          ) : (
            <form onSubmit={(event) => { event.preventDefault(); void save(); }}>
              <fieldset className="ai-mode-group">
                <legend>{t('settings.mode')}</legend>
                <label>
                  <input type="radio" name="ai-mode" checked={mode === 'demo'} onChange={() => changeMode('demo')} />
                  {t('settings.demoMode')}
                </label>
                <label>
                  <input type="radio" name="ai-mode" checked={mode === 'compatible'} onChange={() => changeMode('compatible')} />
                  {t('settings.compatibleMode')}
                </label>
              </fieldset>

              {mode === 'compatible' && (
                <div className="ai-compatible-fields">
                  <p className="ai-hint">{t('settings.providerHint')}</p>
                  <label htmlFor="ai-base-url">{t('settings.apiAddress')}</label>
                  <input
                    id="ai-base-url"
                    aria-label={t('settings.apiAddress')}
                    value={baseUrl}
                    onChange={(event) => { setBaseUrl(event.target.value); markDirty(); }}
                    placeholder="https://api.example.com/v1/"
                    autoComplete="off"
                  />
                  <label htmlFor="ai-model">{t('settings.modelName')}</label>
                  <input
                    id="ai-model"
                    aria-label={t('settings.modelName')}
                    value={model}
                    onChange={(event) => { setModel(event.target.value); markDirty(); }}
                    placeholder={t('settings.modelPlaceholder')}
                    autoComplete="off"
                  />
                  <label htmlFor="ai-api-key">API Key</label>
                  <input
                    id="ai-api-key"
                    aria-label="API Key"
                    type="password"
                    value={apiKey}
                    onChange={(event) => { setApiKey(event.target.value); markDirty(); }}
                    placeholder={hasStoredKey ? t('settings.keyPlaceholderStored') : t('settings.keyPlaceholder')}
                    autoComplete="off"
                  />
                  {hasStoredKey && <p className="ai-hint">{t('settings.keyHint')}</p>}
                </div>
              )}

              {error && <p className="form-error" role="alert">{error}</p>}
              {testMessage && <p className="ai-status" role="status">{testMessage}</p>}
              {savedMessage && <p className="ai-status" role="status">{savedMessage}</p>}

              <div className="dialog-actions">
                {mode === 'compatible' && (
                  <button type="button" className="button button--ghost" disabled={busy} onClick={() => void test()}>
                    {t('settings.test')}
                  </button>
                )}
                {hasStoredKey && (
                  <button type="button" className="button button--ghost" disabled={busy} onClick={() => void clearStoredKey()}>
                    {t('settings.clearKey')}
                  </button>
                )}
                <button type="button" className="button button--ghost" disabled={busy} onClick={() => void restore()}>
                  {t('settings.restore')}
                </button>
                <button type="button" className="button button--ghost" disabled={busy} onClick={onClose}>{t('common.cancel')}</button>
                <button type="submit" className="button button--primary" disabled={busy}>
                  {busy ? t('common.processing') : t('settings.save')}
                </button>
              </div>
            </form>
          )}
        </section>
      </section>
    </div>
  );
}
