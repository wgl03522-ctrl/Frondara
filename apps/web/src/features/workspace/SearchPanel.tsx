import { useEffect, useRef, useState } from 'react';
import { api, type SearchHit } from '../../api/client.js';

interface SearchPanelProps {
  onOpenDocument(path: string): void;
  onClose(): void;
}

export function SearchPanel({ onOpenDocument, onClose }: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string>();
  const [searched, setSearched] = useState(false);

  // Debounce the query so we don't fire a scan on every keystroke.
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
          if (!cancelled) setError(caught instanceof Error ? caught.message : '搜索失败');
        })
        .finally(() => { if (!cancelled) setSearching(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query]);

  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const totalMatches = hits.reduce((sum, hit) => sum + hit.matches.length, 0);

  return (
    <aside className="file-panel search-panel" aria-label="搜索">
      <header className="panel-header file-panel-header">
        <div>
          <span className="eyebrow">工作区</span>
          <h2>搜索</h2>
        </div>
        <button type="button" className="icon-button" aria-label="关闭搜索" onClick={onClose}>×</button>
      </header>
      <div className="search-input-row">
        <input
          ref={inputRef}
          type="search"
          className="search-input"
          aria-label="搜索文档内容"
          placeholder="搜索所有文档内容…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      {error ? (
        <p className="panel-message" role="alert">{error}</p>
      ) : searching ? (
        <p className="panel-message" role="status">正在搜索…</p>
      ) : !query.trim() ? (
        <div className="panel-message">
          <strong>全文搜索</strong>
          <p>输入关键字，搜索工作区内所有 Markdown 文档。</p>
        </div>
      ) : searched && hits.length === 0 ? (
        <p className="panel-message">没有匹配「{query.trim()}」的内容。</p>
      ) : (
        <div className="search-results" aria-label="搜索结果">
          <p className="search-summary">{hits.length} 个文档 · {totalMatches} 处匹配</p>
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
