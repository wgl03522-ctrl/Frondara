import { useState } from 'react';
import { useI18n } from '../../i18n/I18nProvider.js';

interface AiCommandMenuProps {
  initialQuestion?: string | undefined;
  onOpen(question: string): void;
  onCancel(): void;
}

export function AiCommandMenu({ initialQuestion = '', onOpen, onCancel }: AiCommandMenuProps) {
  const { t } = useI18n();
  const [question, setQuestion] = useState(initialQuestion);
  const shortcuts = [
    [t('commands.argumentLabel'), t('commands.argumentPrompt')],
    [t('commands.reviseLabel'), t('commands.revisePrompt')],
    [t('commands.explainLabel'), t('commands.explainPrompt')],
    [t('commands.citationsLabel'), t('commands.citationsPrompt')]
  ] as const;

  return (
    <section className="ai-command-menu" aria-label={t('commands.aria')}>
      <label htmlFor="discussion-question">{t('commands.question')}</label>
      <textarea
        id="discussion-question"
        aria-label={t('commands.question')}
        value={question}
        onChange={(event) => setQuestion(event.target.value)}
        placeholder={t('commands.placeholder')}
        autoFocus
      />
      <div className="command-shortcuts" aria-label={t('commands.shortcuts')}>
        {shortcuts.map(([label, prompt]) => (
          <button type="button" key={label} onClick={() => setQuestion(prompt)}>{label}</button>
        ))}
      </div>
      <div className="command-actions">
        <button type="button" className="button button--ghost" onClick={onCancel}>{t('common.cancel')}</button>
        <button
          type="button"
          className="button button--primary"
          disabled={!question.trim()}
          onClick={() => onOpen(question.trim())}
        >
          {t('commands.open')}
        </button>
      </div>
    </section>
  );
}
