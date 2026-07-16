import type { DiscussionStore, DocumentStore } from '@pnode/storage';
import type { Discussion } from '@pnode/core';
import type { AiContext, AiTurn } from './ai-provider.js';

// What the client asks to be included as context for one AI call. The three
// defaults (document / paragraph / history) are opt-out; the two arrays are
// opt-in. All fields have safe defaults at the schema layer so an omitted spec
// behaves like "selected paragraph + this discussion's history".
export interface ContextSpec {
  includeDocument: boolean;
  includeParagraph: boolean;
  includeHistory: boolean;
  filePaths: string[];
  discussionIds: string[];
}

export interface ResolvedContext {
  contexts: AiContext[];
  history: AiTurn[];
}

export const DEFAULT_CONTEXT_SPEC: ContextSpec = {
  includeDocument: true,
  includeParagraph: true,
  includeHistory: true,
  filePaths: [],
  discussionIds: []
};

interface ContextStores {
  documents: Pick<DocumentStore, 'read'>;
  discussions: Pick<DiscussionStore, 'get'>;
}

// Turn a discussion's messages into readable "问/答" text for use as a context
// block (when it is referenced as *another* discussion), distinct from history
// turns which are expanded into real chat messages.
function formatDiscussionTranscript(discussion: Discussion): string {
  return discussion.messages
    .map((message) => `${message.role === 'user' ? '问' : '答'}：${message.content}`)
    .join('\n');
}

// Resolve a ContextSpec against the workspace into concrete reference blocks and
// conversational history. Anything that fails to load (a deleted file, a missing
// discussion) is skipped rather than failing the whole request — a stale context
// selection must never block the user from asking their question.
export async function resolveContexts(
  spec: ContextSpec,
  discussion: Discussion,
  stores: ContextStores
): Promise<ResolvedContext> {
  const contexts: AiContext[] = [];

  if (spec.includeDocument) {
    try {
      const document = await stores.documents.read(discussion.anchor.documentPath);
      contexts.push({ label: '整篇文档', content: document.content });
    } catch {
      // Document gone or unreadable — skip.
    }
  }

  if (spec.includeParagraph) {
    contexts.push({ label: '选定段落', content: discussion.anchor.quote });
  }

  for (const path of spec.filePaths) {
    try {
      const file = await stores.documents.read(path);
      contexts.push({ label: `文件：${path}`, content: file.content });
    } catch {
      // Skip unreadable/out-of-workspace paths.
    }
  }

  for (const id of spec.discussionIds) {
    try {
      const referenced = await stores.discussions.get(id);
      contexts.push({
        label: `讨论：${referenced.title}`,
        content: formatDiscussionTranscript(referenced)
      });
    } catch {
      // Skip missing discussions.
    }
  }

  const history: AiTurn[] = spec.includeHistory
    ? discussion.messages.map((message) => ({
        role: message.role,
        content: message.content
      }))
    : [];

  return { contexts, history };
}
