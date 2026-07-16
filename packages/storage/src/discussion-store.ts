import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { z } from 'zod';
import { DiscussionSchema, type Discussion, type Message, type TextAnchor } from '@pnode/core';
import { JsonStore } from './json-store.js';

const DiscussionListSchema = z.array(DiscussionSchema);

export class DiscussionStore {
  private readonly file: JsonStore<Discussion[]>;

  constructor(root: string) {
    this.file = new JsonStore(
      join(root, '.pnode', 'discussions', 'index.json'),
      DiscussionListSchema,
      []
    );
  }

  async list(documentPath?: string): Promise<Discussion[]> {
    const discussions = await this.file.read();
    return documentPath
      ? discussions.filter((discussion) => discussion.anchor.documentPath === documentPath)
      : discussions;
  }

  async get(id: string): Promise<Discussion> {
    const discussion = (await this.file.read()).find((item) => item.id === id);
    if (!discussion) throw new Error('DISCUSSION_NOT_FOUND');
    return discussion;
  }

  async createDraft(anchor: TextAnchor, content: string): Promise<Discussion> {
    const now = new Date().toISOString();
    const discussion = DiscussionSchema.parse({
      id: `d-${randomUUID()}`,
      title: titleFrom(content),
      status: 'draft',
      anchor,
      messages: [{
        id: `m-${randomUUID()}`,
        role: 'user',
        delivery: 'unsent',
        content,
        createdAt: now
      }],
      createdAt: now,
      updatedAt: now
    });
    const discussions = await this.file.read();
    discussions.push(discussion);
    await this.file.write(discussions);
    return discussion;
  }

  async createActive(anchor: TextAnchor, content: string): Promise<Discussion> {
    const draft = await this.createDraft(anchor, content);
    return this.activateDraft(draft.id);
  }

  async updateDraft(id: string, content: string): Promise<Discussion> {
    const discussions = await this.file.read();
    const index = discussions.findIndex((item) => item.id === id);
    if (index < 0) throw new Error('DISCUSSION_NOT_FOUND');
    const current = discussions[index]!;
    if (current.status !== 'draft') throw new Error('DISCUSSION_NOT_DRAFT');
    const first = current.messages[0];
    if (!first || first.role !== 'user' || first.delivery !== 'unsent') {
      throw new Error('MESSAGE_NOT_FOUND');
    }
    const updated = DiscussionSchema.parse({
      ...current,
      title: titleFrom(content),
      messages: [{ ...first, content }, ...current.messages.slice(1)],
      updatedAt: new Date().toISOString()
    });
    discussions[index] = updated;
    await this.file.write(discussions);
    return updated;
  }

  async activateDraft(id: string): Promise<Discussion> {
    const discussions = await this.file.read();
    const index = discussions.findIndex((item) => item.id === id);
    if (index < 0) throw new Error('DISCUSSION_NOT_FOUND');
    const current = discussions[index]!;
    if (current.status !== 'draft') throw new Error('DISCUSSION_NOT_DRAFT');
    const updated = DiscussionSchema.parse({
      ...current,
      status: 'active',
      messages: current.messages.map((message, messageIndex) =>
        messageIndex === 0 && message.role === 'user'
          ? { ...message, delivery: 'sent' as const }
          : message
      ),
      updatedAt: new Date().toISOString()
    });
    discussions[index] = updated;
    await this.file.write(discussions);
    return updated;
  }

  async addMessage(id: string, message: Message): Promise<Discussion> {
    const discussions = await this.file.read();
    const index = discussions.findIndex((item) => item.id === id);
    if (index < 0) throw new Error('DISCUSSION_NOT_FOUND');
    const updated = DiscussionSchema.parse({
      ...discussions[index]!,
      messages: [...discussions[index]!.messages, message],
      updatedAt: new Date().toISOString()
    });
    discussions[index] = updated;
    await this.file.write(discussions);
    return updated;
  }

  async rename(id: string, title: string): Promise<Discussion> {
    const discussions = await this.file.read();
    const index = discussions.findIndex((item) => item.id === id);
    if (index < 0) throw new Error('DISCUSSION_NOT_FOUND');
    const updated = DiscussionSchema.parse({
      ...discussions[index]!,
      title: titleFrom(title),
      updatedAt: new Date().toISOString()
    });
    discussions[index] = updated;
    await this.file.write(discussions);
    return updated;
  }

  async forkFromMessage(sourceId: string, messageId: string, title: string): Promise<Discussion> {
    const source = await this.get(sourceId);
    if (!source.messages.some((message) => message.id === messageId)) {
      throw new Error('MESSAGE_NOT_FOUND');
    }
    const now = new Date().toISOString();
    const fork = DiscussionSchema.parse({
      id: `d-${randomUUID()}`,
      title,
      status: 'active',
      anchor: source.anchor,
      messages: [],
      parentDiscussionId: source.id,
      forkedFromMessageId: messageId,
      createdAt: now,
      updatedAt: now
    });
    const discussions = await this.file.read();
    discussions.push(fork);
    await this.file.write(discussions);
    return fork;
  }
}

export function titleFrom(content: string): string {
  const normalized = content.trim().replaceAll(/\s+/g, ' ');
  return normalized.slice(0, 48) || '未命名讨论';
}
