import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import type { TextAnchor } from '@pnode/core';
import { DiscussionStore } from '../src/index.js';

const anchor: TextAnchor = {
  documentPath: 'Paper/main.md', quote: '原文', prefix: '', suffix: '',
  headingPath: [], documentVersionId: 'v1'
};

it('activates the same draft discussion and sends its first message', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pnode-discussion-'));
  const store = new DiscussionStore(root);
  const draft = await store.createDraft(anchor, '稍后询问 AI');
  const active = await store.activateDraft(draft.id);
  expect(active.id).toBe(draft.id);
  expect(active.status).toBe('active');
  expect(active.messages[0]?.delivery).toBe('sent');
  expect(await store.list()).toHaveLength(1);
});

it('updates draft content in place before activation', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pnode-discussion-'));
  const store = new DiscussionStore(root);
  const draft = await store.createDraft(anchor, '原批注');
  const originalMessage = draft.messages[0]!;

  const updated = await store.updateDraft(draft.id, '修改后的批注');
  const active = await store.activateDraft(draft.id);

  expect(updated.id).toBe(draft.id);
  expect(updated.messages[0]?.id).toBe(originalMessage.id);
  expect(updated.messages[0]?.createdAt).toBe(originalMessage.createdAt);
  expect(active.messages[0]?.content).toBe('修改后的批注');
  expect(await store.list()).toHaveLength(1);
});

it('updates draft content in place before activation', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pnode-discussion-'));
  const store = new DiscussionStore(root);
  const draft = await store.createDraft(anchor, '原批注');
  const originalMessage = draft.messages[0]!;

  const updated = await store.updateDraft(draft.id, '修改后的批注');
  const active = await store.activateDraft(draft.id);

  expect(updated.id).toBe(draft.id);
  expect(updated.messages[0]?.id).toBe(originalMessage.id);
  expect(updated.messages[0]?.createdAt).toBe(originalMessage.createdAt);
  expect(active.messages[0]?.content).toBe('修改后的批注');
  expect(await store.list()).toHaveLength(1);
});

it('does not overwrite corrupt discussion metadata', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pnode-discussion-'));
  const path = join(root, '.pnode', 'discussions');
  await import('node:fs/promises').then(({ mkdir }) => mkdir(path, { recursive: true }));
  await writeFile(join(path, 'index.json'), '{broken', 'utf8');
  const store = new DiscussionStore(root);
  await expect(store.list()).rejects.toThrow('METADATA_INVALID');
  await expect(store.createDraft(anchor, 'x')).rejects.toThrow('METADATA_INVALID');
});
