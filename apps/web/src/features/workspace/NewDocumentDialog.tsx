import { useState, type FormEvent } from 'react';

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
  const [path, setPath] = useState('');
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!isValidDocumentPath(path)) {
      setError('请输入工作区内的 .md 相对路径');
      return;
    }
    setSubmitting(true);
    setError(undefined);
    try {
      await onCreate(path.trim().replaceAll('\\', '/'));
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : '创建文档失败');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="new-document-dialog" role="dialog" aria-modal="true" aria-labelledby="new-document-title">
        <h2 id="new-document-title">新建 Markdown 文档</h2>
        <p>路径相对于当前工作区，可以包含文件夹。</p>
        <form onSubmit={submit}>
          <label htmlFor="document-path">文档路径</label>
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
            <button type="button" className="button button--ghost" onClick={onCancel}>取消</button>
            <button type="submit" className="button button--primary" disabled={submitting}>
              {submitting ? '正在创建' : '创建'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export { isValidDocumentPath };
