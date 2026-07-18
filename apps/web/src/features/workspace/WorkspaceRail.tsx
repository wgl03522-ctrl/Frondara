import {
  FilesIcon,
  SearchIcon,
  DiscussionsIcon,
  VersionsIcon,
  SettingsIcon,
  GraphIcon
} from '../../components/icons.js';
import { useI18n } from '../../i18n/I18nProvider.js';

interface WorkspaceRailProps {
  filePanelOpen: boolean;
  searchOpen?: boolean;
  versionsOpen?: boolean;
  onToggleFiles(): void;
  onToggleSearch?(): void;
  onToggleVersions?(): void;
  onOpenDiscussions(): void;
  onOpenSettings(): void;
  graphAvailable?: boolean;
  onOpenGraph?(): void;
}

export function WorkspaceRail({
  filePanelOpen,
  searchOpen = false,
  versionsOpen = false,
  onToggleFiles,
  onToggleSearch,
  onToggleVersions,
  onOpenDiscussions,
  onOpenSettings,
  graphAvailable = false,
  onOpenGraph
}: WorkspaceRailProps) {
  const { t } = useI18n();
  return (
    <nav className="workspace-rail" aria-label={t('rail.tools')}>
      <div className="rail-actions">
        <button
          type="button"
          className="rail-button"
          data-active={filePanelOpen}
          aria-label={filePanelOpen ? t('rail.closeFiles') : t('rail.openFiles')}
          onClick={onToggleFiles}
        >
          <FilesIcon />
        </button>
        <button
          type="button"
          className="rail-button"
          data-active={searchOpen}
          aria-label={searchOpen ? t('rail.closeSearch') : t('rail.search')}
          onClick={onToggleSearch}
        >
          <SearchIcon />
        </button>
        <button type="button" className="rail-button" aria-label={t('rail.discussions')} onClick={onOpenDiscussions}>
          <DiscussionsIcon />
        </button>
        <button
          type="button"
          className="rail-button"
          data-active={versionsOpen}
          aria-label={versionsOpen ? t('rail.closeVersions') : t('rail.versions')}
          onClick={onToggleVersions}
        >
          <VersionsIcon />
        </button>
      </div>
      <div className="rail-actions">
        {graphAvailable && onOpenGraph && (
          <button type="button" className="rail-button" aria-label={t('rail.graph')} onClick={onOpenGraph}>
            <GraphIcon />
          </button>
        )}
        <button type="button" className="rail-button rail-settings" aria-label={t('rail.settings')} onClick={onOpenSettings}>
          <SettingsIcon />
        </button>
      </div>
    </nav>
  );
}
