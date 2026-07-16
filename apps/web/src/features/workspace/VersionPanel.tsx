import { useEffect, useState } from 'react';
import type { Version } from '@pnode/core';
import { api } from '../../api/client.js';

interface VersionPanelProps {
  documentPath: string | undefined;
  onClose(): void;
  onRestored(): void;
}

// Human labels for the snapshot reasons the backend records. The product plan
// (§7) insists on natural language over version-control jargon, so no "commit".
const REASON_LABEL: Record<Version['reason'], string> = {
  manual: '手动保存',
  autosave: '自动保存',
  'pre-suggestion': '应用建议前',
  'suggestion-applied': '已应用建议',
  'pre-restore': '恢复前备份'
};

function formatTime(iso: string): string {
  const date = new Date(iso);
  return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function VersionPanel({ documentPath, onClose, onRestored }: VersionPanelProps) {
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
        if (!cancelled) setError(caught instanceof Error ? caught.message : '无法读取版本历史');
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
      setError(caught instanceof Error ? caught.message : '无法读取该版本内容');
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
      setError(caught instanceof Error ? caught.message : '恢复失败，请稍后重试');
    } finally {
      setRestoringId(undefined);
    }
  }

  return (
    <aside className="file-panel version-panel" aria-label="版本历史">
      <header className="panel-header file-panel-header">
        <div>
          <span className="eyebrow">工作区</span>
          <h2>版本历史</h2>
        </div>
        <button type="button" className="icon-button" aria-label="关闭版本历史" onClick={onClose}>×</button>
      </header>
      {!documentPath ? (
        <p className="panel-message">先打开一个文档，即可查看它的版本历史。</p>
      ) : loading ? (
        <p className="panel-message" role="status">正在读取版本历史…</p>
      ) : error ? (
        <p className="panel-message" role="alert">{error}</p>
      ) : versions.length === 0 ? (
        <div className="panel-message">
          <strong>还没有历史版本</strong>
          <p>编辑并保存文档后，这里会自动记录可恢复的版本。</p>
        </div>
      ) : (
        <div className="version-list" aria-label="版本列表">
          {versions.map((version, index) => (
            <div className="version-item" key={version.id}>
              <div className="version-meta">
                <span className="version-reason">{REASON_LABEL[version.reason]}</span>
                <span className="version-time">{formatTime(version.createdAt)}</span>
                {index === 0 && <span className="version-latest">最新</span>}
              </div>
              <div className="version-actions">
                <button type="button" className="button button--ghost" onClick={() => void togglePreview(version.id)}>
                  {preview?.id === version.id ? '收起' : '查看'}
                </button>
                <button
                  type="button"
                  className="button button--subtle"
                  disabled={restoringId === version.id}
                  onClick={() => void restore(version.id)}
                >
                  {restoringId === version.id ? '恢复中…' : '恢复此版本'}
                </button>
              </div>
              {preview?.id === version.id && (
                <pre className="version-preview" aria-label="版本内容预览">{preview.content}</pre>
              )}
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
