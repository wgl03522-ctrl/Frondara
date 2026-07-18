import { useEffect, useRef, useState } from 'react';
import { api, type SearchHit } from '../../api/client.js';
import { useI18n } from '../../i18n/I18nProvider.js';

interface SearchPanelProps {
  onOpenDocument(path: string): void;
  onClose(): void;
}

export function SearchPanel({ onOpenDocument, onClose }: SearchPanelProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string>();
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setHits([]);
      setSearched(false);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      setSearching(true);
      setError(undefined);
      api.searchDocuments(trimmed)
        .then((results) => { if (!cancelled) { setHits(results); setSearched(true); } })
        .catch((caught: unknown) => {
          if (!cancelled) setError(caught instanceof Error ? caught.message : t('search.failed'));
        })
        .finally(() => { if (!cancelled) setSearching(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query]);

  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const totalMatches = hits.reduce((sum, hit) => sum + hit.matches.length, 0);

  return (
    <aside className="file-panel search-panel" aria-label={t('search.title')}>
      <header className="panel-header file-panel-header">
        <div>
          <span className="eyebrow">{t('common.workspace')}</span>
          <h2>{t('search.title')}</h2>
        </div>
        <button type="button" className="icon-button" aria-label={t('search.close')} onClick={onClose}>×</button>
      </header>
      <div className="search-input-row">
        <input
          ref={inputRef}
          type="search"
          className="search-input"
          aria-label={t('search.aria')}
          placeholder={t('search.placeholder')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      {error ? (
        <p className="panel-message" role="alert">{error}</p>
      ) : searching ? (
        <p className="panel-message" role="status">{t('search.searching')}</p>
      ) : !query.trim() ? (
        <div className="panel-message">
          <strong>{t('search.fullText')}</strong>
          <p>{t('search.description')}</p>
        </div>
      ) : searched && hits.length === 0 ? (
        <p className="panel-message">{t('search.noResults', { query: query.trim() })}</p>
      ) : (
        <div className="search-results" aria-label={t('search.results')}>
          <p className="search-summary">{t('search.summary', { documents: hits.length, matches: totalMatches })}</p>
          {hits.map((hit) => (
            <div className="search-hit" key={hit.path}>
              <button type="button" className="search-hit-file" onClick={() => onOpenDocument(hit.path)}>
                {hit.name}
                <span className="search-hit-path">{hit.path}</span>
              </button>
              <ul className="search-hit-lines">
                {hit.matches.map((match) => (
                  <li key={match.line}>
                    <button type="button" onClick={() => onOpenDocument(hit.path)}>
                      <span className="search-line-no">L{match.line}</span>
                      <span className="search-line-text">{match.text}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
