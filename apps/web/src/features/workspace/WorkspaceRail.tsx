import {
  FilesIcon,
  SearchIcon,
  DiscussionsIcon,
  VersionsIcon,
  SettingsIcon,
  GraphIcon
} from '../../components/icons.js';

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
  return (
    <nav className="workspace-rail" aria-label="工作区工具">
      <div className="rail-actions">
        <button
          type="button"
          className="rail-button"
          data-active={filePanelOpen}
          aria-label={filePanelOpen ? '关闭文件' : '打开文件'}
          onClick={onToggleFiles}
        >
          <FilesIcon />
        </button>
        <button
          type="button"
          className="rail-button"
          data-active={searchOpen}
          aria-label={searchOpen ? '关闭搜索' : '搜索'}
          onClick={onToggleSearch}
        >
          <SearchIcon />
        </button>
        <button type="button" className="rail-button" aria-label="讨论" onClick={onOpenDiscussions}>
          <DiscussionsIcon />
        </button>
        <button
          type="button"
          className="rail-button"
          data-active={versionsOpen}
          aria-label={versionsOpen ? '关闭版本历史' : '版本历史'}
          onClick={onToggleVersions}
        >
          <VersionsIcon />
        </button>
      </div>
      <div className="rail-actions">
        {graphAvailable && onOpenGraph && (
          <button type="button" className="rail-button" aria-label="展开树图" onClick={onOpenGraph}>
            <GraphIcon />
          </button>
        )}
        <button type="button" className="rail-button rail-settings" aria-label="设置" onClick={onOpenSettings}>
          <SettingsIcon />
        </button>
      </div>
    </nav>
  );
}
