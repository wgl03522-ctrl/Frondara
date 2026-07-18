import type { Discussion, PublicAiSettings, TextAnchor, UiState, Version } from '@pnode/core';
import type { Locale } from '../i18n/messages.js';

export interface DocumentEntry {
  type: 'file' | 'folder';
  path: string;
  name: string;
}

export interface DocumentRecord {
  path: string;
  content: string;
  versionId: string;
}

export interface SavedDocument {
  path: string;
  versionId: string;
}

export interface SearchLineMatch {
  line: number;
  text: string;
}

export interface SearchHit {
  path: string;
  name: string;
  matches: SearchLineMatch[];
}

// Which materials the client wants included as context for one AI call. The
// three defaults are opt-out; the two arrays are opt-in. Mirrors the server's
// ContextSpec — omitted fields degrade to "selected paragraph + history".
export interface ContextSpec {
  includeDocument: boolean;
  includeParagraph: boolean;
  includeHistory: boolean;
  filePaths: string[];
  discussionIds: string[];
}

export interface WorkspaceStatus {
  open: boolean;
  root?: string | undefined;
}

export interface AiSettingsUpdatePayload {
  mode: 'demo' | 'compatible';
  baseUrl: string;
  model: string;
  apiKey?: string;
  clearApiKey?: boolean;
}

export interface AiConnectionTestPayload {
  baseUrl: string;
  model: string;
  apiKey?: string;
}

export interface AiConnectionTestResult {
  ok: boolean;
  model: string;
  latencyMs: number;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
  }
}

// In the Electron shell the preload exposes window.pnode, and every API call is
// bridged to the in-process Fastify app over IPC — no network. In a browser
// (dev server / tests) the bridge is absent and we fall back to fetch, which
// Vite proxies to the local server. Both paths share the same success/error
// contract so the rest of the client is agnostic.
interface PnodeBridge {
  invoke(payload: {
    method: string;
    url: string;
    body?: unknown;
    headers?: Record<string, string>;
  }): Promise<{ status: number; body: string; contentType: string }>;
  pickFolder(locale: Locale): Promise<string | null>;
}

function bridge(): PnodeBridge | undefined {
  return (globalThis as { pnode?: PnodeBridge }).pnode;
}

function fail(status: number, body: string): never {
  const parsed = (() => {
    try {
      return JSON.parse(body) as { code?: string; message?: string };
    } catch {
      return {};
    }
  })();
  throw new ApiError(status, parsed.code ?? 'REQUEST_FAILED', parsed.message ?? `HTTP ${status}`);
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const pnode = bridge();
  if (pnode) {
    const method = init?.method ?? 'GET';
    const body = init?.body === undefined ? undefined : JSON.parse(init.body as string);
    const response = await pnode.invoke({ method, url, body });
    if (response.status < 200 || response.status >= 300) fail(response.status, response.body);
    return (response.body ? JSON.parse(response.body) : undefined) as T;
  }
  const response = await fetch(url, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...init?.headers
    }
  });
  if (!response.ok) {
    const body = await response.text();
    fail(response.status, body);
  }
  return response.json() as Promise<T>;
}

// Whether the app is running inside the Electron shell (native folder picker etc.
// are available). Components use this to conditionally surface desktop-only UI.
export function isDesktop(): boolean {
  return bridge() !== undefined;
}

// Native folder picker (Electron only). Returns an absolute path or null when
// the user cancels. Throws if called outside the desktop shell.
export function pickWorkspaceFolder(locale: Locale): Promise<string | null> {
  const pnode = bridge();
  if (!pnode) throw new Error('NOT_DESKTOP');
  return pnode.pickFolder(locale);
}

export const api = {
  readWorkspace: () => request<WorkspaceStatus>('/api/workspace'),
  openWorkspace: (path: string) => request<{ root: string }>('/api/workspace/open', {
    method: 'POST',
    body: JSON.stringify({ path })
  }),
  listDocuments: () => request<DocumentEntry[]>('/api/documents'),
  readDocument: (path: string) => request<DocumentRecord>(`/api/documents/${encodeURIComponent(path)}`),
  createDocument: (path: string, content: string) => request<SavedDocument>('/api/documents', {
    method: 'POST',
    body: JSON.stringify({ path, content })
  }),
  saveDocument: (path: string, content: string, expectedVersionId: string) =>
    request<SavedDocument>(`/api/documents/${encodeURIComponent(path)}`, {
      method: 'PUT',
      body: JSON.stringify({ content, expectedVersionId })
    }),
  readUiState: () => request<UiState>('/api/workspace/state'),
  saveUiState: (state: UiState) => request<UiState>('/api/workspace/state', {
    method: 'PUT',
    body: JSON.stringify(state)
  }),
  listDiscussions: (documentPath: string) =>
    request<Discussion[]>(`/api/discussions?documentPath=${encodeURIComponent(documentPath)}`),
  createDraftDiscussion: (anchor: TextAnchor, content: string) =>
    request<Discussion>('/api/discussions/draft', {
      method: 'POST',
      body: JSON.stringify({ anchor, content })
    }),
  createDiscussion: (anchor: TextAnchor, content: string, contextSpec?: ContextSpec) =>
    request<{ discussion: Discussion }>('/api/discussions', {
      method: 'POST',
      body: JSON.stringify({ anchor, content, ...(contextSpec ? { contextSpec } : {}) })
    }),
  activateDiscussion: (id: string, content: string, contextSpec?: ContextSpec) =>
    request<{ discussion: Discussion }>(`/api/discussions/${encodeURIComponent(id)}/activate`, {
      method: 'POST',
      body: JSON.stringify({ content, ...(contextSpec ? { contextSpec } : {}) })
    }),
  addDiscussionMessage: (
    id: string,
    content: string,
    quote: string,
    contextSpec: ContextSpec
  ) => request<{ discussion: Discussion }>(`/api/discussions/${encodeURIComponent(id)}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content, quote, contextSpec })
  }),
  forkDiscussion: (id: string, messageId: string, question: string, title?: string) =>
    request<{ discussion: Discussion }>(`/api/discussions/${encodeURIComponent(id)}/fork`, {
      method: 'POST',
      body: JSON.stringify({ messageId, question, ...(title ? { title } : {}) })
    }),
  renameDiscussion: (id: string, title: string) =>
    request<Discussion>(`/api/discussions/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ title })
    }),
  listVersions: (documentPath: string) =>
    request<Version[]>(`/api/versions?documentPath=${encodeURIComponent(documentPath)}`),
  readVersionDiff: (id: string) =>
    request<{ previous: string; current: string }>(`/api/versions/${encodeURIComponent(id)}/diff`),
  restoreVersion: (id: string, documentPath: string) =>
    request<{ recoveryVersion: Version; restoredVersion: Version }>(
      `/api/versions/${encodeURIComponent(id)}/restore`,
      { method: 'POST', body: JSON.stringify({ documentPath }) }
    ),
  searchDocuments: (query: string) =>
    request<SearchHit[]>(`/api/search?q=${encodeURIComponent(query)}`),
  readAiSettings: () => request<PublicAiSettings>('/api/ai/settings'),
  saveAiSettings: (payload: AiSettingsUpdatePayload) =>
    request<PublicAiSettings>('/api/ai/settings', {
      method: 'PUT',
      body: JSON.stringify(payload)
    }),
  testAiSettings: (payload: AiConnectionTestPayload) =>
    request<AiConnectionTestResult>('/api/ai/settings/test', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
};
