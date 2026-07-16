import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { WorkspaceContext } from '../workspace-context.js';

const SaveSchema = z.object({
  content: z.string(),
  expectedVersionId: z.string().optional()
});
const CreateSchema = z.object({ path: z.string().min(1), content: z.string() });

function wildcardPath(request: FastifyRequest): string {
  const raw = (request.params as Record<string, string>)['*'];
  if (!raw) throw new Error('DOCUMENT_PATH_REQUIRED');
  return decodeURIComponent(raw);
}

export async function registerDocumentRoutes(app: FastifyInstance, context: WorkspaceContext): Promise<void> {
  app.get('/api/documents', async () => context.require().documents.list());

  // A dedicated path (not '/api/documents/search') so the '/api/documents/*'
  // wildcard route below can't swallow the query.
  app.get('/api/search', async (request) => {
    const { q } = z.object({ q: z.string() }).parse(request.query);
    return context.require().documents.search(q);
  });

  app.post('/api/documents', async (request, reply) => {
    const body = CreateSchema.parse(request.body);
    return reply.code(201).send(await context.require().documents.create(body.path, body.content));
  });

  app.get('/api/documents/*', async (request) => {
    return context.require().documents.read(wildcardPath(request));
  });

  app.put('/api/documents/*', async (request) => {
    const body = SaveSchema.parse(request.body);
    const path = wildcardPath(request);
    const saved = await context.require().documents.save(path, body.content, body.expectedVersionId);
    await context.require().versions.snapshot(path, body.content, 'autosave');
    return saved;
  });
}
