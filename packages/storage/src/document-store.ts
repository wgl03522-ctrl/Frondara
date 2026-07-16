import { createHash } from 'node:crypto';
import { mkdir, open, readFile, readdir } from 'node:fs/promises';
import { dirname, relative } from 'node:path';
import { writeAtomic } from './atomic-file.js';
import { resolveWorkspacePath, toWorkspacePath } from './paths.js';

export interface DocumentEntry {
  type: 'file' | 'folder';
  path: string;
  name: string;
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

export class DocumentStore {
  constructor(readonly root: string) {}

  async read(path: string): Promise<{ path: string; content: string; versionId: string }> {
    let content: string;
    try {
      content = await readFile(resolveWorkspacePath(this.root, path), 'utf8');
    } catch (error: unknown) {
      // Translate a missing file into a domain error so the API returns 404
      // instead of a raw 500 that leaks the absolute filesystem path. A stale
      // UI pointer to a renamed/deleted document is a normal, recoverable case.
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error('DOCUMENT_NOT_FOUND', { cause: error });
      }
      throw error;
    }
    return { path, content, versionId: hashContent(content) };
  }

  async save(path: string, content: string, expectedVersionId?: string): Promise<{ path: string; versionId: string }> {
    if (expectedVersionId !== undefined) {
      const current = await this.read(path);
      if (current.versionId !== expectedVersionId) throw new Error('VERSION_CONFLICT');
    }
    await writeAtomic(resolveWorkspacePath(this.root, path), content);
    return { path, versionId: hashContent(content) };
  }

  async create(path: string, content: string): Promise<{ path: string; versionId: string }> {
    const target = resolveWorkspacePath(this.root, path);
    await mkdir(dirname(target), { recursive: true });
    try {
      const handle = await open(target, 'wx');
      try {
        await handle.writeFile(content, 'utf8');
      } finally {
        await handle.close();
      }
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        throw new Error('DOCUMENT_EXISTS', { cause: error });
      }
      throw error;
    }
    return { path, versionId: hashContent(content) };
  }

  // Plain substring search across every Markdown file, returning per-file line
  // matches with a little surrounding context. Case-insensitive. This is a simple
  // linear scan — fine for a local research workspace, no index needed.
  async search(query: string, limitPerFile = 5): Promise<SearchHit[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];
    const needle = trimmed.toLowerCase();
    const files = (await this.list()).filter((entry) => entry.type === 'file');
    const hits: SearchHit[] = [];
    for (const file of files) {
      let content: string;
      try {
        content = await readFile(resolveWorkspacePath(this.root, file.path), 'utf8');
      } catch {
        continue;
      }
      const lines = content.split('\n');
      const matches: SearchLineMatch[] = [];
      for (let index = 0; index < lines.length && matches.length < limitPerFile; index += 1) {
        const line = lines[index]!;
        if (line.toLowerCase().includes(needle)) {
          matches.push({ line: index + 1, text: line.trim().slice(0, 200) });
        }
      }
      if (matches.length > 0) {
        hits.push({ path: file.path, name: file.name, matches });
      }
    }
    return hits;
  }

  async list(): Promise<DocumentEntry[]> {
    const entries: DocumentEntry[] = [];
    const visit = async (directory: string): Promise<void> => {
      const children = await readdir(directory, { withFileTypes: true });
      children.sort((left, right) => left.name.localeCompare(right.name));
      for (const child of children) {
        if (child.name === '.pnode' || child.name.endsWith('.tmp') || child.isSymbolicLink()) continue;
        const absolute = resolveWorkspacePath(this.root, toWorkspacePath(relative(this.root, `${directory}/${child.name}`)));
        const path = toWorkspacePath(relative(this.root, absolute));
        if (child.isDirectory()) {
          entries.push({ type: 'folder', path, name: child.name });
          await visit(absolute);
        } else if (child.isFile() && child.name.toLowerCase().endsWith('.md')) {
          entries.push({ type: 'file', path, name: child.name });
        }
      }
    };
    await visit(this.root);
    return entries;
  }
}

export function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}
