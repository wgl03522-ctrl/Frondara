import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { AiSettingsService } from '../src/services/ai-settings-service.js';

async function tempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'pnode-ai-service-'));
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function completion(content: string): unknown {
  return { choices: [{ message: { content } }] };
}

async function createService(configDir: string, env: NodeJS.ProcessEnv, fetchImpl?: typeof fetch) {
  const service = new AiSettingsService({ configDir, env, fetch: fetchImpl as never });
  await service.initialize();
  return service;
}

describe('AiSettingsService lifecycle', () => {
  it('starts in demo mode when nothing is stored and no env is present', async () => {
    const service = await createService(await tempDir(), {});
    const settings = await service.getPublicSettings();
    expect(settings.mode).toBe('demo');
    expect(settings.hasApiKey).toBe(false);
    const answer = await service.runtimeProvider.complete({ question: '检查论证', quote: '证明有效', contexts: [] });
    expect(answer.answer).toContain('结论强度');
  });

  it('imports a complete env configuration exactly once on first launch', async () => {
    const dir = await tempDir();
    const env = {
      PNODE_AI_API_KEY: 'env-key',
      PNODE_AI_BASE_URL: 'https://api.example.com/v1',
      PNODE_AI_MODEL: 'env-model'
    };
    const first = await createService(dir, env);
    const imported = await first.getPublicSettings();
    expect(imported.mode).toBe('compatible');
    expect(imported.baseUrl).toBe('https://api.example.com/v1/');
    expect(imported.model).toBe('env-model');
    expect(imported.hasApiKey).toBe(true);

    // Second launch with a *different* env must not override the stored config.
    const second = await createService(dir, {
      PNODE_AI_API_KEY: 'other-key',
      PNODE_AI_BASE_URL: 'https://other.example.com/v2',
      PNODE_AI_MODEL: 'other-model'
    });
    expect((await second.getPublicSettings()).model).toBe('env-model');
  });

  it('does not import an incomplete env configuration', async () => {
    const service = await createService(await tempDir(), { PNODE_AI_API_KEY: 'lonely-key' });
    expect((await service.getPublicSettings()).mode).toBe('demo');
    expect((await service.getPublicSettings()).hasApiKey).toBe(false);
  });
});

describe('AiSettingsService.updateSettings', () => {
  it('persists a compatible config and swaps the runtime provider without restart', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(completion(JSON.stringify({ answer: '来自真实提供器' }))));
    const service = await createService(await tempDir(), {}, fetchMock as never);

    const before = await service.runtimeProvider.complete({ question: 'q', quote: 'x', contexts: [] });
    expect(before.answer).toContain('结论强度');

    const result = await service.updateSettings({
      mode: 'compatible',
      baseUrl: 'https://api.example.com/v1/',
      model: 'demo-model',
      apiKey: 'k-secret'
    });
    expect(result.mode).toBe('compatible');
    expect(result.hasApiKey).toBe(true);
    expect(result).not.toHaveProperty('apiKey');

    const after = await service.runtimeProvider.complete({ question: 'q', quote: 'x', contexts: [] });
    expect(after.answer).toBe('来自真实提供器');
  });

  it('keeps the stored key when the update omits it', async () => {
    const dir = await tempDir();
    const service = await createService(dir, {});
    await service.updateSettings({
      mode: 'compatible', baseUrl: 'https://api.example.com/v1/', model: 'demo-model', apiKey: 'k-secret'
    });
    const updated = await service.updateSettings({
      mode: 'compatible', baseUrl: 'https://api.example.com/v2/', model: 'demo-model'
    });
    expect(updated.hasApiKey).toBe(true);
    expect(await service.getApiKeyForTest()).toBe('k-secret');
  });

  it('rejects compatible mode with no effective key', async () => {
    const service = await createService(await tempDir(), {});
    await expect(service.updateSettings({
      mode: 'compatible', baseUrl: 'https://api.example.com/v1/', model: 'demo-model'
    })).rejects.toMatchObject({ code: 'AI_API_KEY_REQUIRED' });
  });

  it('clears the key on demand and falls back to demo behaviour', async () => {
    const dir = await tempDir();
    const service = await createService(dir, {});
    await service.updateSettings({
      mode: 'compatible', baseUrl: 'https://api.example.com/v1/', model: 'demo-model', apiKey: 'k-secret'
    });
    const cleared = await service.updateSettings({ mode: 'demo', baseUrl: '', model: '', clearApiKey: true });
    expect(cleared.hasApiKey).toBe(false);
    const answer = await service.runtimeProvider.complete({ question: 'q', quote: 'x', contexts: [] });
    expect(answer.answer).toContain('结论强度');
  });

  it('switching to demo keeps the stored key and compatible fields for later', async () => {
    const dir = await tempDir();
    const service = await createService(dir, {});
    await service.updateSettings({
      mode: 'compatible', baseUrl: 'https://api.example.com/v1/', model: 'demo-model', apiKey: 'k-secret'
    });
    const demo = await service.updateSettings({
      mode: 'demo', baseUrl: 'https://api.example.com/v1/', model: 'demo-model'
    });
    expect(demo.mode).toBe('demo');
    expect(demo.hasApiKey).toBe(true);
    expect(demo.baseUrl).toBe('https://api.example.com/v1/');
  });
});

describe('AiSettingsService.testConnection', () => {
  it('tests unsaved form values without persisting or swapping the provider', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(completion('pong')));
    const service = await createService(await tempDir(), {}, fetchMock as never);

    const result = await service.testConnection({
      baseUrl: 'https://api.example.com/v1/', model: 'demo-model', apiKey: 'k-secret'
    });
    expect(result.ok).toBe(true);
    expect(result.model).toBe('demo-model');

    // Nothing persisted, provider unchanged.
    expect((await service.getPublicSettings()).mode).toBe('demo');
    const answer = await service.runtimeProvider.complete({ question: 'q', quote: 'x', contexts: [] });
    expect(answer.answer).toContain('结论强度');
  });

  it('uses the stored key when the form leaves it blank', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(completion('pong')));
    const service = await createService(await tempDir(), {}, fetchMock as never);
    await service.updateSettings({
      mode: 'compatible', baseUrl: 'https://api.example.com/v1/', model: 'demo-model', apiKey: 'stored-key'
    });

    await service.testConnection({ baseUrl: 'https://api.example.com/v1/', model: 'demo-model' });
    const authHeader = (fetchMock.mock.calls.at(-1)![1] as RequestInit).headers as Record<string, string>;
    expect(authHeader.authorization).toBe('Bearer stored-key');
  });

  it('requires a key to test', async () => {
    const service = await createService(await tempDir(), {});
    await expect(service.testConnection({ baseUrl: 'https://api.example.com/v1/', model: 'demo-model' }))
      .rejects.toMatchObject({ code: 'AI_API_KEY_REQUIRED' });
  });
});
