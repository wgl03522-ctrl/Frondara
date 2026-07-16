import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { DocumentStore, VersionStore } from '../src/index.js';

it('creates a recovery snapshot before restoring an old version', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pnode-version-'));
  const documents = new DocumentStore(root);
  const versions = new VersionStore(root, documents);
  await documents.save('Paper/main.md', 'old');
  const oldVersion = await versions.snapshot('Paper/main.md', 'old', 'manual');
  await documents.save('Paper/main.md', 'current');
  const restored = await versions.restore('Paper/main.md', oldVersion.id);
  expect(restored.recoveryVersion.reason).toBe('pre-restore');
  expect((await documents.read('Paper/main.md')).content).toBe('old');
});

it('lists document versions newest first', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pnode-version-'));
  const documents = new DocumentStore(root);
  const versions = new VersionStore(root, documents);
  await versions.snapshot('a.md', 'one', 'manual');
  await versions.snapshot('a.md', 'two', 'autosave');
  expect((await versions.list('a.md')).map((item) => item.reason)).toEqual(['autosave', 'manual']);
});
