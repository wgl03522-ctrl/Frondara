import { useEffect, useState } from 'react';
import type { PublicAiSettings } from '@pnode/core';
import {
  api,
  type AiConnectionTestPayload,
  type AiSettingsUpdatePayload
} from '../../api/client.js';
import { aiErrorMessage } from './ai-error-message.js';

interface AiSettingsDialogProps {
  onClose(): void;
  onSaved?(settings: PublicAiSettings): void;
}

type Mode = 'demo' | 'compatible';

export function AiSettingsDialog({ onClose, onSaved }: AiSettingsDialogProps) {
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>('demo');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [hasStoredKey, setHasStoredKey] = useState(false);
  // Snapshot of the persisted config; the read-only summary reflects this, not
  // the in-progress form edits, so it always shows what pnode currently uses.
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
        setError(aiErrorMessage(caught, '读取 AI 设置失败'));
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
      setSavedMessage('设置已保存并立即生效。');
      onSaved?.(result);
    } catch (caught: unknown) {
      setError(aiErrorMessage(caught, '保存设置失败'));
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
      setTestMessage(`连接成功（${result.model}，${result.latencyMs}ms）。`);
    } catch (caught: unknown) {
      setError(aiErrorMessage(caught, '连接测试失败'));
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
      setSavedMessage('已删除保存的 API 密钥。');
      onSaved?.(result);
    } catch (caught: unknown) {
      setError(aiErrorMessage(caught, '删除密钥失败'));
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
      setError(aiErrorMessage(caught, '恢复设置失败'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="ai-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="ai-settings-title">
        <header className="panel-header">
          <div>
            <span className="eyebrow">AI 服务</span>
            <h2 id="ai-settings-title">AI 设置</h2>
          </div>
          <button type="button" className="icon-button" aria-label="关闭设置" onClick={onClose}>×</button>
        </header>

        {saved && (
          <section className="ai-current-config" aria-label="当前生效配置">
            <span className="eyebrow">当前生效配置</span>
            {saved.mode === 'demo' ? (
              <p className="ai-config-line">演示模式（本地示例回复）</p>
            ) : (
              <dl className="ai-config-details">
                <div><dt>模式</dt><dd>使用自己的 API</dd></div>
                <div><dt>API 地址</dt><dd>{saved.baseUrl || '（未填写）'}</dd></div>
                <div><dt>模型</dt><dd>{saved.model || '（未填写）'}</dd></div>
                <div><dt>密钥</dt><dd>{saved.hasApiKey ? '已保存密钥' : '未保存密钥'}</dd></div>
              </dl>
            )}
          </section>
        )}

        {loading ? (
          <p role="status">正在读取设置…</p>
        ) : (
          <form onSubmit={(event) => { event.preventDefault(); void save(); }}>
            <fieldset className="ai-mode-group">
              <legend>模式</legend>
              <label>
                <input
                  type="radio"
                  name="ai-mode"
                  checked={mode === 'demo'}
                  onChange={() => changeMode('demo')}
                />
                演示模式（无需账号或网络，返回确定性示例回复）
              </label>
              <label>
                <input
                  type="radio"
                  name="ai-mode"
                  checked={mode === 'compatible'}
                  onChange={() => changeMode('compatible')}
                />
                使用自己的 API（OpenAI 兼容）
              </label>
            </fieldset>

            {mode === 'compatible' && (
              <div className="ai-compatible-fields">
                <p className="ai-hint">请从你所使用的 AI 服务商控制台复制 API 地址、模型名称和密钥。Frondara 不提供默认或共享的云服务。</p>

                <label htmlFor="ai-base-url">API 地址</label>
                <input
                  id="ai-base-url"
                  aria-label="API 地址"
                  value={baseUrl}
                  onChange={(event) => { setBaseUrl(event.target.value); markDirty(); }}
                  placeholder="https://api.example.com/v1/"
                  autoComplete="off"
                />

                <label htmlFor="ai-model">模型名称</label>
                <input
                  id="ai-model"
                  aria-label="模型名称"
                  value={model}
                  onChange={(event) => { setModel(event.target.value); markDirty(); }}
                  placeholder="填写你的服务商提供的模型名"
                  autoComplete="off"
                />

                <label htmlFor="ai-api-key">API Key</label>
                <input
                  id="ai-api-key"
                  aria-label="API Key"
                  type="password"
                  value={apiKey}
                  onChange={(event) => { setApiKey(event.target.value); markDirty(); }}
                  placeholder={hasStoredKey ? '已保存，留空将继续使用' : '粘贴你的 API 密钥'}
                  autoComplete="off"
                />
                {hasStoredKey && <p className="ai-hint">已保存 API 密钥；留空将继续使用，或在下方清除。</p>}
              </div>
            )}

            {error && <p className="form-error" role="alert">{error}</p>}
            {testMessage && <p className="ai-status" role="status">{testMessage}</p>}
            {savedMessage && <p className="ai-status" role="status">{savedMessage}</p>}

            <div className="dialog-actions">
              {mode === 'compatible' && (
                <button type="button" className="button button--ghost" disabled={busy} onClick={() => void test()}>
                  测试连接
                </button>
              )}
              {hasStoredKey && (
                <button type="button" className="button button--ghost" disabled={busy} onClick={() => void clearStoredKey()}>
                  清除已存密钥
                </button>
              )}
              <button type="button" className="button button--ghost" disabled={busy} onClick={() => void restore()}>
                恢复已保存设置
              </button>
              <button type="button" className="button button--ghost" disabled={busy} onClick={onClose}>取消</button>
              <button type="submit" className="button button--primary" disabled={busy}>
                {busy ? '处理中' : '保存设置'}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
