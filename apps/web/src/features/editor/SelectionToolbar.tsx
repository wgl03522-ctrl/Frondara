import { useState } from 'react';
import { AiCommandMenu } from './AiCommandMenu.js';

export interface SelectionDraft {
  quote: string;
  prefix: string;
  suffix: string;
  headingPath: string[];
  position?: { left: number; top: number } | undefined;
}

interface SelectionToolbarProps {
  selection: SelectionDraft;
  onDiscuss(question: string): void;
  onAnnotate(): void;
  onDismiss(): void;
}

export function SelectionToolbar({ selection, onDiscuss, onAnnotate, onDismiss }: SelectionToolbarProps) {
  const [commandOpen, setCommandOpen] = useState(false);

  const style = selection.position
    ? { left: `${selection.position.left}px`, top: `${selection.position.top}px` }
    : undefined;

  return (
    <div className="selection-popover" style={style}>
      {commandOpen ? (
        <AiCommandMenu onOpen={onDiscuss} onCancel={() => setCommandOpen(false)} />
      ) : (
        <div className="selection-toolbar" role="toolbar" aria-label="文本操作">
          <button type="button" onClick={() => setCommandOpen(true)}>与 AI 讨论</button>
          <button type="button" onClick={onAnnotate}>添加批注</button>
          <button type="button" aria-label="更多" onClick={onDismiss}>更多</button>
        </div>
      )}
    </div>
  );
}
