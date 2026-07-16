import { useState } from 'react';
import type { Discussion } from '@pnode/core';

// Quiet task prompts for the empty state — clicking one fills the composer rather
// than sending, so the first question is always the user's to confirm.
const TASK_CHIPS: ReadonlyArray<{ label: string; prompt: string }> = [
  { label: '检查论证强度', prompt: '检查这段论证的前提、证据和结论强度。' },
  { label: '寻找隐含前提', prompt: '这段话隐含了哪些未言明的前提？' },
  { label: '检查引用需求', prompt: '这段陈述中哪些地方需要补充引用或出处？' },
  { label: '尝试更谨慎的表达', prompt: '在不改变原意的前提下，给出一个更谨慎的表述。' },
  { label: '从审稿人角度检查', prompt: '假设你是审稿人，这段内容可能会被如何质疑？' }
];

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
  const draftContent = discussion?.status === 'draft' && discussion.messages[0]?.role === 'user'
    ? discussion.messages[0].content
    : pendingQuestion;
  const [content, setContent] = useState(draftContent);
  // Fork is a hidden advanced action, revealed only via the message more-menu.
  // The first thing we ask for is the new *question*, not a name — naming is
  // deferred and optional (see backlog #1).
  const [menuMessageId, setMenuMessageId] = useState<string>();
  const [forkMessageId, setForkMessageId] = useState<string>();
  const [forkQuestion, setForkQuestion] = useState('');
  // Renaming the current discussion is opt-in: the title is editable in place.
  const [renaming, setRenaming] = useState(false);
  const [renameTitle, setRenameTitle] = useState('');

  const quote = discussion?.anchor.quote ?? pendingQuote;
  const headingPath = discussion?.anchor.headingPath ?? [];
  const positionLabel = headingPath.length > 0 ? headingPath.join(' · ') : '当前段落';
  const messageCount = discussion?.status === 'active' ? discussion.messages.length : 0;

  async function send() {
    if (!onSend || !content.trim()) return;
    const text = content.trim();
    await onSend(text);
    // Clear the composer once the turn is sent so the next question starts fresh.
    // App surfaces any failure via the error prop; the text is already captured.
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
    <aside className="discussion-panel" aria-label="段落讨论">
      <header className="panel-header">
        <div className="panel-title">
          <span className="eyebrow">锚定讨论</span>
          {renaming ? (
            <form
              className="rename-form"
              onSubmit={(event) => { event.preventDefault(); submitRename(); }}
            >
              <input
                aria-label="讨论名称"
                value={renameTitle}
                onChange={(event) => setRenameTitle(event.target.value)}
                autoFocus
              />
              <button type="submit" className="button button--primary" disabled={!renameTitle.trim()}>保存</button>
              <button type="button" className="button button--ghost" onClick={() => setRenaming(false)}>取消</button>
            </form>
          ) : (
            <h2>
              {discussion?.title ?? '段落讨论'}
              {discussion && onRename && (
                <button type="button" className="rename-trigger" aria-label="重命名讨论" onClick={beginRename}>重命名</button>
              )}
            </h2>
          )}
        </div>
        <button type="button" className="icon-button" aria-label="关闭讨论" onClick={onClose}>×</button>
      </header>
      {!quote ? (
        <div className="discussion-empty">
          <strong>尚未选择讨论</strong>
          <p>选中文档中的文字，即可与 AI 讨论或添加批注。</p>
        </div>
      ) : (
        <div className="discussion-body">
          {parent && onOpenBranch && (
            <button type="button" className="branch-back" onClick={() => onOpenBranch(parent)}>
              ← 返回上级讨论：{parent.title}
            </button>
          )}
          <section className="anchor-card" aria-label="关联原文">
            <span className="anchor-position">{positionLabel}</span>
            <blockquote>“{quote}”</blockquote>
          </section>
          {messageCount > 0 ? (
            <div className="message-list" aria-label="讨论消息">
              {discussion!.messages.map((message) => {
                const messageBranches = branchesForMessage(message.id);
                return (
                  <article className={`message message--${message.role}`} key={message.id}>
                    <div className="message-head">
                      <span>{message.role === 'user' ? '你' : 'AI'}</span>
                      {onFork && (
                        <div className="message-menu">
                          <button
                            type="button"
                            className="icon-button message-more"
                            aria-label="更多操作"
                            aria-expanded={menuMessageId === message.id}
                            onClick={() => setMenuMessageId((current) => current === message.id ? undefined : message.id)}
                          >
                            ⋯
                          </button>
                          {menuMessageId === message.id && (
                            <div className="message-menu-list">
                              <button type="button" onClick={() => beginFork(message.id)}>
                                从这里另行讨论
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <p>{message.content}</p>
                    {forkMessageId === message.id && (
                      <div className="fork-form">
                        <label htmlFor={`fork-${message.id}`}>从这里另行讨论</label>
                        <textarea
                          id={`fork-${message.id}`}
                          aria-label="新讨论问题"
                          value={forkQuestion}
                          onChange={(event) => setForkQuestion(event.target.value)}
                          placeholder="想从这里另外问什么？"
                          autoFocus
                        />
                        <div className="fork-actions">
                          <button type="button" className="button button--ghost" onClick={() => setForkMessageId(undefined)}>取消</button>
                          <button type="button" className="button button--primary" disabled={!forkQuestion.trim() || sending} onClick={submitFork}>
                            {sending ? '创建中' : '开始讨论'}
                          </button>
                        </div>
                        <p className="ai-hint">这会新开一个讨论分支，名称默认取你的第一个问题，之后可改。</p>
                      </div>
                    )}
                    {messageBranches.length > 0 && (
                      <div className="message-branches" aria-label="讨论方向">
                        <span className="ai-hint">该消息产生了 {messageBranches.length} 个讨论方向</span>
                        {messageBranches.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className="branch-link"
                            onClick={() => onOpenBranch?.(item)}
                          >
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
            <div className="discussion-tasks" aria-label="讨论切入点">
              <p className="discussion-tasks-lead">你想从哪个角度分析这段内容？</p>
              <div className="task-chips">
                {TASK_CHIPS.map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    className="task-chip"
                    onClick={() => setContent(chip.prompt)}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
              <p className="ai-hint">AI 将参考当前段落与所选上下文，不会直接修改正文。</p>
            </div>
          )}
          <div className="discussion-composer">
            {onOpenContext && (
              <button type="button" className="context-toggle" aria-label="管理上下文" onClick={onOpenContext}>
                上下文
                <span>{contextSummary ?? '默认'}</span>
              </button>
            )}
            <label className="sr-only" htmlFor="discussion-input">讨论输入</label>
            <div className="composer-field">
              <textarea
                id="discussion-input"
                aria-label="讨论输入"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="继续围绕所选原文讨论…"
              />
              <div className="composer-bar">
                <span className="composer-hint">
                  {discussion?.status === 'draft' ? '发送后将转为 AI 讨论' : '点“上下文”管理参考材料'}
                </span>
                <button
                  type="button"
                  className="button button--primary composer-send"
                  disabled={!content.trim() || sending || !onSend}
                  onClick={send}
                >
                  {sending ? '发送中' : '发送'}
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
