import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { TextAnchorSchema } from '@pnode/core';
import { titleFrom } from '@pnode/storage';
import type { AiProvider } from '../services/ai-provider.js';
import { resolveContexts, DEFAULT_CONTEXT_SPEC } from '../services/context-resolver.js';
import type { WorkspaceContext } from '../workspace-context.js';

// The context selection sent by the client. Every field has a default so an
// omitted (or partial) spec degrades to "selected paragraph + this discussion's
// history" — the same behaviour as before context control existed, minus the
// full document (which the user can opt into).
const ContextSpecSchema = z.object({
  includeDocument: z.boolean().default(true),
  includeParagraph: z.boolean().default(true),
  includeHistory: z.boolean().default(true),
  filePaths: z.array(z.string()).default([]),
  discussionIds: z.array(z.string()).default([])
}).default(DEFAULT_CONTEXT_SPEC);

// Creating an active discussion carries a context selection too: the first
// question is asked from the same composer with the context panel open, so the
// selected paragraph / document / referenced files must reach the AI.
const CreateSchema = z.object({
  anchor: TextAnchorSchema,
  content: z.string().min(1),
  contextSpec: ContextSpecSchema
});
const ForkSchema = z.object({
  messageId: z.string().min(1),
  question: z.string().min(1),
  title: z.string().min(1).optional()
});

const MessageSchema = z.object({
  content: z.string().min(1),
  quote: z.string(),
  contextSpec: ContextSpecSchema
});

export async function registerDiscussionRoutes(
  app: FastifyInstance,
  context: WorkspaceContext,
  aiProvider: AiProvider
): Promise<void> {
  app.get('/api/discussions', async (request) => {
    const query = z.object({ documentPath: z.string().optional() }).parse(request.query);
    return context.require().discussions.list(query.documentPath);
  });

  app.get('/api/discussions/:id', async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    return context.require().discussions.get(id);
  });

  app.post('/api/discussions/draft', async (request, reply) => {
    const body = CreateSchema.parse(request.body);
    return reply.code(201).send(
      await context.require().discussions.createDraft(body.anchor, body.content)
    );
  });

  app.post('/api/discussions', async (request, reply) => {
    const body = CreateSchema.parse(request.body);
    const services = context.require();
    const discussion = await services.discussions.createActive(body.anchor, body.content);
    // The lone first message *is* the current question, so history is forced off
    // (mirrors /activate); only the explicit context blocks are resolved here.
    const { contexts } = await resolveContexts(
      { ...body.contextSpec, includeHistory: false },
      discussion,
      services
    );
    const result = await aiProvider.complete({ question: body.content, quote: body.anchor.quote, contexts });
    const completed = await services.discussions.addMessage(discussion.id, {
      id: `m-${randomUUID()}`,
      role: 'assistant',
      delivery: 'complete',
      content: result.answer,
      createdAt: new Date().toISOString()
    });
    return reply.code(201).send({ discussion: completed, ai: result });
  });

  app.post('/api/discussions/:id/activate', async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = z.object({
      content: z.string().min(1).optional(),
      contextSpec: ContextSpecSchema
    }).parse(request.body ?? {});
    if (body.content) await context.require().discussions.updateDraft(id, body.content);
    const services = context.require();
    const discussion = await services.discussions.activateDraft(id);
    const first = discussion.messages[0];
    if (!first || first.role !== 'user') throw new Error('MESSAGE_NOT_FOUND');
    // The first question has no prior turns, so history is forced off — the lone
    // draft message *is* the current question and must not be replayed as history.
    const { contexts } = await resolveContexts(
      { ...body.contextSpec, includeHistory: false },
      discussion,
      services
    );
    const result = await aiProvider.complete({ question: first.content, quote: discussion.anchor.quote, contexts });
    const completed = await services.discussions.addMessage(id, {
      id: `m-${randomUUID()}`,
      role: 'assistant', delivery: 'complete', content: result.answer,
      createdAt: new Date().toISOString()
    });
    return { discussion: completed, ai: result };
  });

  app.post('/api/discussions/:id/messages', async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = MessageSchema.parse(request.body);
    const services = context.require();
    // Resolve context from the discussion state *before* storing the new user
    // message, so the current question is not duplicated into the history turns.
    const source = await services.discussions.get(id);
    const { contexts, history } = await resolveContexts(body.contextSpec, source, services);
    await services.discussions.addMessage(id, {
      id: `m-${randomUUID()}`, role: 'user', delivery: 'sent', content: body.content,
      createdAt: new Date().toISOString()
    });
    const result = await aiProvider.complete({ question: body.content, quote: body.quote, contexts, history });
    const discussion = await services.discussions.addMessage(id, {
      id: `m-${randomUUID()}`, role: 'assistant', delivery: 'complete', content: result.answer,
      createdAt: new Date().toISOString()
    });
    return { discussion, ai: result };
  });

  app.patch('/api/discussions/:id', async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = z.object({ title: z.string().min(1) }).parse(request.body);
    return context.require().discussions.rename(id, body.title);
  });

  app.post('/api/discussions/:id/fork', async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = ForkSchema.parse(request.body);
    const services = context.require();
    const discussions = services.discussions;
    // Naming is optional: fall back to the first question, matching titleFrom's rule.
    const fork = await discussions.forkFromMessage(id, body.messageId, body.title ?? titleFrom(body.question));
    // A fresh fork starts with no messages of its own, so this resolves the
    // default document + paragraph blocks (history is empty here). Without it a
    // forked branch's first answer would be context-blind. Injecting the parent
    // conversation as context is a separate, deferred concern (see backlog).
    const { contexts } = await resolveContexts(DEFAULT_CONTEXT_SPEC, fork, services);
    await discussions.addMessage(fork.id, {
      id: `m-${randomUUID()}`, role: 'user', delivery: 'sent', content: body.question,
      createdAt: new Date().toISOString()
    });
    const result = await aiProvider.complete({ question: body.question, quote: fork.anchor.quote, contexts });
    const discussion = await discussions.addMessage(fork.id, {
      id: `m-${randomUUID()}`, role: 'assistant', delivery: 'complete', content: result.answer,
      createdAt: new Date().toISOString()
    });
    return reply.code(201).send({ discussion, ai: result });
  });
}
