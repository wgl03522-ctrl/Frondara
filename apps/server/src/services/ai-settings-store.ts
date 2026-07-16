import { readFile, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  AI_CREDENTIALS_VERSION,
  DEFAULT_AI_SETTINGS,
  PersistedAiCredentialsSchema,
  PersistedAiSettingsSchema,
  type PersistedAiSettings
} from '@pnode/core';
import { writeAtomic } from '@pnode/storage';
import { AiError } from './ai-errors.js';

const SETTINGS_FILE = 'ai-settings.json';
const CREDENTIALS_FILE = 'ai-credentials.json';
const CREDENTIAL_MODE = 0o600;
const DIR_MODE = 0o700;

/**
 * Resolve the per-user application config directory. Priority: explicit override
 * (tests / PNODE_CONFIG_DIR), then platform conventions. Never the workspace.
 */
export function resolveConfigDir(env: NodeJS.ProcessEnv = process.env): string {
  if (env.PNODE_CONFIG_DIR) return env.PNODE_CONFIG_DIR;
  if (process.platform === 'win32') {
    const appData = env.APPDATA ?? join(homedir(), 'AppData', 'Roaming');
    return join(appData, 'pnode');
  }
  if (process.platform === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'pnode');
  }
  const xdg = env.XDG_CONFIG_HOME ?? join(homedir(), '.config');
  return join(xdg, 'pnode');
}

export class AiSettingsStore {
  private readonly settingsPath: string;
  private readonly credentialsPath: string;

  constructor(private readonly configDir: string = resolveConfigDir()) {
    this.settingsPath = join(configDir, SETTINGS_FILE);
    this.credentialsPath = join(configDir, CREDENTIALS_FILE);
  }

  /** True when a settings file already exists (used to gate one-time env import). */
  async hasStoredSettings(): Promise<boolean> {
    return this.fileExists(this.settingsPath);
  }

  async readSettings(): Promise<PersistedAiSettings> {
    const raw = await this.readFileOrUndefined(this.settingsPath);
    if (raw === undefined) return { ...DEFAULT_AI_SETTINGS };
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      throw new AiError('AI_SETTINGS_READ_FAILED', 'AI 设置文件已损坏');
    }
    const parsed = PersistedAiSettingsSchema.safeParse(json);
    if (!parsed.success) throw new AiError('AI_SETTINGS_READ_FAILED', 'AI 设置文件格式不正确');
    return parsed.data;
  }

  async writeSettings(settings: PersistedAiSettings): Promise<void> {
    const parsed = PersistedAiSettingsSchema.safeParse(settings);
    if (!parsed.success) throw new AiError('AI_SETTINGS_WRITE_FAILED', 'AI 设置数据无效');
    try {
      await writeAtomic(this.settingsPath, `${JSON.stringify(parsed.data, null, 2)}\n`, { dirMode: DIR_MODE });
    } catch {
      throw new AiError('AI_SETTINGS_WRITE_FAILED', '无法写入 AI 设置');
    }
  }

  async hasApiKey(): Promise<boolean> {
    return this.fileExists(this.credentialsPath);
  }

  async readApiKey(): Promise<string | undefined> {
    const raw = await this.readFileOrUndefined(this.credentialsPath);
    if (raw === undefined) return undefined;
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      throw new AiError('AI_SETTINGS_READ_FAILED', '凭据文件已损坏');
    }
    const parsed = PersistedAiCredentialsSchema.safeParse(json);
    if (!parsed.success) throw new AiError('AI_SETTINGS_READ_FAILED', '凭据文件格式不正确');
    return parsed.data.apiKey;
  }

  async writeApiKey(apiKey: string): Promise<void> {
    const body = JSON.stringify({ version: AI_CREDENTIALS_VERSION, apiKey }, null, 2);
    try {
      await writeAtomic(this.credentialsPath, `${body}\n`, { dirMode: DIR_MODE, fileMode: CREDENTIAL_MODE });
    } catch {
      throw new AiError('AI_SETTINGS_WRITE_FAILED', '无法写入 API 密钥');
    }
  }

  async clearApiKey(): Promise<void> {
    try {
      await rm(this.credentialsPath, { force: true });
    } catch {
      throw new AiError('AI_SETTINGS_WRITE_FAILED', '无法删除 API 密钥');
    }
  }

  private async readFileOrUndefined(path: string): Promise<string | undefined> {
    try {
      return await readFile(path, 'utf8');
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
      throw new AiError('AI_SETTINGS_READ_FAILED', '无法读取 AI 配置');
    }
  }

  private async fileExists(path: string): Promise<boolean> {
    return (await this.readFileOrUndefined(path)) !== undefined;
  }
}
