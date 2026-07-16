import { useState } from 'react';
import { isDesktop, pickWorkspaceFolder } from '../../api/client.js';
import logoUrl from '../../assets/logo.png';

interface OpenWorkspaceProps {
  loading: boolean;
  error?: string | undefined;
  onOpen(path: string): Promise<void>;
}

export function OpenWorkspace({ loading, error, onOpen }: OpenWorkspaceProps) {
  const [path, setPath] = useState('');
  const desktop = isDesktop();

  // In the desktop shell, the native folder picker fills the field (and opens
  // immediately on a confirmed pick). Elsewhere the user types a path by hand.
  async function browse() {
    const picked = await pickWorkspaceFolder();
    if (picked) {
      setPath(picked);
      await onOpen(picked);
    }
  }

  return (
    <section className="editor-empty-state">
      <img className="empty-document-mark" src={logoUrl} alt="" aria-hidden="true" />
      <span className="brand-wordmark">Frondara</span>
      <span className="eyebrow">Ideas branch. Context holds.</span>
      <h1>打开一个本地工作区</h1>
      <p>
        {desktop
          ? '选择包含 Markdown 文档的文件夹。讨论、版本和界面状态会保存在该目录的 .pnode 中。'
          : '输入包含 Markdown 文档的文件夹路径。讨论、版本和界面状态会保存在该目录的 .pnode 中。'}
      </p>
      {desktop && (
        <button
          type="button"
          className="button button--primary"
          disabled={loading}
          onClick={() => void browse()}
        >
          {loading ? '正在打开' : '选择文件夹…'}
        </button>
      )}
      <form
        className="open-workspace-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (path.trim()) void onOpen(path.trim());
        }}
      >
        <label htmlFor="workspace-path">{desktop ? '或手动输入路径' : '工作区文件夹路径'}</label>
        <div>
          <input
            id="workspace-path"
            value={path}
            onChange={(event) => setPath(event.target.value)}
            placeholder="C:\\Research\\paper"
          />
          <button className="button button--primary" disabled={!path.trim() || loading} type="submit">
            {loading ? '正在打开' : '打开工作区'}
          </button>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
      </form>
    </section>
  );
}
