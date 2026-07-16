import Fastify, { type FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { registerAiRoutes } from './routes/ai.js';
import { registerDiscussionRoutes } from './routes/discussions.js';
import { registerDocumentRoutes } from './routes/documents.js';
import { registerVersionRoutes } from './routes/versions.js';
import { registerWorkspaceRoutes } from './routes/workspace.js';
import type { AiProvider } from './services/ai-provider.js';
import { AiError, httpStatusForAiCode } from './services/ai-errors.js';
import { AiSettingsService } from './services/ai-settings-service.js';
import { WorkspaceContext } from './workspace-context.js';

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export interface BuildAppOptions {
  initialWorkspace?: string;
  aiProvider?: AiProvider;
  aiConfigDir?: string;
  env?: NodeJS.ProcessEnv;
  aiFetch?: FetchLike;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  const context = new WorkspaceContext();
  if (options.initialWorkspace) await context.open(options.initialWorkspace);

  const aiSettings = new AiSettingsService({
    ...(options.aiConfigDir !== undefined ? { configDir: options.aiConfigDir } : {}),
    ...(options.env !== undefined ? { env: options.env } : {}),
    ...(options.aiFetch !== undefined ? { fetch: options.aiFetch } : {})
  });
  await aiSettings.initialize();

  // Injected provider (tests) bypasses the runtime proxy; otherwise discussions
  // read the live provider so a saved settings change applies without restart.
  const discussionProvider = options.aiProvider ?? aiSettings.runtimeProvider;

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AiError) {
      return reply.code(httpStatusForAiCode(error.code)).send({ code: error.code, message: error.message });
    }
    if (error instanceof ZodError) return reply.code(400).send({ code: 'INVALID_INPUT', details: error.issues });
    const message = error instanceof Error ? error.message : 'UNEXPECTED_ERROR';
    const code = message.split(':')[0] ?? 'UNEXPECTED_ERROR';
    const status = statusFor(code);
    return reply.code(status).send({ code, message });
  });

  await registerWorkspaceRoutes(app, context);
  await registerDocumentRoutes(app, context);
  await registerDiscussionRoutes(app, context, discussionProvider);
  await registerVersionRoutes(app, context);
  await registerAiRoutes(app, aiSettings);
  return app;
}

function statusFor(code: string): number {
  if (['PATH_OUTSIDE_WORKSPACE', 'DOCUMENT_PATH_REQUIRED', 'WORKSPACE_NOT_DIRECTORY'].includes(code)) return 400;
  if (code.endsWith('_NOT_FOUND') || code === 'WORKSPACE_NOT_OPEN') return 404;
  if (['VERSION_CONFLICT', 'TARGET_MISMATCH', 'DOCUMENT_EXISTS', 'DISCUSSION_NOT_DRAFT'].includes(code)) return 409;
  if (code === 'METADATA_INVALID') return 422;
  return 500;
}
