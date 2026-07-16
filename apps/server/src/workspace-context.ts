import { resolve } from 'node:path';
import { stat } from 'node:fs/promises';
import {
  DiscussionStore,
  DocumentStore,
  SuggestionStore,
  VersionStore,
  WorkspaceStore
} from '@pnode/storage';

export interface WorkspaceServices {
  root: string;
  documents: DocumentStore;
  discussions: DiscussionStore;
  suggestions: SuggestionStore;
  versions: VersionStore;
  workspace: WorkspaceStore;
}

export class WorkspaceContext {
  #services?: WorkspaceServices;

  async open(root: string): Promise<WorkspaceServices> {
    const resolved = resolve(root);
    const info = await stat(resolved);
    if (!info.isDirectory()) throw new Error('WORKSPACE_NOT_DIRECTORY');
    const documents = new DocumentStore(resolved);
    this.#services = {
      root: resolved,
      documents,
      discussions: new DiscussionStore(resolved),
      suggestions: new SuggestionStore(resolved),
      versions: new VersionStore(resolved, documents),
      workspace: new WorkspaceStore(resolved)
    };
    return this.#services;
  }

  current(): WorkspaceServices | undefined {
    return this.#services;
  }

  require(): WorkspaceServices {
    if (!this.#services) throw new Error('WORKSPACE_NOT_OPEN');
    return this.#services;
  }
}
