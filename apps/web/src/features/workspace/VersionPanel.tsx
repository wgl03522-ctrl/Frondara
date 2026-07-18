import { useEffect, useState } from 'react';
import type { Version } from '@pnode/core';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/I18nProvider.js';
import type { MessageKey } from '../../i18n/messages.js';

interface VersionPanelProps {
  documentPath: string | undefined;
  onClose(): void;
  onRestored(): void;
}

const REASON_KEYS: Record<Version['reason'], MessageKey> = {
  manual: 'versions.reason.manual',
  autosave: 'versions.reason.autosave',
  'pre-suggestion': 'versions.reason.preSuggestion',
  'suggestion-applied': 'versions.reason.suggestionApplied',
  'pre-restore': 'versions.reason.preRestore'
};

export function VersionPanel({ documentPath, onClose, onRestored }: VersionPanelProps) {
  const { locale, t } = useI18n();
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [preview, setPreview] = useState<{ id: string; content: string }>();
  const [restoringId, setRestoringId] = useState<string>();

  useEffect(() => {
    if (!documentPath) {
      setVersions([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(undefined);
    api.listVersions(documentPath)
      .then((list) => { if (!cancelled) setVersions(list); })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : t('versions.readFailed'));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [documentPath]);

  async function togglePreview(id: string) {
    if (preview?.id === id) {
      setPreview(undefined);
      return;
    }
    try {
      const diff = await api.readVersionDiff(id);
      setPreview({ id, content: diff.previous });
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : t('versions.previewFailed'));
    }
  }

  async function restore(id: string) {
    if (!documentPath) return;
    setRestoringId(id);
    setError(undefined);
    try {
      await api.restoreVersion(id, documentPath);
      onRestored();
      const list = await api.listVersions(documentPath);
      setVersions(list);
      setPreview(undefined);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : t('versions.restoreFailed'));
    } finally {
      setRestoringId(undefined);
    }
  }

  return (
    <aside className="file-panel version-panel" aria-label={t('versions.title')}>
      <header className="panel-header file-panel-header">
        <div>
          <span className="eyebrow">{t('common.workspace')}</span>
          <h2>{t('versions.title')}</h2>
        </div>
        <button type="button" className="icon-button" aria-label={t('versions.close')} onClick={onClose}>×</button>
      </header>
      {!documentPath ? (
        <p className="panel-message">{t('versions.openDocument')}</p>
      ) : loading ? (
        <p className="panel-message" role="status">{t('versions.loading')}</p>
      ) : error ? (
        <p className="panel-message" role="alert">{error}</p>
      ) : versions.length === 0 ? (
        <div className="panel-message">
          <strong>{t('versions.emptyTitle')}</strong>
          <p>{t('versions.emptyBody')}</p>
        </div>
      ) : (
        <div className="version-list" aria-label={t('versions.list')}>
          {versions.map((version, index) => (
            <div className="version-item" key={version.id}>
              <div className="version-meta">
                <span className="version-reason">{t(REASON_KEYS[version.reason])}</span>
                <span className="version-time">
                  {new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(version.createdAt))}
                </span>
                {index === 0 && <span className="version-latest">{t('versions.latest')}</span>}
              </div>
              <div className="version-actions">
                <button type="button" className="button button--ghost" onClick={() => void togglePreview(version.id)}>
                  {preview?.id === version.id ? t('versions.collapse') : t('versions.view')}
                </button>
                <button
                  type="button"
                  className="button button--subtle"
                  disabled={restoringId === version.id}
                  onClick={() => void restore(version.id)}
                >
                  {restoringId === version.id ? t('versions.restoring') : t('versions.restore')}
                </button>
              </div>
              {preview?.id === version.id && (
                <pre className="version-preview" aria-label={t('versions.preview')}>{preview.content}</pre>
              )}
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
