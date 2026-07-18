import { useState, type FormEvent } from 'react';
import { useI18n } from '../../i18n/I18nProvider.js';

interface NewDocumentDialogProps {
  onCancel(): void;
  onCreate(path: string): Promise<void> | void;
}

function isValidDocumentPath(path: string): boolean {
  const normalized = path.trim().replaceAll('\\', '/');
  return normalized.length > 3
    && normalized.toLowerCase().endsWith('.md')
    && !normalized.startsWith('/')
    && !/^[a-zA-Z]:\//.test(normalized)
    && !normalized.split('/').includes('..');
}

export function NewDocumentDialog({ onCancel, onCreate }: NewDocumentDialogProps) {
  const { t } = useI18n();
  const [path, setPath] = useState('');
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!isValidDocumentPath(path)) {
      setError(t('newDocument.invalidPath'));
      return;
    }
    setSubmitting(true);
    setError(undefined);
    try {
      await onCreate(path.trim().replaceAll('\\', '/'));
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : t('newDocument.failed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="new-document-dialog" role="dialog" aria-modal="true" aria-labelledby="new-document-title">
        <h2 id="new-document-title">{t('newDocument.title')}</h2>
        <p>{t('newDocument.description')}</p>
        <form onSubmit={submit}>
          <label htmlFor="document-path">{t('newDocument.path')}</label>
          <input
            id="document-path"
            name="document-path"
            value={path}
            onChange={(event) => setPath(event.target.value)}
            placeholder="Notes/research-question.md"
            autoFocus
          />
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="dialog-actions">
            <button type="button" className="button button--ghost" onClick={onCancel}>{t('common.cancel')}</button>
            <button type="submit" className="button button--primary" disabled={submitting}>
              {submitting ? t('common.creating') : t('common.create')}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export { isValidDocumentPath };
