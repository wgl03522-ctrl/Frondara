import { describe, expect, it } from 'vitest';
import {
  AiConnectionTestSchema,
  AiSettingsUpdateSchema,
  DEFAULT_AI_SETTINGS,
  PersistedAiSettingsSchema,
  PublicAiSettingsSchema,
  normalizeBaseUrl
} from '../src/ai-settings.js';

describe('normalizeBaseUrl', () => {
  it('keeps a trailing slash so a relative endpoint preserves the base path', () => {
    expect(normalizeBaseUrl('https://api.example.com/v1')).toBe('https://api.example.com/v1/');
    expect(normalizeBaseUrl('https://api.example.com/v1/')).toBe('https://api.example.com/v1/');
    expect(new URL('chat/completions', normalizeBaseUrl('https://api.example.com/v1')).href)
      .toBe('https://api.example.com/v1/chat/completions');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeBaseUrl('  https://api.example.com/v1  ')).toBe('https://api.example.com/v1/');
  });

  it('rejects remote http addresses', () => {
    expect(() => normalizeBaseUrl('http://api.example.com/v1')).toThrow(/HTTPS/);
  });

  it('allows http only for loopback hosts', () => {
    expect(normalizeBaseUrl('http://localhost:1234/v1')).toBe('http://localhost:1234/v1/');
    expect(normalizeBaseUrl('http://127.0.0.1:1234/v1')).toBe('http://127.0.0.1:1234/v1/');
    expect(normalizeBaseUrl('http://[::1]:1234/v1')).toBe('http://[::1]:1234/v1/');
  });

  it('rejects embedded credentials', () => {
    expect(() => normalizeBaseUrl('https://user:pass@api.example.com/v1')).toThrow(/凭据|credential/i);
  });

  it('rejects a base url that already contains the chat endpoint', () => {
    expect(() => normalizeBaseUrl('https://api.example.com/v1/chat/completions')).toThrow(/chat\/completions/);
  });

  it('rejects unparseable and non-http protocols', () => {
    expect(() => normalizeBaseUrl('not a url')).toThrow();
    expect(() => normalizeBaseUrl('ftp://api.example.com/v1')).toThrow();
  });
});

describe('PersistedAiSettingsSchema', () => {
  it('accepts a versioned demo default', () => {
    const parsed = PersistedAiSettingsSchema.parse(DEFAULT_AI_SETTINGS);
    expect(parsed.mode).toBe('demo');
    expect(parsed.version).toBe(1);
    expect(parsed.baseUrl).toBe('');
    expect(parsed.model).toBe('');
  });

  it('rejects an unknown version', () => {
    expect(() => PersistedAiSettingsSchema.parse({ version: 99, mode: 'demo', baseUrl: '', model: '' })).toThrow();
  });
});

describe('PublicAiSettingsSchema', () => {
  it('carries hasApiKey and never a key field', () => {
    const parsed = PublicAiSettingsSchema.parse({
      mode: 'compatible',
      baseUrl: 'https://api.example.com/v1/',
      model: 'demo-model',
      hasApiKey: true
    });
    expect(parsed.hasApiKey).toBe(true);
    expect(parsed).not.toHaveProperty('apiKey');
  });
});

describe('AiSettingsUpdateSchema', () => {
  it('requires base url and model in compatible mode', () => {
    expect(() => AiSettingsUpdateSchema.parse({ mode: 'compatible', baseUrl: '', model: '' })).toThrow();
    expect(() =>
      AiSettingsUpdateSchema.parse({ mode: 'compatible', baseUrl: 'https://api.example.com/v1', model: '' })
    ).toThrow();
  });

  it('accepts a valid compatible update and normalizes the base url', () => {
    const parsed = AiSettingsUpdateSchema.parse({
      mode: 'compatible',
      baseUrl: 'https://api.example.com/v1',
      model: 'demo-model',
      apiKey: 'k-123'
    });
    expect(parsed.baseUrl).toBe('https://api.example.com/v1/');
    expect(parsed.model).toBe('demo-model');
    expect(parsed.apiKey).toBe('k-123');
  });

  it('rejects sending a new key and a clear flag together', () => {
    expect(() =>
      AiSettingsUpdateSchema.parse({
        mode: 'compatible',
        baseUrl: 'https://api.example.com/v1',
        model: 'demo-model',
        apiKey: 'k-123',
        clearApiKey: true
      })
    ).toThrow();
  });

  it('allows a demo-mode update that preserves compatible fields', () => {
    const parsed = AiSettingsUpdateSchema.parse({
      mode: 'demo',
      baseUrl: 'https://api.example.com/v1',
      model: 'demo-model'
    });
    expect(parsed.mode).toBe('demo');
    expect(parsed.baseUrl).toBe('https://api.example.com/v1/');
  });

  it('rejects an invalid base url even when non-empty in demo mode', () => {
    expect(() => AiSettingsUpdateSchema.parse({ mode: 'demo', baseUrl: 'http://api.example.com/v1', model: '' })).toThrow();
  });
});

describe('AiConnectionTestSchema', () => {
  it('normalizes base url and allows an omitted key', () => {
    const parsed = AiConnectionTestSchema.parse({ baseUrl: 'https://api.example.com/v1', model: 'demo-model' });
    expect(parsed.baseUrl).toBe('https://api.example.com/v1/');
    expect(parsed.apiKey).toBeUndefined();
  });

  it('requires base url and model', () => {
    expect(() => AiConnectionTestSchema.parse({ baseUrl: '', model: 'demo-model' })).toThrow();
    expect(() => AiConnectionTestSchema.parse({ baseUrl: 'https://api.example.com/v1', model: '' })).toThrow();
  });
});
