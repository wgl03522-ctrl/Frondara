import type { UiState } from '@pnode/core';
import { MoonIcon, MonitorIcon, SunIcon, TypographyIcon } from '../../components/icons.js';
import { useI18n } from '../../i18n/I18nProvider.js';
import logoUrl from '../../assets/logo.png';

interface TopBarProps {
  documentPath?: string | undefined;
  saveState?: 'idle' | 'saving' | 'saved' | 'conflict' | 'error';
  theme?: UiState['theme'];
  readingFont?: UiState['readingFont'];
  onCycleTheme?(): void;
  onToggleReadingFont?(): void;
}

export function TopBar({
  documentPath,
  saveState = 'idle',
  theme = 'light',
  readingFont = 'sans',
  onCycleTheme,
  onToggleReadingFont
}: TopBarProps) {
  const { t } = useI18n();
  const ThemeIcon = theme === 'dark' ? MoonIcon : theme === 'system' ? MonitorIcon : SunIcon;
  const stateLabels = {
    idle: t('topbar.localWorkspace'),
    saving: t('topbar.saving'),
    saved: t('topbar.saved'),
    conflict: t('topbar.conflict'),
    error: t('topbar.error')
  } as const;
  const themeLabels = {
    light: t('topbar.lightTheme'),
    dark: t('topbar.darkTheme'),
    system: t('topbar.systemTheme')
  } as const;

  return (
    <header className="top-bar">
      <div className="brand" aria-label="Frondara">
        <img className="brand-mark" src={logoUrl} alt="" aria-hidden="true" />
        <span>Frondara</span>
      </div>
      <div className="document-breadcrumb">
        <span className="breadcrumb-workspace">{t('topbar.researchWorkspace')}</span>
        <span aria-hidden="true">/</span>
        <strong>{documentPath ?? t('topbar.selectDocument')}</strong>
      </div>
      <div className="top-bar-right">
        <div className={`save-state save-state--${saveState}`} aria-live="polite">
          <span className="status-dot" aria-hidden="true" />
          {stateLabels[saveState]}
        </div>
        {onToggleReadingFont && (
          <button
            type="button"
            className="icon-button"
            aria-label={readingFont === 'serif' ? t('topbar.serifFont') : t('topbar.sansFont')}
            onClick={onToggleReadingFont}
          >
            <TypographyIcon />
          </button>
        )}
        {onCycleTheme && (
          <button type="button" className="icon-button" aria-label={themeLabels[theme]} onClick={onCycleTheme}>
            <ThemeIcon />
          </button>
        )}
      </div>
    </header>
  );
}
