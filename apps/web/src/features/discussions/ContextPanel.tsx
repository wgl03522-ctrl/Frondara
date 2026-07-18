import { useMemo } from 'react';
import { buildBranchTree, type BranchNode, type Discussion } from '@pnode/core';
import type { ContextSpec, DocumentEntry } from '../../api/client.js';
import { CloseIcon } from '../../components/icons.js';
import { useI18n } from '../../i18n/I18nProvider.js';

interface ContextPanelProps {
  spec: ContextSpec;
  onChange(next: ContextSpec): void;
  discussions: Discussion[];
  currentDiscussionId: string;
  entries: DocumentEntry[];
  currentDocumentPath: string | undefined;
  onClose(): void;
}

interface FlatNode {
  id: string;
  title: string;
  depth: number;
}

function flatten(roots: BranchNode[]): FlatNode[] {
  const rows: FlatNode[] = [];
  const walk = (node: BranchNode, depth: number) => {
    rows.push({ id: node.id, title: node.title, depth });
    for (const child of node.children) walk(child, depth + 1);
  };
  for (const root of roots) walk(root, 0);
  return rows;
}

export function ContextPanel({
  spec,
  onChange,
  discussions,
  currentDiscussionId,
  entries,
  currentDocumentPath,
  onClose
}: ContextPanelProps) {
  const { t } = useI18n();
  const treeRows = useMemo(() => {
    const roots = buildBranchTree(discussions.map((item) => ({
      id: item.id,
      title: item.title,
      updatedAt: item.updatedAt,
      ...(item.parentDiscussionId ? { parentDiscussionId: item.parentDiscussionId } : {})
    })));
    return flatten(roots).filter((row) => row.id !== currentDiscussionId);
  }, [discussions, currentDiscussionId]);

  const files = useMemo(
    () => entries.filter((entry) => entry.type === 'file' && entry.path !== currentDocumentPath),
    [entries, currentDocumentPath]
  );
  const discussionIds = new Set(spec.discussionIds);
  const filePaths = new Set(spec.filePaths);

  function toggleDiscussion(id: string) {
    const next = new Set(discussionIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange({ ...spec, discussionIds: [...next] });
  }

  function toggleFile(path: string) {
    const next = new Set(filePaths);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    onChange({ ...spec, filePaths: [...next] });
  }

  return (
    <aside className="file-panel context-panel" aria-label={t('context.settings')}>
      <header className="panel-header file-panel-header">
        <div>
          <span className="eyebrow">{t('common.discussion')}</span>
          <h2>{t('discussion.context')}</h2>
        </div>
        <button type="button" className="icon-button" aria-label={t('context.close')} onClick={onClose}>
          <CloseIcon />
        </button>
      </header>
      <div className="context-panel-body">
        <section className="context-section" aria-label={t('context.defaults')}>
          <p className="context-section-title">{t('context.defaults')}</p>
          <label className="context-check">
            <input type="checkbox" checked={spec.includeDocument} onChange={() => onChange({ ...spec, includeDocument: !spec.includeDocument })} />
            <span>{t('context.document')}</span>
          </label>
          <label className="context-check">
            <input type="checkbox" checked={spec.includeParagraph} onChange={() => onChange({ ...spec, includeParagraph: !spec.includeParagraph })} />
            <span>{t('context.paragraph')}</span>
          </label>
          <label className="context-check">
            <input type="checkbox" checked={spec.includeHistory} onChange={() => onChange({ ...spec, includeHistory: !spec.includeHistory })} />
            <span>{t('context.history')}</span>
          </label>
        </section>
        <section className="context-section" aria-label={t('context.otherDiscussions')}>
          <p className="context-section-title">{t('context.otherDiscussions')}</p>
          {treeRows.length === 0 ? (
            <p className="context-empty">{t('context.noDiscussions')}</p>
          ) : (
            <div className="context-tree">
              {treeRows.map((row) => (
                <label key={row.id} className="context-check context-tree-row" style={{ paddingLeft: `${row.depth * 16}px` }}>
                  <input type="checkbox" checked={discussionIds.has(row.id)} onChange={() => toggleDiscussion(row.id)} />
                  <span>{row.title}</span>
                </label>
              ))}
            </div>
          )}
        </section>
        <section className="context-section" aria-label={t('context.workspaceFiles')}>
          <p className="context-section-title">{t('context.workspaceFiles')}</p>
          {files.length === 0 ? (
            <p className="context-empty">{t('context.noFiles')}</p>
          ) : (
            <div className="context-files">
              {files.map((file) => (
                <label key={file.path} className="context-check">
                  <input type="checkbox" checked={filePaths.has(file.path)} onChange={() => toggleFile(file.path)} />
                  <span title={file.path}>{file.name}</span>
                </label>
              ))}
            </div>
          )}
        </section>
      </div>
    </aside>
  );
}
