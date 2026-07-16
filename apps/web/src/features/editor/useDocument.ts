import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, type DocumentRecord } from '../../api/client.js';

export type DocumentSaveState = 'idle' | 'saving' | 'saved' | 'conflict' | 'error';

export function useDocument(documentPath: string | undefined) {
  const [document, setDocument] = useState<DocumentRecord | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [saveState, setSaveState] = useState<DocumentSaveState>('idle');
  const [currentVersionId, setCurrentVersionId] = useState<string | undefined>(undefined);
  const versionRef = useRef<string | undefined>(undefined);

  const load = useCallback(async () => {
    if (!documentPath) {
      setDocument(undefined);
      setLoading(false);
      setError(undefined);
      setSaveState('idle');
      versionRef.current = undefined;
      setCurrentVersionId(undefined);
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      const next = await api.readDocument(documentPath);
      versionRef.current = next.versionId;
      setCurrentVersionId(next.versionId);
      setDocument(next);
      setSaveState('idle');
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : '无法读取文档');
    } finally {
      setLoading(false);
    }
  }, [documentPath]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(async (content: string) => {
    if (!documentPath || !versionRef.current || saveState === 'conflict') return;
    setSaveState('saving');
    try {
      const saved = await api.saveDocument(documentPath, content, versionRef.current);
      versionRef.current = saved.versionId;
      setCurrentVersionId(saved.versionId);
      setSaveState('saved');
    } catch (caught: unknown) {
      if (caught instanceof ApiError && caught.status === 409) {
        setSaveState('conflict');
        return;
      }
      setSaveState('error');
      setError(caught instanceof Error ? caught.message : '保存失败');
    }
  }, [documentPath, saveState]);

  return { document, currentVersionId, loading, error, saveState, save, reload: load };
}
