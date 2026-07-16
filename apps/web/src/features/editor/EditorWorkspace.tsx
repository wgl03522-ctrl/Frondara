import { EditorContent, useEditor } from '@tiptap/react';
import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import type { Discussion, TextAnchor } from '@pnode/core';
import { DraftNoteDialog } from '../discussions/DraftNoteDialog.js';
import { SelectionToolbar, type SelectionDraft } from './SelectionToolbar.js';
import { createEditorExtensions } from './markdown.js';
import { setDiscussionHighlights } from './discussion-highlight.js';
import { useDocument, type DocumentSaveState } from './useDocument.js';
import logoUrl from '../../assets/logo.png';

interface EditorWorkspaceProps {
  documentPath?: string | undefined;
  discussions?: Discussion[] | undefined;
  onSaveStateChange?(state: DocumentSaveState): void;
  onOpenDiscussion?(anchor: TextAnchor, question: string): void;
  onCreateDraft?(anchor: TextAnchor, content: string): Promise<void> | void;
  onOpenExistingDiscussion?(discussion: Discussion): void;
}

interface AnchoredSelection extends SelectionDraft {
  anchor: TextAnchor;
}

export function EditorWorkspace({
  documentPath,
  discussions = [],
  onSaveStateChange,
  onOpenDiscussion,
  onCreateDraft,
  onOpenExistingDiscussion
}: EditorWorkspaceProps) {
  const { document, currentVersionId, loading, error, saveState, save, reload } = useDocument(documentPath);
  const extensions = useMemo(() => createEditorExtensions(), []);
  const saveRef = useRef(save);
  const versionRef = useRef(currentVersionId);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const loadedVersionRef = useRef<string | undefined>(undefined);
  const [showMarkdown, setShowMarkdown] = useState(false);
  const [selection, setSelection] = useState<AnchoredSelection>();
  const [noteOpen, setNoteOpen] = useState(false);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  useEffect(() => {
    versionRef.current = currentVersionId;
  }, [currentVersionId]);

  const editor = useEditor({
    extensions,
    content: '',
    contentType: 'markdown',
    immediatelyRender: true,
    editorProps: {
      attributes: {
        class: 'pnode-editor',
        role: 'textbox',
        'aria-label': 'Markdown 编辑器',
        'aria-multiline': 'true'
      }
    },
    onSelectionUpdate: ({ editor: currentEditor }) => {
      const { from, to, empty } = currentEditor.state.selection;
      if (empty || !documentPath || !versionRef.current) {
        setSelection(undefined);
        return;
      }
      const quote = currentEditor.state.doc.textBetween(from, to, '\n').trim();
      if (!quote) {
        setSelection(undefined);
        return;
      }
      const fullText = currentEditor.state.doc.textBetween(0, currentEditor.state.doc.content.size, '\n');
      const before = currentEditor.state.doc.textBetween(0, from, '\n');
      const after = currentEditor.state.doc.textBetween(to, currentEditor.state.doc.content.size, '\n');
      const headingPath = headingsBefore(currentEditor.state.doc, from);
      let position: SelectionDraft['position'];
      try {
        const coordinates = currentEditor.view.coordsAtPos(to);
        position = {
          left: Math.min(coordinates.left, window.innerWidth - 330),
          top: Math.max(12, coordinates.top - 48)
        };
      } catch {
        position = { left: window.innerWidth / 2 - 150, top: 80 };
      }
      setSelection({
        quote,
        prefix: before.slice(-64),
        suffix: after.slice(0, 64),
        headingPath,
        position,
        anchor: {
          documentPath,
          quote,
          prefix: before.slice(-64),
          suffix: after.slice(0, 64),
          headingPath,
          documentVersionId: versionRef.current
        }
      });
      void fullText;
    },
    onUpdate: ({ editor: currentEditor }) => {
      setSelection(undefined);
      if (timerRef.current) clearTimeout(timerRef.current);
      const markdown = currentEditor.getMarkdown();
      timerRef.current = setTimeout(() => void saveRef.current(markdown), 750);
    }
  }, [documentPath]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  useEffect(() => {
    onSaveStateChange?.(saveState);
  }, [onSaveStateChange, saveState]);

  useEffect(() => {
    if (!editor || !document || loadedVersionRef.current === document.versionId) return;
    editor.commands.setContent(document.content, { contentType: 'markdown', emitUpdate: false });
    loadedVersionRef.current = document.versionId;
  }, [document, editor]);

  // Re-decorate whenever the discussion set or loaded document changes. Highlights
  // survive edits via the plugin's docChanged path; new/removed anchors and freshly
  // loaded content come through here.
  useEffect(() => {
    if (!editor) return;
    setDiscussionHighlights(editor, discussions);
  }, [discussions, editor, document]);

  // Clicks on a highlight are delegated here: the decoration carries a
  // `data-discussion-id`, so we walk up from the click target to find it and open
  // the matching discussion. (ProseMirror's own handleClick relies on layout that
  // jsdom lacks, so React delegation is both testable and more robust.)
  function onHighlightClick(event: ReactMouseEvent<HTMLDivElement>) {
    const target = (event.target as HTMLElement).closest('[data-discussion-id]');
    const id = target?.getAttribute('data-discussion-id');
    if (!id) return;
    const discussion = discussions.find((item) => item.id === id);
    if (discussion) onOpenExistingDiscussion?.(discussion);
  }

  if (!documentPath) {
    return (
      <section className="editor-empty-state">
        <img className="empty-document-mark" src={logoUrl} alt="" aria-hidden="true" />
        <span className="eyebrow">Ideas branch. Context holds.</span>
        <h1>选择或创建一个 Markdown 文档</h1>
        <p>文档保存在你的工作区中；讨论、建议和版本记录存放在同目录的 .pnode 元数据中。</p>
      </section>
    );
  }

  if (loading && !document) return <div className="editor-loading" role="status">正在打开文档…</div>;
  if (error && !document) return <div className="editor-error" role="alert">{error}</div>;

  return (
    <section className="editor-workspace" aria-label="文档编辑区">
      <div className="editor-toolbar" aria-label="编辑器工具栏">
        <div className="toolbar-group">
          <button type="button" aria-label="粗体" onClick={() => editor?.chain().focus().toggleBold().run()}>B</button>
          <button type="button" aria-label="斜体" onClick={() => editor?.chain().focus().toggleItalic().run()}><em>I</em></button>
          <button type="button" aria-label="代码" onClick={() => editor?.chain().focus().toggleCode().run()}>⌘</button>
        </div>
        <div className="toolbar-group toolbar-group--right">
          {discussions.length > 0 && <span className="discussion-count">{discussions.length} 条讨论</span>}
          <button type="button" onClick={() => setShowMarkdown((shown) => !shown)}>
            {showMarkdown ? '返回编辑' : '查看 Markdown'}
          </button>
        </div>
      </div>
      {saveState === 'conflict' && (
        <div className="conflict-banner" role="alert">
          <div>
            <strong>磁盘版本已变化</strong>
            <span>自动保存已暂停，当前编辑内容仍保留在页面中。</span>
          </div>
          <div className="conflict-actions">
            <button type="button" onClick={() => setShowMarkdown(true)}>比较当前内容</button>
            <button type="button" onClick={() => void reload()}>重新载入磁盘版本</button>
          </div>
        </div>
      )}
      <div className="paper-scroll">
        <article className="document-paper">
          <div className="document-meta">
            <span>{documentPath}</span>
            <span>{saveState === 'saving' ? '正在保存…' : saveState === 'saved' ? '已保存' : 'Markdown'}</span>
          </div>
          {discussions.length > 0 && (
            <div className="document-discussions" aria-label="文档讨论标记">
              {discussions.map((discussion) => (
                <button
                  type="button"
                  className="discussion-marker"
                  data-status={discussion.status}
                  key={discussion.id}
                  onClick={() => onOpenExistingDiscussion?.(discussion)}
                >
                  <span>{discussion.status === 'draft' ? '批注' : '讨论'}</span>
                  <strong>{discussion.anchor.quote}</strong>
                </button>
              ))}
            </div>
          )}
          {showMarkdown ? (
            <pre className="markdown-preview" aria-label="当前 Markdown">{editor?.getMarkdown() ?? document?.content ?? ''}</pre>
          ) : (
            // Delegate clicks on inline discussion highlights: the decoration
            // carries data-discussion-id, so a single handler on the wrapper
            // opens the matching discussion without fighting text selection.
            <div onClick={onHighlightClick}>
              <EditorContent editor={editor} />
            </div>
          )}
        </article>
      </div>
      {selection && !showMarkdown && (
        <SelectionToolbar
          selection={selection}
          onDiscuss={(question) => {
            onOpenDiscussion?.(selection.anchor, question);
            setSelection(undefined);
          }}
          onAnnotate={() => setNoteOpen(true)}
          onDismiss={() => setSelection(undefined)}
        />
      )}
      {selection && noteOpen && (
        <DraftNoteDialog
          quote={selection.quote}
          onCancel={() => setNoteOpen(false)}
          onSave={async (content) => {
            await onCreateDraft?.(selection.anchor, content);
            setNoteOpen(false);
            setSelection(undefined);
          }}
        />
      )}
    </section>
  );
}

function headingsBefore(doc: { descendants(callback: (node: { type: { name: string }; attrs: Record<string, unknown>; textContent: string }, pos: number) => boolean | void): void }, from: number): string[] {
  const levels = new Map<number, string>();
  doc.descendants((node, pos) => {
    if (pos >= from) return false;
    if (node.type.name === 'heading') {
      const level = Number(node.attrs.level ?? 1);
      levels.set(level, node.textContent);
      for (const existing of Array.from(levels.keys())) {
        if (existing > level) levels.delete(existing);
      }
    }
    return undefined;
  });
  return Array.from(levels.entries()).sort(([left], [right]) => left - right).map(([, title]) => title);
}
