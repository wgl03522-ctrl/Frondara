import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { WorkspaceContext } from '../workspace-context.js';

export async function registerVersionRoutes(app: FastifyInstance, context: WorkspaceContext): Promise<void> {
  app.get('/api/versions', async (request) => {
    const { documentPath } = z.object({ documentPath: z.string().min(1) }).parse(request.query);
    return context.require().versions.list(documentPath);
  });

  app.get('/api/versions/:id/diff', async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const version = await context.require().versions.get(id);
    const previous = await context.require().versions.readContent(id);
    const current = await context.require().documents.read(version.documentPath);
    return { previous, current: current.content };
  });

  app.post('/api/versions/:id/restore', async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const { documentPath } = z.object({ documentPath: z.string().min(1) }).parse(request.body);
    return context.require().versions.restore(documentPath, id);
  });
}
