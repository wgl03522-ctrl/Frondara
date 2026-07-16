import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';

async function tempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'pnode-ai-routes-'));
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function completion(content: string): unknown {
  return { choices: [{ message: { content } }] };
}

describe('AI settings routes', () => {
  it('returns a sanitized demo default with no key material', async () => {
    const app = await buildApp({ aiConfigDir: await tempDir(), env: {} });
    const response = await app.inject({ method: 'GET', url: '/api/ai/settings' });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toMatchObject({ mode: 'demo', baseUrl: '', model: '', hasApiKey: false });
    expect(body).not.toHaveProperty('apiKey');
    await app.close();
  });

  it('saves a compatible config and reports hasApiKey without returning the key', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(completion(JSON.stringify({ answer: 'ok' }))));
    const app = await buildApp({ aiConfigDir: await tempDir(), env: {}, aiFetch: fetchMock as never });
    const saved = await app.inject({
      method: 'PUT',
      url: '/api/ai/settings',
      payload: { mode: 'compatible', baseUrl: 'https://api.example.com/v1', model: 'demo-model', apiKey: 'k-secret' }
    });
    expect(saved.statusCode).toBe(200);
    const body = saved.json();
    expect(body).toMatchObject({ mode: 'compatible', baseUrl: 'https://api.example.com/v1/', model: 'demo-model', hasApiKey: true });
    expect(JSON.stringify(body)).not.toContain('k-secret');

    const reread = await app.inject({ method: 'GET', url: '/api/ai/settings' });
    expect(reread.json().hasApiKey).toBe(true);
    expect(JSON.stringify(reread.json())).not.toContain('k-secret');
    await app.close();
  });

  it('makes the saved provider take effect for the next discussion without restart', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(completion(JSON.stringify({ answer: '真实提供器回答' }))));
    const dir = await tempDir();
    const workspace = await mkdtemp(join(tmpdir(), 'pnode-ai-ws-'));
    const app = await buildApp({ initialWorkspace: workspace, aiConfigDir: dir, env: {}, aiFetch: fetchMock as never });
    await app.inject({
      method: 'PUT',
      url: '/api/ai/settings',
      payload: { mode: 'compatible', baseUrl: 'https://api.example.com/v1', model: 'demo-model', apiKey: 'k-secret' }
    });

    const anchor = { documentPath: 'main.md', quote: '原文', prefix: '', suffix: '', headingPath: [], documentVersionId: 'v1' };
    // create a document so discussion can anchor
    await app.inject({ method: 'POST', url: '/api/documents', payload: { path: 'main.md', content: '# t\n\n原文' } });
    const created = await app.inject({ method: 'POST', url: '/api/discussions', payload: { anchor, content: '检查' } });
    expect(created.json().ai.answer).toBe('真实提供器回答');
    await app.close();
  });

  it('tests unsaved values without persisting or swapping the provider', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(completion('pong')));
    const dir = await tempDir();
    const app = await buildApp({ aiConfigDir: dir, env: {}, aiFetch: fetchMock as never });
    const tested = await app.inject({
      method: 'POST',
      url: '/api/ai/settings/test',
      payload: { baseUrl: 'https://api.example.com/v1', model: 'demo-model', apiKey: 'k-secret' }
    });
    expect(tested.statusCode).toBe(200);
    expect(tested.json()).toMatchObject({ ok: true, model: 'demo-model' });
    expect(tested.json()).not.toHaveProperty('answer');

    // Still demo, nothing persisted.
    expect((await app.inject({ method: 'GET', url: '/api/ai/settings' })).json().mode).toBe('demo');
    await app.close();
  });

  it('maps an upstream auth failure during test to 401 with a stable code', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ error: 'x' }, 401));
    const app = await buildApp({ aiConfigDir: await tempDir(), env: {}, aiFetch: fetchMock as never });
    const tested = await app.inject({
      method: 'POST',
      url: '/api/ai/settings/test',
      payload: { baseUrl: 'https://api.example.com/v1', model: 'demo-model', apiKey: 'k-secret' }
    });
    expect(tested.statusCode).toBe(401);
    expect(tested.json().code).toBe('AI_AUTH_FAILED');
    await app.close();
  });

  it('rejects compatible save with no effective key as AI_API_KEY_REQUIRED', async () => {
    const app = await buildApp({ aiConfigDir: await tempDir(), env: {} });
    const saved = await app.inject({
      method: 'PUT',
      url: '/api/ai/settings',
      payload: { mode: 'compatible', baseUrl: 'https://api.example.com/v1', model: 'demo-model' }
    });
    expect(saved.statusCode).toBe(400);
    expect(saved.json().code).toBe('AI_API_KEY_REQUIRED');
    await app.close();
  });
});
