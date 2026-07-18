import { useState } from 'react';
import { useI18n } from '../../i18n/I18nProvider.js';
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
  const { t } = useI18n();
  const [commandOpen, setCommandOpen] = useState(false);
  const style = selection.position
    ? { left: `${selection.position.left}px`, top: `${selection.position.top}px` }
    : undefined;

  return (
    <div className="selection-popover" style={style}>
      {commandOpen ? (
        <AiCommandMenu onOpen={onDiscuss} onCancel={() => setCommandOpen(false)} />
      ) : (
        <div className="selection-toolbar" role="toolbar" aria-label={t('selection.actions')}>
          <button type="button" onClick={() => setCommandOpen(true)}>{t('selection.discuss')}</button>
          <button type="button" onClick={onAnnotate}>{t('selection.annotate')}</button>
          <button type="button" aria-label={t('selection.more')} onClick={onDismiss}>{t('selection.more')}</button>
        </div>
      )}
    </div>
  );
}
