import { useState } from 'react';

const shortcuts = [
  ['检查论证', '检查这段论证的前提、证据和结论强度'],
  ['提供修改建议', '请提供更清晰、准确且保持原意的修改建议'],
  ['解释所选内容', '解释这段内容的含义、关键概念和推理过程'],
  ['查找引用需求', '判断这段内容中哪些陈述需要文献支持，并说明原因']
] as const;

interface AiCommandMenuProps {
  initialQuestion?: string | undefined;
  onOpen(question: string): void;
  onCancel(): void;
}

export function AiCommandMenu({ initialQuestion = '', onOpen, onCancel }: AiCommandMenuProps) {
  const [question, setQuestion] = useState(initialQuestion);

  return (
    <section className="ai-command-menu" aria-label="AI 讨论命令">
      <label htmlFor="discussion-question">讨论问题</label>
      <textarea
        id="discussion-question"
        aria-label="讨论问题"
        value={question}
        onChange={(event) => setQuestion(event.target.value)}
        placeholder="自由输入你想讨论的问题…"
        autoFocus
      />
      <div className="command-shortcuts" aria-label="快捷命令">
        {shortcuts.map(([label, prompt]) => (
          <button type="button" key={label} onClick={() => setQuestion(prompt)}>{label}</button>
        ))}
      </div>
      <div className="command-actions">
        <button type="button" className="button button--ghost" onClick={onCancel}>取消</button>
        <button
          type="button"
          className="button button--primary"
          disabled={!question.trim()}
          onClick={() => onOpen(question.trim())}
        >
          打开讨论
        </button>
      </div>
    </section>
  );
}
