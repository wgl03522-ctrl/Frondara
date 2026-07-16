import {
  AI_SETTINGS_VERSION,
  AiSettingsUpdateSchema,
  type AiConnectionTest,
  type PersistedAiSettings,
  type PublicAiSettings
} from '@pnode/core';
import type { AiProvider, AiRequest, AiResult } from './ai-provider.js';
import { AiError } from './ai-errors.js';
import { DemoAiProvider } from './demo-ai-provider.js';
import { OpenAiCompatibleProvider, type ConnectionTestResult } from './openai-compatible-provider.js';
import { AiSettingsStore } from './ai-settings-store.js';

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export interface AiSettingsServiceOptions {
  configDir?: string;
  env?: NodeJS.ProcessEnv;
  fetch?: FetchLike;
}

/**
 * Stable proxy handed to the discussion routes. Each request captures the current
 * provider first, so an in-flight completion keeps using the provider it started
 * with while later requests immediately see a swap.
 */
export class RuntimeAiProvider implements AiProvider {
  constructor(private current: AiProvider) {}

  setProvider(next: AiProvider): void {
    this.current = next;
  }

  async complete(request: AiRequest): Promise<AiResult> {
    const provider = this.current;
    return provider.complete(request);
  }
}

export class AiSettingsService {
  readonly runtimeProvider: RuntimeAiProvider;
  private readonly store: AiSettingsStore;
  private readonly env: NodeJS.ProcessEnv;
  private readonly fetchImpl: FetchLike | undefined;

  constructor(options: AiSettingsServiceOptions = {}) {
    this.store = new AiSettingsStore(options.configDir);
    this.env = options.env ?? process.env;
    this.fetchImpl = options.fetch;
    this.runtimeProvider = new RuntimeAiProvider(new DemoAiProvider());
  }

  async initialize(): Promise<void> {
    if (!(await this.store.hasStoredSettings())) {
      await this.importFromEnv();
    }
    await this.rebuildProvider();
  }

  async getPublicSettings(): Promise<PublicAiSettings> {
    const settings = await this.store.readSettings();
    return {
      mode: settings.mode,
      baseUrl: settings.baseUrl,
      model: settings.model,
      hasApiKey: await this.store.hasApiKey()
    };
  }

  async updateSettings(input: unknown): Promise<PublicAiSettings> {
    const update = AiSettingsUpdateSchema.parse(input);
    const hadKey = await this.store.hasApiKey();
    const willHaveKey = update.clearApiKey ? false : Boolean(update.apiKey) || hadKey;

    if (update.mode === 'compatible' && !willHaveKey) {
      throw new AiError('AI_API_KEY_REQUIRED', '兼容模式需要提供 API 密钥');
    }

    const settings: PersistedAiSettings = {
      version: AI_SETTINGS_VERSION,
      mode: update.mode,
      baseUrl: update.baseUrl,
      model: update.model
    };
    await this.store.writeSettings(settings);

    if (update.clearApiKey) await this.store.clearApiKey();
    else if (update.apiKey) await this.store.writeApiKey(update.apiKey);

    await this.rebuildProvider();
    return this.getPublicSettings();
  }

  async testConnection(input: AiConnectionTest): Promise<ConnectionTestResult> {
    const apiKey = input.apiKey ?? (await this.store.readApiKey());
    if (!apiKey) throw new AiError('AI_API_KEY_REQUIRED', '请先填写或保存 API 密钥再测试');
    const provider = this.buildCompatibleProvider(input.baseUrl, input.model, apiKey);
    return provider.testConnection();
  }

  /** Test-only accessor; never exposed through the HTTP API. */
  async getApiKeyForTest(): Promise<string | undefined> {
    return this.store.readApiKey();
  }

  private async rebuildProvider(): Promise<void> {
    const settings = await this.store.readSettings();
    if (settings.mode === 'compatible') {
      const apiKey = await this.store.readApiKey();
      if (apiKey && settings.baseUrl && settings.model) {
        this.runtimeProvider.setProvider(this.buildCompatibleProvider(settings.baseUrl, settings.model, apiKey));
        return;
      }
    }
    this.runtimeProvider.setProvider(new DemoAiProvider());
  }

  private buildCompatibleProvider(baseUrl: string, model: string, apiKey: string): OpenAiCompatibleProvider {
    return new OpenAiCompatibleProvider(
      baseUrl,
      model,
      apiKey,
      this.fetchImpl ? { fetch: this.fetchImpl } : {}
    );
  }

  private async importFromEnv(): Promise<void> {
    const apiKey = this.env.PNODE_AI_API_KEY;
    const baseUrl = this.env.PNODE_AI_BASE_URL;
    const model = this.env.PNODE_AI_MODEL;
    if (!apiKey || !baseUrl || !model) return;

    const update = AiSettingsUpdateSchema.safeParse({ mode: 'compatible', baseUrl, model, apiKey });
    if (!update.success) return;

    await this.store.writeSettings({
      version: AI_SETTINGS_VERSION,
      mode: 'compatible',
      baseUrl: update.data.baseUrl,
      model: update.data.model
    });
    await this.store.writeApiKey(apiKey);
  }
}
