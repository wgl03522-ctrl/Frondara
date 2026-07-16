import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { TextAnchor } from '@pnode/core';
import { DiscussionStore, DocumentStore, VersionStore } from '@pnode/storage';
import {
  docsList,
  docsShow,
  discussionsList,
  discussionsShow,
  discussionsTree,
  discussionsFork,
  versionsList,
  versionsRestore
} from '../src/commands.js';

const anchor: TextAnchor = {
  documentPath: 'Paper/main.md', quote: '原文', prefix: '', suffix: '',
  headingPath: ['结论'], documentVersionId: 'v1'
};

async function workspace(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'pnode-cli-'));
  await mkdir(join(root, 'Paper'), { recursive: true });
  await writeFile(join(root, 'Paper', 'main.md'), '# 标题\n\n原文段落', 'utf8');
  return root;
}

describe('docs commands (read)', () => {
  it('lists markdown documents relative to the workspace', async () => {
    const root = await workspace();
    const output = await docsList(root);
    expect(output).toContain('Paper/main.md');
  });

  it('prints a document body', async () => {
    const root = await workspace();
    const output = await docsShow(root, 'Paper/main.md');
    expect(output).toContain('原文段落');
  });
});

describe('discussions commands (read + non-AI writes)', () => {
  it('lists discussions with id, status and title', async () => {
    const root = await workspace();
    await new DiscussionStore(root).createDraft(anchor, '这里表达是否过强');
    const output = await discussionsList(root);
    expect(output).toContain('draft');
    expect(output).toContain('这里表达是否过强');
  });

  it('shows a discussion with its messages', async () => {
    const root = await workspace();
    const draft = await new DiscussionStore(root).createDraft(anchor, '第一条消息');
    const output = await discussionsShow(root, draft.id);
    expect(output).toContain(draft.id);
    expect(output).toContain('第一条消息');
  });

  it('renders discussion relationships as an indented tree', async () => {
    const root = await workspace();
    const store = new DiscussionStore(root);
    const parent = await store.createActive(anchor, '原讨论');
    const messageId = parent.messages[0]!.id;
    await store.forkFromMessage(parent.id, messageId, '另行讨论：任务熟悉度');

    const output = await discussionsTree(root);
    expect(output).toContain('原讨论');
    // The fork is nested (indented) under its parent.
    expect(output).toMatch(/原讨论[\s\S]*\n\s+.*另行讨论：任务熟悉度/);
  });

  it('forks a new discussion direction without invoking AI', async () => {
    const root = await workspace();
    const store = new DiscussionStore(root);
    const parent = await store.createActive(anchor, '原讨论');
    const messageId = parent.messages[0]!.id;

    const output = await discussionsFork(root, parent.id, messageId, '任务熟悉度');
    expect(output).toContain('任务熟悉度');
    const all = await store.list();
    expect(all.some((item) => item.parentDiscussionId === parent.id && item.forkedFromMessageId === messageId)).toBe(true);
  });
});

describe('versions commands (read + non-AI write)', () => {
  it('lists versions newest first', async () => {
    const root = await workspace();
    const documents = new DocumentStore(root);
    const versions = new VersionStore(root, documents);
    await versions.snapshot('Paper/main.md', 'v1 内容', 'manual');
    await versions.snapshot('Paper/main.md', 'v2 内容', 'autosave');
    const output = await versionsList(root, 'Paper/main.md');
    const firstReason = output.indexOf('autosave');
    const secondReason = output.indexOf('manual');
    expect(firstReason).toBeGreaterThanOrEqual(0);
    expect(firstReason).toBeLessThan(secondReason);
  });

  it('restores an old version and reports the recovery snapshot', async () => {
    const root = await workspace();
    const documents = new DocumentStore(root);
    const versions = new VersionStore(root, documents);
    await documents.save('Paper/main.md', '旧内容');
    const old = await versions.snapshot('Paper/main.md', '旧内容', 'manual');
    await documents.save('Paper/main.md', '新内容');

    const output = await versionsRestore(root, 'Paper/main.md', old.id);
    expect(output).toContain('已恢复');
    expect((await documents.read('Paper/main.md')).content).toBe('旧内容');
  });
});
