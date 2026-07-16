import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { DocumentStore } from '../src/index.js';

it('saves markdown atomically and returns a content version', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pnode-doc-'));
  const store = new DocumentStore(root);
  const result = await store.save('Paper/main.md', '# Title\n');
  expect(await readFile(join(root, 'Paper/main.md'), 'utf8')).toBe('# Title\n');
  expect(result.versionId).toMatch(/^[a-f0-9]{64}$/);
});

it('reports a missing document as DOCUMENT_NOT_FOUND, not a raw ENOENT', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pnode-doc-'));
  const store = new DocumentStore(root);
  await expect(store.read('gone.md')).rejects.toThrow('DOCUMENT_NOT_FOUND');
});

it('detects disk version conflicts', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pnode-doc-'));
  const store = new DocumentStore(root);
  const first = await store.save('main.md', 'one');
  await writeFile(join(root, 'main.md'), 'external', 'utf8');
  await expect(store.save('main.md', 'two', first.versionId)).rejects.toThrow('VERSION_CONFLICT');
});

it('creates documents without overwriting and excludes .pnode from listings', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pnode-doc-'));
  const store = new DocumentStore(root);
  await store.create('Notes/idea.md', '# Idea\n');
  await expect(store.create('Notes/idea.md', 'duplicate')).rejects.toThrow('DOCUMENT_EXISTS');
  await store.save('.pnode/hidden.md', 'hidden');
  expect(await store.list()).toEqual([
    { type: 'folder', path: 'Notes', name: 'Notes' },
    { type: 'file', path: 'Notes/idea.md', name: 'idea.md' }
  ]);
});
