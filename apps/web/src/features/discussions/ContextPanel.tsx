import { useMemo } from 'react';
import { buildBranchTree, type BranchNode, type Discussion } from '@pnode/core';
import type { ContextSpec, DocumentEntry } from '../../api/client.js';
import { CloseIcon } from '../../components/icons.js';

interface ContextPanelProps {
  spec: ContextSpec;
  onChange(next: ContextSpec): void;
  discussions: Discussion[];
  currentDiscussionId: string;
  entries: DocumentEntry[];
  currentDocumentPath: string | undefined;
  onClose(): void;
}

// Flatten the branch tree into depth-tagged rows so we can render a compact
// indented list (a lightweight cousin of BranchGraphOverlay — no SVG, just
// checkboxes). Order is pre-order DFS so parents sit above their children.
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
  // The tree shows every discussion the user could pull in as context. The
  // current discussion is excluded — its own history is a separate default.
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
    <aside className="file-panel context-panel" aria-label="上下文设置">
      <header className="panel-header file-panel-header">
        <div>
          <span className="eyebrow">讨论</span>
          <h2>上下文</h2>
        </div>
        <button type="button" className="icon-button" aria-label="关闭上下文设置" onClick={onClose}>
          <CloseIcon />
        </button>
      </header>

      <div className="context-panel-body">
        <section className="context-section" aria-label="默认上下文">
          <p className="context-section-title">默认上下文</p>
          <label className="context-check">
            <input
              type="checkbox"
              checked={spec.includeDocument}
              onChange={() => onChange({ ...spec, includeDocument: !spec.includeDocument })}
            />
            <span>整篇文档</span>
          </label>
          <label className="context-check">
            <input
              type="checkbox"
              checked={spec.includeParagraph}
              onChange={() => onChange({ ...spec, includeParagraph: !spec.includeParagraph })}
            />
            <span>选定段落</span>
          </label>
          <label className="context-check">
            <input
              type="checkbox"
              checked={spec.includeHistory}
              onChange={() => onChange({ ...spec, includeHistory: !spec.includeHistory })}
            />
            <span>本讨论历史</span>
          </label>
        </section>

        <section className="context-section" aria-label="其他讨论">
          <p className="context-section-title">其他讨论</p>
          {treeRows.length === 0 ? (
            <p className="context-empty">暂无其他讨论</p>
          ) : (
            <div className="context-tree">
              {treeRows.map((row) => (
                <label
                  key={row.id}
                  className="context-check context-tree-row"
                  style={{ paddingLeft: `${row.depth * 16}px` }}
                >
                  <input
                    type="checkbox"
                    checked={discussionIds.has(row.id)}
                    onChange={() => toggleDiscussion(row.id)}
                  />
                  <span>{row.title}</span>
                </label>
              ))}
            </div>
          )}
        </section>

        <section className="context-section" aria-label="工作区文件">
          <p className="context-section-title">工作区文件</p>
          {files.length === 0 ? (
            <p className="context-empty">没有其他文件</p>
          ) : (
            <div className="context-files">
              {files.map((file) => (
                <label key={file.path} className="context-check">
                  <input
                    type="checkbox"
                    checked={filePaths.has(file.path)}
                    onChange={() => toggleFile(file.path)}
                  />
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
