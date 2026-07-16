import { useMemo, useState } from 'react';
import type { DocumentEntry } from '../../api/client.js';
import { NewDocumentDialog } from './NewDocumentDialog.js';

interface FilePanelProps {
  entries: DocumentEntry[];
  loading: boolean;
  activeDocument: string | undefined;
  onOpenDocument(path: string): void;
  onCreateDocument(path: string): Promise<void> | void;
  onClose(): void;
}

function depthOf(path: string): number {
  return path.split('/').length - 1;
}

export function FilePanel({
  entries,
  loading,
  activeDocument,
  onOpenDocument,
  onCreateDocument,
  onClose
}: FilePanelProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  const visibleEntries = useMemo(() => entries.filter((entry) => {
    const segments = entry.path.split('/');
    segments.pop();
    let current = '';
    return segments.every((segment) => {
      current = current ? `${current}/${segment}` : segment;
      return !collapsed.has(current);
    });
  }), [collapsed, entries]);

  function toggleFolder(path: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  return (
    <aside className="file-panel" aria-label="文件面板">
      <header className="panel-header file-panel-header">
        <div>
          <span className="eyebrow">工作区</span>
          <h2>文件</h2>
        </div>
        <button type="button" className="icon-button" aria-label="关闭文件" onClick={onClose}>×</button>
      </header>
      <div className="file-panel-actions">
        <button type="button" className="button button--subtle" onClick={() => setDialogOpen(true)}>新建文档</button>
      </div>
      {loading ? (
        <p className="panel-message" role="status">正在读取工作区…</p>
      ) : visibleEntries.length === 0 ? (
        <div className="panel-message">
          <strong>没有 Markdown 文档</strong>
          <p>新建一个文档开始研究写作。</p>
        </div>
      ) : (
        <div className="file-tree" role="tree" aria-label="工作区文件">
          {visibleEntries.map((entry) => {
            const depth = depthOf(entry.path);
            const isFolder = entry.type === 'folder';
            return (
              <button
                type="button"
                role="treeitem"
                aria-label={entry.name}
                aria-expanded={isFolder ? !collapsed.has(entry.path) : undefined}
                aria-selected={!isFolder ? activeDocument === entry.path : undefined}
                className="file-tree-item"
                data-kind={entry.type}
                data-active={!isFolder && activeDocument === entry.path}
                style={{ paddingInlineStart: `${12 + depth * 16}px` }}
                key={`${entry.type}:${entry.path}`}
                onClick={() => isFolder ? toggleFolder(entry.path) : onOpenDocument(entry.path)}
              >
                <span className="file-tree-chevron" aria-hidden="true">
                  {isFolder ? (collapsed.has(entry.path) ? '›' : '⌄') : '·'}
                </span>
                <span className="file-tree-name">{entry.name}</span>
              </button>
            );
          })}
        </div>
      )}
      {dialogOpen && (
        <NewDocumentDialog
          onCancel={() => setDialogOpen(false)}
          onCreate={async (path) => {
            await onCreateDocument(path);
            setDialogOpen(false);
          }}
        />
      )}
    </aside>
  );
}
