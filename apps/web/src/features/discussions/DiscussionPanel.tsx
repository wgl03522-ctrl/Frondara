import { useState } from 'react';
import type { Discussion } from '@pnode/core';
import { useI18n } from '../../i18n/I18nProvider.js';

interface DiscussionPanelProps {
  discussion?: Discussion | undefined;
  pendingQuestion?: string | undefined;
  pendingQuote?: string | undefined;
  contextSummary?: string | undefined;
  branches?: Discussion[] | undefined;
  parent?: Discussion | undefined;
  sending?: boolean | undefined;
  error?: string | undefined;
  onClose(): void;
  onSend?(content: string): Promise<void> | void;
  onOpenContext?(): void;
  onFork?(messageId: string, question: string, title?: string): Promise<void> | void;
  onRename?(id: string, title: string): Promise<void> | void;
  onOpenBranch?(branch: Discussion): void;
}

export function DiscussionPanel({
  discussion,
  pendingQuestion = '',
  pendingQuote,
  contextSummary,
  branches,
  parent,
  sending = false,
  error,
  onClose,
  onSend,
  onOpenContext,
  onFork,
  onRename,
  onOpenBranch
}: DiscussionPanelProps) {
  const { t } = useI18n();
  const draftContent = discussion?.status === 'draft' && discussion.messages[0]?.role === 'user'
    ? discussion.messages[0].content
    : pendingQuestion;
  const [content, setContent] = useState(draftContent);
  const [menuMessageId, setMenuMessageId] = useState<string>();
  const [forkMessageId, setForkMessageId] = useState<string>();
  const [forkQuestion, setForkQuestion] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [renameTitle, setRenameTitle] = useState('');

  const taskChips = [
    { label: t('discussion.task.argumentLabel'), prompt: t('discussion.task.argumentPrompt') },
    { label: t('discussion.task.premiseLabel'), prompt: t('discussion.task.premisePrompt') },
    { label: t('discussion.task.citationLabel'), prompt: t('discussion.task.citationPrompt') },
    { label: t('discussion.task.cautiousLabel'), prompt: t('discussion.task.cautiousPrompt') },
    { label: t('discussion.task.reviewerLabel'), prompt: t('discussion.task.reviewerPrompt') }
  ];
  const quote = discussion?.anchor.quote ?? pendingQuote;
  const headingPath = discussion?.anchor.headingPath ?? [];
  const positionLabel = headingPath.length > 0 ? headingPath.join(' · ') : t('discussion.currentParagraph');
  const messageCount = discussion?.status === 'active' ? discussion.messages.length : 0;

  async function send() {
    if (!onSend || !content.trim()) return;
    const text = content.trim();
    await onSend(text);
    setContent('');
  }

  function beginFork(messageId: string) {
    setMenuMessageId(undefined);
    setForkMessageId(messageId);
    setForkQuestion('');
  }

  function submitFork() {
    if (!onFork || !forkMessageId || !forkQuestion.trim()) return;
    void onFork(forkMessageId, forkQuestion.trim());
    setForkMessageId(undefined);
    setForkQuestion('');
  }

  function beginRename() {
    setRenameTitle(discussion?.title ?? '');
    setRenaming(true);
  }

  function submitRename() {
    if (!onRename || !discussion || !renameTitle.trim()) return;
    void onRename(discussion.id, renameTitle.trim());
    setRenaming(false);
  }

  function branchesForMessage(messageId: string): Discussion[] {
    return branches?.filter((item) => item.forkedFromMessageId === messageId) ?? [];
  }

  return (
    <aside className="discussion-panel" aria-label={t('discussion.panel')}>
      <header className="panel-header">
        <div className="panel-title">
          <span className="eyebrow">{t('discussion.anchored')}</span>
          {renaming ? (
            <form className="rename-form" onSubmit={(event) => { event.preventDefault(); submitRename(); }}>
              <input
                aria-label={t('discussion.name')}
                value={renameTitle}
                onChange={(event) => setRenameTitle(event.target.value)}
                autoFocus
              />
              <button type="submit" className="button button--primary" disabled={!renameTitle.trim()}>{t('common.save')}</button>
              <button type="button" className="button button--ghost" onClick={() => setRenaming(false)}>{t('common.cancel')}</button>
            </form>
          ) : (
            <h2>
              {discussion?.title ?? t('discussion.panel')}
              {discussion && onRename && (
                <button type="button" className="rename-trigger" aria-label={t('discussion.rename')} onClick={beginRename}>{t('discussion.rename')}</button>
              )}
            </h2>
          )}
        </div>
        <button type="button" className="icon-button" aria-label={t('discussion.close')} onClick={onClose}>×</button>
      </header>
      {!quote ? (
        <div className="discussion-empty">
          <strong>{t('discussion.emptyTitle')}</strong>
          <p>{t('discussion.emptyBody')}</p>
        </div>
      ) : (
        <div className="discussion-body">
          {parent && onOpenBranch && (
            <button type="button" className="branch-back" onClick={() => onOpenBranch(parent)}>
              {t('discussion.backToParent', { title: parent.title })}
            </button>
          )}
          <section className="anchor-card" aria-label={t('discussion.source')}>
            <span className="anchor-position">{positionLabel}</span>
            <blockquote>“{quote}”</blockquote>
          </section>
          {messageCount > 0 ? (
            <div className="message-list" aria-label={t('discussion.messages')}>
              {discussion!.messages.map((message) => {
                const messageBranches = branchesForMessage(message.id);
                return (
                  <article className={`message message--${message.role}`} key={message.id}>
                    <div className="message-head">
                      <span>{message.role === 'user' ? t('discussion.you') : 'AI'}</span>
                      {onFork && (
                        <div className="message-menu">
                          <button
                            type="button"
                            className="icon-button message-more"
                            aria-label={t('discussion.moreActions')}
                            aria-expanded={menuMessageId === message.id}
                            onClick={() => setMenuMessageId((current) => current === message.id ? undefined : message.id)}
                          >
                            ⋯
                          </button>
                          {menuMessageId === message.id && (
                            <div className="message-menu-list">
                              <button type="button" onClick={() => beginFork(message.id)}>{t('discussion.fork')}</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <p>{message.content}</p>
                    {forkMessageId === message.id && (
                      <div className="fork-form">
                        <label htmlFor={`fork-${message.id}`}>{t('discussion.fork')}</label>
                        <textarea
                          id={`fork-${message.id}`}
                          aria-label={t('discussion.newQuestion')}
                          value={forkQuestion}
                          onChange={(event) => setForkQuestion(event.target.value)}
                          placeholder={t('discussion.forkPlaceholder')}
                          autoFocus
                        />
                        <div className="fork-actions">
                          <button type="button" className="button button--ghost" onClick={() => setForkMessageId(undefined)}>{t('common.cancel')}</button>
                          <button type="button" className="button button--primary" disabled={!forkQuestion.trim() || sending} onClick={submitFork}>
                            {sending ? t('common.creating') : t('discussion.start')}
                          </button>
                        </div>
                        <p className="ai-hint">{t('discussion.forkHint')}</p>
                      </div>
                    )}
                    {messageBranches.length > 0 && (
                      <div className="message-branches" aria-label={t('discussion.directions')}>
                        <span className="ai-hint">{t('discussion.directionCount', { count: messageBranches.length })}</span>
                        {messageBranches.map((item) => (
                          <button key={item.id} type="button" className="branch-link" onClick={() => onOpenBranch?.(item)}>
                            {item.title}
                          </button>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="discussion-tasks" aria-label={t('discussion.entryPoints')}>
              <p className="discussion-tasks-lead">{t('discussion.angle')}</p>
              <div className="task-chips">
                {taskChips.map((chip) => (
                  <button key={chip.label} type="button" className="task-chip" onClick={() => setContent(chip.prompt)}>
                    {chip.label}
                  </button>
                ))}
              </div>
              <p className="ai-hint">{t('discussion.aiHint')}</p>
            </div>
          )}
          <div className="discussion-composer">
            {onOpenContext && (
              <button type="button" className="context-toggle" aria-label={t('discussion.manageContext')} onClick={onOpenContext}>
                {t('discussion.context')}
                <span>{contextSummary ?? t('common.default')}</span>
              </button>
            )}
            <label className="sr-only" htmlFor="discussion-input">{t('discussion.input')}</label>
            <div className="composer-field">
              <textarea
                id="discussion-input"
                aria-label={t('discussion.input')}
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder={t('discussion.placeholder')}
              />
              <div className="composer-bar">
                <span className="composer-hint">
                  {discussion?.status === 'draft' ? t('discussion.draftHint') : t('discussion.contextHint')}
                </span>
                <button
                  type="button"
                  className="button button--primary composer-send"
                  disabled={!content.trim() || sending || !onSend}
                  onClick={send}
                >
                  {sending ? t('common.sending') : t('common.send')}
                </button>
              </div>
            </div>
            {error && <p className="form-error" role="alert">{error}</p>}
          </div>
        </div>
      )}
    </aside>
  );
}
