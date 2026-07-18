import { useEffect, useState } from 'react';
import type { Discussion, TextAnchor } from '@pnode/core';
import { api, type DocumentEntry, type ContextSpec } from '../api/client.js';
import { useUiStore } from '../stores/ui-store.js';
import { DiscussionPanel } from '../features/discussions/DiscussionPanel.js';
import { BranchGraphOverlay } from '../features/discussions/BranchGraphOverlay.js';
import { ContextPanel } from '../features/discussions/ContextPanel.js';
import { connectedDiscussions } from '../features/discussions/branch-family.js';
import { EditorWorkspace } from '../features/editor/EditorWorkspace.js';
import { SettingsDialog } from '../features/settings/SettingsDialog.js';
import { aiErrorMessage } from '../features/settings/ai-error-message.js';
import { useI18n } from '../i18n/I18nProvider.js';
import { FilePanel } from '../features/workspace/FilePanel.js';
import { VersionPanel } from '../features/workspace/VersionPanel.js';
import { SearchPanel } from '../features/workspace/SearchPanel.js';
import { OpenWorkspace } from '../features/workspace/OpenWorkspace.js';
import { TopBar } from '../features/workspace/TopBar.js';
import { WorkspaceRail } from '../features/workspace/WorkspaceRail.js';
import type { DocumentSaveState } from '../features/editor/useDocument.js';

interface PendingDiscussion {
  anchor: TextAnchor;
  question: string;
}

// Fresh context selection for a newly opened discussion: three defaults on,
// no extra files or discussions. Reset each time the active discussion changes.
const DEFAULT_CONTEXT_SPEC: ContextSpec = {
  includeDocument: true,
  includeParagraph: true,
  includeHistory: true,
  filePaths: [],
  discussionIds: []
};

export function App() {
  const { locale, t } = useI18n();
  const filePanelOpen = useUiStore((state) => state.filePanelOpen);
  const discussionOpen = useUiStore((state) => state.discussionOpen);
  const lastDocument = useUiStore((state) => state.lastDocument);
  const setFilePanelOpen = useUiStore((state) => state.setFilePanelOpen);
  const setDiscussionOpen = useUiStore((state) => state.setDiscussionOpen);
  const setActiveDocument = useUiStore((state) => state.setActiveDocument);
  const theme = useUiStore((state) => state.theme);
  const readingFont = useUiStore((state) => state.readingFont);
  const setTheme = useUiStore((state) => state.setTheme);
  const setReadingFont = useUiStore((state) => state.setReadingFont);
  const hydrate = useUiStore((state) => state.hydrate);
  const [entries, setEntries] = useState<DocumentEntry[]>([]);
  const [workspaceOpen, setWorkspaceOpen] = useState<boolean>();
  const [workspaceError, setWorkspaceError] = useState<string>();
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [activeDocument, setActiveDocumentState] = useState<string | undefined>(lastDocument);
  const [saveState, setSaveState] = useState<DocumentSaveState>('idle');
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [selectedDiscussion, setSelectedDiscussion] = useState<Discussion>();
  const [pendingDiscussion, setPendingDiscussion] = useState<PendingDiscussion>();
  const [sending, setSending] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [discussionError, setDiscussionError] = useState<string>();
  const [graphOpen, setGraphOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [contextPanelOpen, setContextPanelOpen] = useState(false);
  const [contextSpec, setContextSpec] = useState<ContextSpec>(DEFAULT_CONTEXT_SPEC);
  // Bumped after a version restore so the editor remounts and re-fetches the
  // freshly restored content (its content only loads when the key changes).
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function initialize(attempt = 0): Promise<void> {
      setDocumentsLoading(true);
      setWorkspaceError(undefined);
      try {
        const workspace = await api.readWorkspace();
        if (cancelled) return;
        setWorkspaceOpen(workspace.open);
        if (!workspace.open) {
          setEntries([]);
          setDocumentsLoading(false);
          return;
        }

        const [documents, ui] = await Promise.all([api.listDocuments(), api.readUiState()]);
        if (cancelled) return;
        setEntries(documents);
        hydrate(ui);
        if (!ui.lastDocument) setActiveDocumentState(undefined);
        else setActiveDocumentState((current) => current ?? ui.lastDocument);
        setDocumentsLoading(false);
      } catch (caught: unknown) {
        if (cancelled) return;
        if (attempt < 2) {
          window.setTimeout(() => void initialize(attempt + 1), 250 * (attempt + 1));
          return;
        }
        setWorkspaceError(caught instanceof Error ? caught.message : t('app.connectFailed'));
        setDocumentsLoading(false);
      }
    }

    void initialize();
    return () => { cancelled = true; };
  }, [hydrate]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.readingFont = readingFont;
    if (theme !== 'system') {
      root.dataset.theme = theme;
      return;
    }
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => { root.dataset.theme = query.matches ? 'dark' : 'light'; };
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, [theme, readingFont]);

  useEffect(() => {
    let cancelled = false;
    if (activeDocument) {
      void api.listDiscussions(activeDocument).then((items) => {
        if (!cancelled) setDiscussions(items);
      }).catch(() => {
        if (!cancelled) setDiscussions([]);
      });
    }
    return () => { cancelled = true; };
  }, [activeDocument]);

  async function openWorkspace(path: string) {
    setDocumentsLoading(true);
    setWorkspaceError(undefined);
    try {
      await api.openWorkspace(path);
      const [documents, ui] = await Promise.all([api.listDocuments(), api.readUiState()]);
      setWorkspaceOpen(true);
      setEntries(documents);
      hydrate(ui);
      if (ui.lastDocument) {
        setActiveDocumentState(ui.lastDocument);
      } else {
        setActiveDocumentState(undefined);
      }
    } catch (caught: unknown) {
      setWorkspaceError(caught instanceof Error ? caught.message : t('app.openWorkspaceFailed'));
    } finally {
      setDocumentsLoading(false);
    }
  }

  function openDocument(path: string) {
    setActiveDocumentState(path);
    setActiveDocument(path);
    setFilePanelOpen(false);
    setVersionsOpen(false);
    setSearchOpen(false);
    setContextPanelOpen(false);
    setDiscussionOpen(false);
    setSelectedDiscussion(undefined);
    setPendingDiscussion(undefined);
    void api.saveUiState(useUiStore.getState().durableState()).catch(() => undefined);
  }

  // Files, Versions and Search all occupy the same left overlay slot, so opening
  // one closes the others. Each rail button toggles its own panel.
  function toggleFilePanel() {
    const next = !filePanelOpen;
    setFilePanelOpen(next);
    if (next) { setVersionsOpen(false); setSearchOpen(false); }
  }

  function toggleVersions() {
    setVersionsOpen((open) => {
      const next = !open;
      if (next) { setFilePanelOpen(false); setSearchOpen(false); }
      return next;
    });
  }

  function toggleSearch() {
    setSearchOpen((open) => {
      const next = !open;
      if (next) { setFilePanelOpen(false); setVersionsOpen(false); }
      return next;
    });
  }

  // After restoring a version the document content changed on disk; bump the nonce
  // so the editor remounts and re-fetches instead of showing stale content.
  function onVersionRestored() {
    setReloadNonce((value) => value + 1);
  }

  async function createDocument(path: string) {
    await api.createDocument(path, `# ${t('app.newDocumentTitle')}\n\n`);
    setEntries(await api.listDocuments());
    openDocument(path);
  }

  async function createDraft(anchor: TextAnchor, content: string) {
    const draft = await api.createDraftDiscussion(anchor, content);
    setDiscussions((current) => [...current, draft]);
    setDiscussionOpen(false);
    setSelectedDiscussion(undefined);
    setPendingDiscussion(undefined);
  }

  function beginDiscussion(anchor: TextAnchor, question: string) {
    setPendingDiscussion({ anchor, question });
    setSelectedDiscussion(undefined);
    setContextSpec(DEFAULT_CONTEXT_SPEC);
    setContextPanelOpen(false);
    setDiscussionOpen(true);
  }

  function openExistingDiscussion(discussion: Discussion) {
    setSelectedDiscussion(discussion);
    setPendingDiscussion(undefined);
    setContextSpec(DEFAULT_CONTEXT_SPEC);
    setContextPanelOpen(false);
    setDiscussionOpen(true);
  }

  async function sendDiscussion(content: string) {
    setSending(true);
    setDiscussionError(undefined);
    try {
      if (selectedDiscussion?.status === 'draft') {
        const response = await api.activateDiscussion(selectedDiscussion.id, content, contextSpec);
        replaceDiscussion(response.discussion);
        setSelectedDiscussion(response.discussion);
      } else if (selectedDiscussion?.status === 'active') {
        const response = await api.addDiscussionMessage(
          selectedDiscussion.id,
          content,
          selectedDiscussion.anchor.quote,
          contextSpec
        );
        replaceDiscussion(response.discussion);
        setSelectedDiscussion(response.discussion);
      } else if (pendingDiscussion) {
        const response = await api.createDiscussion(pendingDiscussion.anchor, content, contextSpec);
        setDiscussions((current) => [...current, response.discussion]);
        setSelectedDiscussion(response.discussion);
        setPendingDiscussion(undefined);
      }
    } catch (caught: unknown) {
      setDiscussionError(aiErrorMessage(caught, locale, t('app.discussionFailed')));
    } finally {
      setSending(false);
    }
  }

  async function forkDiscussion(messageId: string, question: string, title?: string) {
    if (!selectedDiscussion) return;
    setSending(true);
    setDiscussionError(undefined);
    try {
      const response = await api.forkDiscussion(selectedDiscussion.id, messageId, question, title);
      setDiscussions((current) => [...current, response.discussion]);
      setSelectedDiscussion(response.discussion);
    } catch (caught: unknown) {
      setDiscussionError(aiErrorMessage(caught, locale, t('app.forkFailed')));
    } finally {
      setSending(false);
    }
  }

  async function renameDiscussion(id: string, title: string) {
    setDiscussionError(undefined);
    try {
      const renamed = await api.renameDiscussion(id, title);
      replaceDiscussion(renamed);
      if (selectedDiscussion?.id === renamed.id) setSelectedDiscussion(renamed);
    } catch (caught: unknown) {
      setDiscussionError(aiErrorMessage(caught, locale, t('app.renameFailed')));
    }
  }

  function replaceDiscussion(next: Discussion) {
    setDiscussions((current) => current.map((discussion) => discussion.id === next.id ? next : discussion));
  }

  function cycleTheme() {
    const order = ['light', 'dark', 'system'] as const;
    const next = order[(order.indexOf(theme) + 1) % order.length]!;
    setTheme(next);
    void api.saveUiState(useUiStore.getState().durableState()).catch(() => undefined);
  }

  function toggleReadingFont() {
    setReadingFont(readingFont === 'serif' ? 'sans' : 'serif');
    void api.saveUiState(useUiStore.getState().durableState()).catch(() => undefined);
  }

  // The graph shows the whole branch family of the selected discussion: its
  // connected component via parentDiscussionId links (ancestors + every node
  // reachable from them). This is robust even if anchors drift — quote equality
  // is not enough, since switching into a child must still surface the full tree.
  // Falls back to all discussions in the document when nothing is selected.
  const graphDiscussions = selectedDiscussion
    ? connectedDiscussions(discussions, selectedDiscussion.id)
    : discussions;
  const graphAvailable = discussions.some((item) => item.parentDiscussionId);
  // The parent of the current discussion, so the panel can offer a way back.
  const parentDiscussion = selectedDiscussion?.parentDiscussionId
    ? discussions.find((item) => item.id === selectedDiscussion.parentDiscussionId)
    : undefined;

  // A short human summary of the active context selection for the composer chip.
  const contextSummary = (() => {
    const parts: string[] = [];
    if (contextSpec.includeDocument) parts.push(t('app.context.document'));
    if (contextSpec.includeParagraph) parts.push(t('app.context.paragraph'));
    if (contextSpec.includeHistory) parts.push(t('app.context.history'));
    const extra = contextSpec.filePaths.length + contextSpec.discussionIds.length;
    if (extra > 0) parts.push(`+${extra}`);
    return parts.length > 0 ? parts.join(' · ') : t('common.none');
  })();

  return (
    <div className="app-shell">
      <TopBar
        documentPath={activeDocument}
        saveState={saveState}
        theme={theme}
        readingFont={readingFont}
        onCycleTheme={cycleTheme}
        onToggleReadingFont={toggleReadingFont}
      />
      <div className="workspace-grid" data-discussion-open={discussionOpen}>
        <WorkspaceRail
          filePanelOpen={filePanelOpen}
          versionsOpen={versionsOpen}
          searchOpen={searchOpen}
          onToggleFiles={toggleFilePanel}
          onToggleVersions={toggleVersions}
          onToggleSearch={toggleSearch}
          onOpenDiscussions={() => setDiscussionOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          graphAvailable={graphAvailable}
          onOpenGraph={() => setGraphOpen(true)}
        />
        {filePanelOpen && (
          <FilePanel
            entries={entries}
            loading={documentsLoading}
            activeDocument={activeDocument}
            onOpenDocument={openDocument}
            onCreateDocument={createDocument}
            onClose={() => setFilePanelOpen(false)}
          />
        )}
        {versionsOpen && (
          <VersionPanel
            documentPath={activeDocument}
            onClose={() => setVersionsOpen(false)}
            onRestored={onVersionRestored}
          />
        )}
        {searchOpen && (
          <SearchPanel
            onOpenDocument={openDocument}
            onClose={() => setSearchOpen(false)}
          />
        )}
        <main aria-label={t('app.mainDocument')} className="editor-region">
          {workspaceOpen === false ? (
            <OpenWorkspace loading={documentsLoading} error={workspaceError} onOpen={openWorkspace} />
          ) : workspaceOpen === undefined ? (
            <div className="editor-loading" role="status">{t('app.connecting')}</div>
          ) : (
            <EditorWorkspace
              key={`${activeDocument ?? 'empty'}:${reloadNonce}`}
              documentPath={activeDocument}
              discussions={discussions}
              onSaveStateChange={setSaveState}
              onCreateDraft={createDraft}
              onOpenDiscussion={beginDiscussion}
              onOpenExistingDiscussion={openExistingDiscussion}
            />
          )}
        </main>
        {discussionOpen && (
          <DiscussionPanel
            key={selectedDiscussion?.id ?? pendingDiscussion?.anchor.documentVersionId ?? 'empty'}
            discussion={selectedDiscussion}
            pendingQuestion={pendingDiscussion?.question}
            pendingQuote={pendingDiscussion?.anchor.quote}
            contextSummary={contextSummary}
            branches={selectedDiscussion
              ? discussions.filter((item) => item.parentDiscussionId === selectedDiscussion.id)
              : undefined}
            parent={parentDiscussion}
            sending={sending}
            error={discussionError}
            onSend={sendDiscussion}
            onOpenContext={() => setContextPanelOpen((open) => !open)}
            onFork={forkDiscussion}
            onRename={renameDiscussion}
            onOpenBranch={openExistingDiscussion}
            onClose={() => setDiscussionOpen(false)}
          />
        )}
        {discussionOpen && contextPanelOpen && (selectedDiscussion || pendingDiscussion) && (
          <ContextPanel
            spec={contextSpec}
            onChange={setContextSpec}
            discussions={discussions}
            currentDiscussionId={selectedDiscussion?.id ?? ''}
            entries={entries}
            currentDocumentPath={activeDocument}
            onClose={() => setContextPanelOpen(false)}
          />
        )}
      </div>
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
      {graphOpen && (
        <BranchGraphOverlay
          discussions={graphDiscussions}
          currentId={selectedDiscussion?.id}
          onOpenBranch={(discussion) => { openExistingDiscussion(discussion); setGraphOpen(false); }}
          onClose={() => setGraphOpen(false)}
        />
      )}
      <footer className="status-bar">
        <span>{activeDocument ? `Markdown · ${t('app.discussionCount', { count: discussions.length })}` : t('app.ready')}</span>
        <span>UTF-8</span>
      </footer>
    </div>
  );
}
