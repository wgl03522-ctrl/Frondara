import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { WorkspaceContext } from '../workspace-context.js';

const OpenWorkspaceSchema = z.object({ path: z.string().min(1) });

export async function registerWorkspaceRoutes(app: FastifyInstance, context: WorkspaceContext): Promise<void> {
  app.post('/api/workspace/open', async (request, reply) => {
    const { path } = OpenWorkspaceSchema.parse(request.body);
    const services = await context.open(path);
    return reply.code(200).send({ root: services.root });
  });

  app.get('/api/workspace', async () => {
    const current = context.current();
    return { open: Boolean(current), root: current?.root };
  });

  app.get('/api/workspace/state', async () => context.require().workspace.readUiState());

  app.put('/api/workspace/state', async (request) => {
    await context.require().workspace.writeUiState(request.body as never);
    return context.require().workspace.readUiState();
  });
}
