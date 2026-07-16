import type { FastifyInstance } from 'fastify';
import { AiConnectionTestSchema } from '@pnode/core';
import type { AiSettingsService } from '../services/ai-settings-service.js';

export async function registerAiRoutes(app: FastifyInstance, settings: AiSettingsService): Promise<void> {
  app.get('/api/ai/settings', async () => settings.getPublicSettings());

  app.put('/api/ai/settings', async (request) => settings.updateSettings(request.body));

  app.post('/api/ai/settings/test', async (request) => {
    const input = AiConnectionTestSchema.parse(request.body);
    const result = await settings.testConnection(input);
    return { ok: result.ok, model: result.model, latencyMs: result.latencyMs };
  });
}
