import { useState, type FormEvent } from 'react';
import { useI18n } from '../../i18n/I18nProvider.js';

interface DraftNoteDialogProps {
  quote: string;
  onSave(content: string): Promise<void> | void;
  onCancel(): void;
}

export function DraftNoteDialog({ quote, onSave, onCancel }: DraftNoteDialogProps) {
  const { t } = useI18n();
  const [content, setContent] = useState('');
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!content.trim()) {
      setError(t('draft.required'));
      return;
    }
    setSaving(true);
    try {
      await onSave(content.trim());
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : t('draft.failed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="draft-note-dialog" role="dialog" aria-modal="true" aria-labelledby="draft-note-title">
        <span className="eyebrow">{t('draft.noAi')}</span>
        <h2 id="draft-note-title">{t('draft.title')}</h2>
        <blockquote>“{quote}”</blockquote>
        <form onSubmit={submit}>
          <label htmlFor="draft-note-content">{t('draft.content')}</label>
          <textarea
            id="draft-note-content"
            aria-label={t('draft.content')}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            autoFocus
          />
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="dialog-actions">
            <button type="button" className="button button--ghost" onClick={onCancel}>{t('common.cancel')}</button>
            <button type="submit" className="button button--primary" disabled={saving}>
              {saving ? t('common.saving') : t('draft.save')}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
