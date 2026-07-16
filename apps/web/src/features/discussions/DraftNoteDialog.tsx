import { useState, type FormEvent } from 'react';

interface DraftNoteDialogProps {
  quote: string;
  onSave(content: string): Promise<void> | void;
  onCancel(): void;
}

export function DraftNoteDialog({ quote, onSave, onCancel }: DraftNoteDialogProps) {
  const [content, setContent] = useState('');
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!content.trim()) {
      setError('请输入批注内容');
      return;
    }
    setSaving(true);
    try {
      await onSave(content.trim());
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : '保存批注失败');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="draft-note-dialog" role="dialog" aria-modal="true" aria-labelledby="draft-note-title">
        <span className="eyebrow">不会调用 AI</span>
        <h2 id="draft-note-title">添加批注</h2>
        <blockquote>“{quote}”</blockquote>
        <form onSubmit={submit}>
          <label htmlFor="draft-note-content">批注内容</label>
          <textarea
            id="draft-note-content"
            aria-label="批注内容"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            autoFocus
          />
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="dialog-actions">
            <button type="button" className="button button--ghost" onClick={onCancel}>取消</button>
            <button type="submit" className="button button--primary" disabled={saving}>
              {saving ? '正在保存' : '保存批注'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
