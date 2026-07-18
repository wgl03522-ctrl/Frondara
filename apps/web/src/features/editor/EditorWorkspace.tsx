import { EditorContent, useEditor } from '@tiptap/react';
import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import type { Discussion, TextAnchor } from '@pnode/core';
import { DraftNoteDialog } from '../discussions/DraftNoteDialog.js';
import { SelectionToolbar, type SelectionDraft } from './SelectionToolbar.js';
import { createEditorExtensions } from './markdown.js';
import { setDiscussionHighlights } from './discussion-highlight.js';
import { useDocument, type DocumentSaveState } from './useDocument.js';
import { useI18n } from '../../i18n/I18nProvider.js';
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
  const { locale, t } = useI18n();
  const { document, currentVersionId, loading, error, saveState, save, reload } = useDocument(documentPath);
  const extensions = useMemo(() => createEditorExtensions(t('editor.placeholder')), [locale]);
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
        'aria-label': t('editor.aria'),
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
    },
    onUpdate: ({ editor: currentEditor }) => {
      setSelection(undefined);
      if (timerRef.current) clearTimeout(timerRef.current);
      const markdown = currentEditor.getMarkdown();
      timerRef.current = setTimeout(() => void saveRef.current(markdown), 750);
    }
  }, [documentPath, locale]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  useEffect(() => {
    onSaveStateChange?.(saveState);
  }, [onSaveStateChange, saveState]);

  useEffect(() => {
    loadedVersionRef.current = undefined;
  }, [editor]);

  useEffect(() => {
    if (!editor || !document || loadedVersionRef.current === document.versionId) return;
    editor.commands.setContent(document.content, { contentType: 'markdown', emitUpdate: false });
    loadedVersionRef.current = document.versionId;
  }, [document, editor]);

  useEffect(() => {
    if (!editor) return;
    setDiscussionHighlights(editor, discussions);
  }, [discussions, editor, document]);

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
        <h1>{t('editor.emptyTitle')}</h1>
        <p>{t('editor.emptyBody')}</p>
      </section>
    );
  }

  if (loading && !document) return <div className="editor-loading" role="status">{t('editor.loading')}</div>;
  if (error && !document) return <div className="editor-error" role="alert">{error}</div>;

  return (
    <section className="editor-workspace" aria-label={t('editor.region')}>
      <div className="editor-toolbar" aria-label={t('editor.toolbar')}>
        <div className="toolbar-group">
          <button type="button" aria-label={t('editor.bold')} onClick={() => editor?.chain().focus().toggleBold().run()}>B</button>
          <button type="button" aria-label={t('editor.italic')} onClick={() => editor?.chain().focus().toggleItalic().run()}><em>I</em></button>
          <button type="button" aria-label={t('editor.code')} onClick={() => editor?.chain().focus().toggleCode().run()}>⌘</button>
        </div>
        <div className="toolbar-group toolbar-group--right">
          {discussions.length > 0 && <span className="discussion-count">{t('app.discussionCount', { count: discussions.length })}</span>}
          <button type="button" onClick={() => setShowMarkdown((shown) => !shown)}>
            {showMarkdown ? t('editor.backToEdit') : t('editor.viewMarkdown')}
          </button>
        </div>
      </div>
      {saveState === 'conflict' && (
        <div className="conflict-banner" role="alert">
          <div>
            <strong>{t('editor.diskChanged')}</strong>
            <span>{t('editor.autosavePaused')}</span>
          </div>
          <div className="conflict-actions">
            <button type="button" onClick={() => setShowMarkdown(true)}>{t('editor.compare')}</button>
            <button type="button" onClick={() => void reload()}>{t('editor.reload')}</button>
          </div>
        </div>
      )}
      <div className="paper-scroll">
        <article className="document-paper">
          <div className="document-meta">
            <span>{documentPath}</span>
            <span>{saveState === 'saving' ? `${t('common.saving')}…` : saveState === 'saved' ? t('common.saved') : 'Markdown'}</span>
          </div>
          {discussions.length > 0 && (
            <div className="document-discussions" aria-label={t('editor.discussionMarkers')}>
              {discussions.map((discussion) => (
                <button
                  type="button"
                  className="discussion-marker"
                  data-status={discussion.status}
                  key={discussion.id}
                  onClick={() => onOpenExistingDiscussion?.(discussion)}
                >
                  <span>{discussion.status === 'draft' ? t('editor.note') : t('common.discussion')}</span>
                  <strong>{discussion.anchor.quote}</strong>
                </button>
              ))}
            </div>
          )}
          {showMarkdown ? (
            <pre className="markdown-preview" aria-label={t('editor.currentMarkdown')}>{editor?.getMarkdown() ?? document?.content ?? ''}</pre>
          ) : (
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
