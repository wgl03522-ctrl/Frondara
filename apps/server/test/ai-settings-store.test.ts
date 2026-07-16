import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AiSettingsStore } from '../src/services/ai-settings-store.js';

async function tempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'pnode-ai-store-'));
}

describe('AiSettingsStore', () => {
  it('defaults to demo mode with no stored key when nothing is written', async () => {
    const store = new AiSettingsStore(await tempDir());
    const settings = await store.readSettings();
    expect(settings.mode).toBe('demo');
    expect(settings.baseUrl).toBe('');
    expect(await store.hasApiKey()).toBe(false);
  });

  it('round-trips settings and credentials in separate files', async () => {
    const dir = await tempDir();
    const store = new AiSettingsStore(dir);
    await store.writeSettings({ version: 1, mode: 'compatible', baseUrl: 'https://api.example.com/v1/', model: 'demo-model' });
    await store.writeApiKey('k-secret');

    const reopened = new AiSettingsStore(dir);
    expect((await reopened.readSettings()).baseUrl).toBe('https://api.example.com/v1/');
    expect(await reopened.hasApiKey()).toBe(true);
    expect(await reopened.readApiKey()).toBe('k-secret');
  });

  it('never writes the key into the non-secret settings file', async () => {
    const dir = await tempDir();
    const store = new AiSettingsStore(dir);
    await store.writeSettings({ version: 1, mode: 'compatible', baseUrl: 'https://api.example.com/v1/', model: 'demo-model' });
    await store.writeApiKey('k-secret');

    const settingsRaw = await readFile(join(dir, 'ai-settings.json'), 'utf8');
    expect(settingsRaw).not.toContain('k-secret');
    expect(settingsRaw).not.toContain('apiKey');
  });

  it('clears the credential file when the key is removed', async () => {
    const dir = await tempDir();
    const store = new AiSettingsStore(dir);
    await store.writeApiKey('k-secret');
    expect(await store.hasApiKey()).toBe(true);
    await store.clearApiKey();
    expect(await store.hasApiKey()).toBe(false);
    expect(await store.readApiKey()).toBeUndefined();
  });

  it('requests 0600 permission for the credential file on posix', async () => {
    if (process.platform === 'win32') return;
    const dir = await tempDir();
    const store = new AiSettingsStore(dir);
    await store.writeApiKey('k-secret');
    const mode = (await stat(join(dir, 'ai-credentials.json'))).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it('raises a read failure for corrupt settings instead of silently defaulting', async () => {
    const dir = await tempDir();
    await writeFile(join(dir, 'ai-settings.json'), '{ not valid json', 'utf8');
    const store = new AiSettingsStore(dir);
    await expect(store.readSettings()).rejects.toMatchObject({ code: 'AI_SETTINGS_READ_FAILED' });
  });

  it('raises a read failure for corrupt credentials', async () => {
    const dir = await tempDir();
    await writeFile(join(dir, 'ai-credentials.json'), 'not json at all', 'utf8');
    const store = new AiSettingsStore(dir);
    await expect(store.readApiKey()).rejects.toMatchObject({ code: 'AI_SETTINGS_READ_FAILED' });
  });
});
