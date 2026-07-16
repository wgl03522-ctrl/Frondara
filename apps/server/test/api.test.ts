import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import type { AiProvider } from '../src/services/ai-provider.js';

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'pnode-api-'));
  await mkdir(join(root, 'Paper'), { recursive: true });
  await writeFile(join(root, 'Paper', 'main.md'), '# Title\n\n原文', 'utf8');
  return root;
}

const anchor = {
  documentPath: 'Paper/main.md', quote: '原文', prefix: '', suffix: '',
  headingPath: ['Title'], documentVersionId: 'v1'
};

describe('local API', () => {
  it('reads and saves workspace-relative markdown documents', async () => {
    const app = await buildApp({ initialWorkspace: await fixture() });
    const read = await app.inject({ method: 'GET', url: '/api/documents/Paper%2Fmain.md' });
    expect(read.statusCode).toBe(200);
    const saved = await app.inject({
      method: 'PUT', url: '/api/documents/Paper%2Fmain.md',
      payload: { content: '# Changed\n', expectedVersionId: read.json().versionId }
    });
    expect(saved.statusCode).toBe(200);
    await app.close();
  });

  it('rejects encoded traversal outside the workspace', async () => {
    const app = await buildApp({ initialWorkspace: await fixture() });
    const response = await app.inject({ method: 'GET', url: '/api/documents/..%2Fsecret.md' });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('creates a draft note without invoking AI', async () => {
    const complete = vi.fn<AiProvider['complete']>();
    const app = await buildApp({ initialWorkspace: await fixture(), aiProvider: { complete } });
    const response = await app.inject({
      method: 'POST', url: '/api/discussions/draft', payload: { anchor, content: '稍后讨论' }
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().status).toBe('draft');
    expect(complete).not.toHaveBeenCalled();
    await app.close();
  });

  it('updates and activates the same draft only when explicitly sent', async () => {
    const complete = vi.fn<AiProvider['complete']>().mockResolvedValue({ answer: '已检查' });
    const app = await buildApp({ initialWorkspace: await fixture(), aiProvider: { complete } });
    const created = await app.inject({
      method: 'POST', url: '/api/discussions/draft', payload: { anchor, content: '原批注' }
    });
    const draft = created.json();
    const activated = await app.inject({
      method: 'POST',
      url: `/api/discussions/${draft.id}/activate`,
      payload: { content: '修改后的批注' }
    });
    const active = activated.json().discussion;

    expect(activated.statusCode).toBe(200);
    expect(active.id).toBe(draft.id);
    expect(active.messages[0].id).toBe(draft.messages[0].id);
    expect(active.messages[0].createdAt).toBe(draft.messages[0].createdAt);
    expect(active.messages[0].content).toBe('修改后的批注');
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({ question: '修改后的批注' }));
    expect(await app.inject({ method: 'GET', url: '/api/discussions' }).then((response) => response.json())).toHaveLength(1);
    await app.close();
  });

  it('resolves the default contextSpec into document + paragraph contexts', async () => {
    const complete = vi.fn<AiProvider['complete']>()
      .mockResolvedValueOnce({ answer: '初次回答' })
      .mockResolvedValueOnce({ answer: '继续回答' });
    const app = await buildApp({ initialWorkspace: await fixture(), aiProvider: { complete } });
    const created = await app.inject({
      method: 'POST', url: '/api/discussions', payload: { anchor, content: '初次问题' }
    });
    const discussion = created.json().discussion;
    // No contextSpec sent → schema default (document + paragraph + history).
    const response = await app.inject({
      method: 'POST',
      url: `/api/discussions/${discussion.id}/messages`,
      payload: { content: '继续分析', quote: anchor.quote }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().discussion.messages).toHaveLength(4);
    const lastCall = complete.mock.calls.at(-1)![0];
    expect(lastCall.question).toBe('继续分析');
    expect(lastCall.contexts.map((c) => c.label)).toEqual(['整篇文档', '选定段落']);
    await app.close();
  });

  it('honours contextSpec toggles: opting the document off drops that block', async () => {
    const complete = vi.fn<AiProvider['complete']>()
      .mockResolvedValueOnce({ answer: '初次回答' })
      .mockResolvedValueOnce({ answer: '继续回答' });
    const app = await buildApp({ initialWorkspace: await fixture(), aiProvider: { complete } });
    const created = await app.inject({
      method: 'POST', url: '/api/discussions', payload: { anchor, content: '初次问题' }
    });
    const discussion = created.json().discussion;
    const response = await app.inject({
      method: 'POST',
      url: `/api/discussions/${discussion.id}/messages`,
      payload: {
        content: '继续分析',
        quote: anchor.quote,
        contextSpec: { includeDocument: false }
      }
    });

    expect(response.statusCode).toBe(200);
    const lastCall = complete.mock.calls.at(-1)![0];
    // Document off, paragraph still on by default.
    expect(lastCall.contexts.map((c) => c.label)).toEqual(['选定段落']);
    await app.close();
  });

  it('resolves contexts on the very first question (POST /api/discussions)', async () => {
    const complete = vi.fn<AiProvider['complete']>().mockResolvedValue({ answer: '初次回答' });
    const app = await buildApp({ initialWorkspace: await fixture(), aiProvider: { complete } });
    await app.inject({
      method: 'POST', url: '/api/discussions',
      payload: { anchor, content: '初次问题', contextSpec: { includeDocument: true } }
    });
    // The create call is the first (and only) AI call — assert IT got context,
    // not a later follow-up. Guards against the first question reaching the AI
    // context-blind. History is forced off (the question is the lone message).
    const firstCall = complete.mock.calls[0]![0];
    expect(firstCall.question).toBe('初次问题');
    expect(firstCall.contexts.map((c) => c.label)).toEqual(['整篇文档', '选定段落']);
    expect(firstCall.history ?? []).toHaveLength(0);
    await app.close();
  });

  it('gives a fork its own document + paragraph context on the first answer', async () => {
    const complete = vi.fn<AiProvider['complete']>()
      .mockResolvedValueOnce({ answer: '初次回答' })
      .mockResolvedValueOnce({ answer: '分支回答' });
    const app = await buildApp({ initialWorkspace: await fixture(), aiProvider: { complete } });
    const created = await app.inject({
      method: 'POST', url: '/api/discussions', payload: { anchor, content: '初次问题' }
    });
    const source = created.json().discussion;
    await app.inject({
      method: 'POST', url: `/api/discussions/${source.id}/fork`,
      payload: { messageId: source.messages[0].id, question: '换个角度问' }
    });
    const forkCall = complete.mock.calls.at(-1)![0];
    expect(forkCall.question).toBe('换个角度问');
    expect(forkCall.contexts.map((c) => c.label)).toEqual(['整篇文档', '选定段落']);
    await app.close();
  });

  it('persists UI state in the active workspace', async () => {
    const app = await buildApp({ initialWorkspace: await fixture() });
    const updated = await app.inject({
      method: 'PUT', url: '/api/workspace/state',
      payload: { filePanelWidth: 260, filePanelPinned: true, discussionWidth: 400, discussionOpen: false, theme: 'dark', readingFont: 'serif' }
    });
    expect(updated.statusCode).toBe(200);
    const read = await app.inject({ method: 'GET', url: '/api/workspace/state' });
    expect(read.json()).toMatchObject({ filePanelWidth: 260, theme: 'dark' });
    await app.close();
  });

  it('forks a new discussion direction with a first question, sharing the anchor', async () => {
    const complete = vi.fn<AiProvider['complete']>()
      .mockResolvedValueOnce({ answer: '初次回答' })
      .mockResolvedValueOnce({ answer: '分支回答' });
    const app = await buildApp({ initialWorkspace: await fixture(), aiProvider: { complete } });
    const created = await app.inject({
      method: 'POST', url: '/api/discussions', payload: { anchor, content: '初次问题' }
    });
    const source = created.json().discussion;
    const sourceMessageId = source.messages[0].id;

    const forked = await app.inject({
      method: 'POST',
      url: `/api/discussions/${source.id}/fork`,
      payload: { messageId: sourceMessageId, question: '任务熟悉度会不会是混杂因素？' }
    });

    expect(forked.statusCode).toBe(201);
    const { discussion: fork, ai } = forked.json();
    expect(fork.parentDiscussionId).toBe(source.id);
    expect(fork.forkedFromMessageId).toBe(sourceMessageId);
    expect(fork.anchor).toEqual(source.anchor);
    // The branch opens with the first question and its AI answer already in place.
    expect(fork.messages).toHaveLength(2);
    expect(fork.messages[0]).toMatchObject({ role: 'user', content: '任务熟悉度会不会是混杂因素？' });
    expect(fork.messages[1]).toMatchObject({ role: 'assistant', content: '分支回答' });
    expect(ai.answer).toBe('分支回答');
    // Naming is optional: with no title, the branch is named after the first question.
    expect(fork.title).toBe('任务熟悉度会不会是混杂因素？');
    const list = await app.inject({ method: 'GET', url: '/api/discussions' }).then((response) => response.json());
    expect(list).toHaveLength(2);
    await app.close();
  });

  it('renames a discussion via PATCH', async () => {
    const complete = vi.fn<AiProvider['complete']>().mockResolvedValue({ answer: '回答' });
    const app = await buildApp({ initialWorkspace: await fixture(), aiProvider: { complete } });
    const created = await app.inject({
      method: 'POST', url: '/api/discussions', payload: { anchor, content: '初次问题' }
    });
    const source = created.json().discussion;

    const renamed = await app.inject({
      method: 'PATCH', url: `/api/discussions/${source.id}`, payload: { title: '新的名字' }
    });

    expect(renamed.statusCode).toBe(200);
    expect(renamed.json().title).toBe('新的名字');
    await app.close();
  });

  it('passes prior turns as history when following up, giving the model memory', async () => {
    const complete = vi.fn<AiProvider['complete']>()
      .mockResolvedValueOnce({ answer: '第一轮回答' })
      .mockResolvedValueOnce({ answer: '第二轮回答' });
    const app = await buildApp({ initialWorkspace: await fixture(), aiProvider: { complete } });
    const created = await app.inject({
      method: 'POST', url: '/api/discussions', payload: { anchor, content: '第一个问题' }
    });
    const source = created.json().discussion;

    const followUp = await app.inject({
      method: 'POST', url: `/api/discussions/${source.id}/messages`,
      payload: { content: '第二个问题', quote: anchor.quote }
    });
    expect(followUp.statusCode).toBe(200);

    // The follow-up call must carry the first Q&A as history — the current
    // question must NOT be duplicated into it.
    const followUpRequest = complete.mock.calls[1]![0];
    expect(followUpRequest.history).toEqual([
      { role: 'user', content: '第一个问题' },
      { role: 'assistant', content: '第一轮回答' }
    ]);
    expect(followUpRequest.question).toBe('第二个问题');
    // Default spec includes the full document and the selected paragraph.
    expect(followUpRequest.contexts.map((c) => c.label)).toEqual(['整篇文档', '选定段落']);
    await app.close();
  });

  it('resolves a checked file into the AI contexts', async () => {
    const complete = vi.fn<AiProvider['complete']>()
      .mockResolvedValueOnce({ answer: '首答' })
      .mockResolvedValueOnce({ answer: '次答' });
    const root = await fixture();
    await writeFile(join(root, 'Paper', 'notes.md'), '# Notes\n\n参考资料内容', 'utf8');
    const app = await buildApp({ initialWorkspace: root, aiProvider: { complete } });
    const created = await app.inject({
      method: 'POST', url: '/api/discussions', payload: { anchor, content: '问题' }
    });
    const source = created.json().discussion;

    await app.inject({
      method: 'POST', url: `/api/discussions/${source.id}/messages`,
      payload: {
        content: '追问',
        quote: anchor.quote,
        contextSpec: {
          includeDocument: false,
          includeParagraph: false,
          includeHistory: false,
          filePaths: ['Paper/notes.md'],
          discussionIds: []
        }
      }
    });

    const request = complete.mock.calls[1]![0];
    expect(request.history).toEqual([]);
    expect(request.contexts).toEqual([{ label: '文件：Paper/notes.md', content: '# Notes\n\n参考资料内容' }]);
    await app.close();
  });

  it('searches document contents case-insensitively with line matches', async () => {
    const root = await fixture();
    await writeFile(join(root, 'Paper', 'notes.md'), '# Notes\n\nThe QUICK brown fox\nsecond line', 'utf8');
    const app = await buildApp({ initialWorkspace: root });

    const response = await app.inject({ method: 'GET', url: '/api/search?q=quick' });
    expect(response.statusCode).toBe(200);
    const hits = response.json();
    const notes = hits.find((hit: { path: string }) => hit.path === 'Paper/notes.md');
    expect(notes).toBeTruthy();
    expect(notes.matches[0]).toMatchObject({ line: 3, text: 'The QUICK brown fox' });
    await app.close();
  });

  it('restores an earlier version, reverting the document content', async () => {
    const app = await buildApp({ initialWorkspace: await fixture() });
    const read = await app.inject({ method: 'GET', url: '/api/documents/Paper%2Fmain.md' });

    // Each save autosaves a snapshot of the written content. Two distinct edits
    // give us two snapshots to move between.
    const first = await app.inject({
      method: 'PUT', url: '/api/documents/Paper%2Fmain.md',
      payload: { content: '# Title\n\n第一次改动', expectedVersionId: read.json().versionId }
    });
    await app.inject({
      method: 'PUT', url: '/api/documents/Paper%2Fmain.md',
      payload: { content: '# Title\n\n第二次改动', expectedVersionId: first.json().versionId }
    });

    const versions = await app.inject({
      method: 'GET', url: '/api/versions?documentPath=Paper%2Fmain.md'
    }).then((response) => response.json());
    // Newest first: [0] = 第二次改动, [1] = 第一次改动.
    expect(versions).toHaveLength(2);

    const restore = await app.inject({
      method: 'POST', url: `/api/versions/${versions[1].id}/restore`,
      payload: { documentPath: 'Paper/main.md' }
    });
    expect(restore.statusCode).toBe(200);

    // The document reverts to the earlier snapshot's content.
    const after = await app.inject({ method: 'GET', url: '/api/documents/Paper%2Fmain.md' });
    expect(after.json().content).toBe('# Title\n\n第一次改动');
    await app.close();
  });
});
