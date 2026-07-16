import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { DemoAiProvider } from '../src/services/demo-ai-provider.js';

it('returns a deterministic demo suggestion without credentials', async () => {
  const provider = new DemoAiProvider();
  const result = await provider.complete({
    question: '检查论证', quote: '本研究证明结果有效。', contexts: []
  });
  expect(result.answer).toContain('结论强度');
  expect(result.suggestion?.originalText).toBe('本研究证明结果有效。');
});

it('does not expose the API key in settings', async () => {
  const configDir = await mkdtemp(join(tmpdir(), 'pnode-ai-legacy-'));
  const app = await buildApp({ aiConfigDir: configDir, env: { PNODE_AI_API_KEY: 'secret' } });
  const response = await app.inject({ method: 'GET', url: '/api/ai/settings' });
  expect(response.json()).not.toHaveProperty('apiKey');
  await app.close();
});
