import type { UiState } from '@pnode/core';
import { MoonIcon, MonitorIcon, SunIcon, TypographyIcon } from '../../components/icons.js';
import logoUrl from '../../assets/logo.png';

interface TopBarProps {
  documentPath?: string | undefined;
  saveState?: 'idle' | 'saving' | 'saved' | 'conflict' | 'error';
  theme?: UiState['theme'];
  readingFont?: UiState['readingFont'];
  onCycleTheme?(): void;
  onToggleReadingFont?(): void;
}

const stateLabels = {
  idle: '本地工作区',
  saving: '正在保存',
  saved: '已保存',
  conflict: '保存已暂停',
  error: '保存失败'
} as const;

const themeLabels = {
  light: '浅色主题（点击切换到深色）',
  dark: '深色主题（点击切换到跟随系统）',
  system: '跟随系统（点击切换到浅色）'
} as const;

export function TopBar({
  documentPath,
  saveState = 'idle',
  theme = 'light',
  readingFont = 'sans',
  onCycleTheme,
  onToggleReadingFont
}: TopBarProps) {
  const ThemeIcon = theme === 'dark' ? MoonIcon : theme === 'system' ? MonitorIcon : SunIcon;
  return (
    <header className="top-bar">
      <div className="brand" aria-label="Frondara">
        <img className="brand-mark" src={logoUrl} alt="" aria-hidden="true" />
        <span>Frondara</span>
      </div>
      <div className="document-breadcrumb">
        <span className="breadcrumb-workspace">研究工作区</span>
        <span aria-hidden="true">/</span>
        <strong>{documentPath ?? '选择一个 Markdown 文档'}</strong>
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
            aria-label={readingFont === 'serif' ? '阅读字体：衬线（点击切换到无衬线）' : '阅读字体：无衬线（点击切换到衬线）'}
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
