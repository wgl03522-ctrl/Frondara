import { useState } from 'react';
import { isDesktop, pickWorkspaceFolder } from '../../api/client.js';
import { useI18n } from '../../i18n/I18nProvider.js';
import logoUrl from '../../assets/logo.png';

interface OpenWorkspaceProps {
  loading: boolean;
  error?: string | undefined;
  onOpen(path: string): Promise<void>;
}

export function OpenWorkspace({ loading, error, onOpen }: OpenWorkspaceProps) {
  const { locale, t } = useI18n();
  const [path, setPath] = useState('');
  const desktop = isDesktop();

  async function browse() {
    const picked = await pickWorkspaceFolder(locale);
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
      <h1>{t('open.title')}</h1>
      <p>{desktop ? t('open.desktopDescription') : t('open.browserDescription')}</p>
      {desktop && (
        <button type="button" className="button button--primary" disabled={loading} onClick={() => void browse()}>
          {loading ? t('open.opening') : t('open.chooseFolder')}
        </button>
      )}
      <form
        className="open-workspace-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (path.trim()) void onOpen(path.trim());
        }}
      >
        <label htmlFor="workspace-path">{desktop ? t('open.manualPath') : t('open.folderPath')}</label>
        <div>
          <input
            id="workspace-path"
            value={path}
            onChange={(event) => setPath(event.target.value)}
            placeholder="C:\\Research\\paper"
          />
          <button className="button button--primary" disabled={!path.trim() || loading} type="submit">
            {loading ? t('open.opening') : t('open.openWorkspace')}
          </button>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
      </form>
    </section>
  );
}
