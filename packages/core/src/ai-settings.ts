import { z } from 'zod';

export type AiMode = 'demo' | 'compatible';

export const AI_SETTINGS_VERSION = 1;
export const AI_CREDENTIALS_VERSION = 1;

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/**
 * Validate and canonicalize an OpenAI-compatible base URL. Throws a message that
 * the caller maps to a stable AI_* error. Enforces the security boundary: remote
 * endpoints must be HTTPS, only loopback may be HTTP, no embedded credentials, and
 * the caller must not pre-attach the chat endpoint.
 */
export function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error('API 地址不能为空');

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error('API 地址格式无效');
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('API 地址必须使用 http 或 https');
  }
  if (url.username || url.password) {
    throw new Error('API 地址不能内嵌用户名或密码（credential）');
  }

  const host = url.hostname.toLowerCase();
  const isLoopback = LOOPBACK_HOSTS.has(host) || LOOPBACK_HOSTS.has(`[${host}]`);
  if (url.protocol === 'http:' && !isLoopback) {
    throw new Error('远程 API 地址必须使用 HTTPS');
  }

  if (/\/chat\/completions\/?$/i.test(url.pathname)) {
    throw new Error('API 地址请填写基础路径，不要包含 /chat/completions');
  }

  if (!url.pathname.endsWith('/')) url.pathname = `${url.pathname}/`;
  url.search = '';
  url.hash = '';
  return url.href;
}

const OptionalBaseUrl = z
  .string()
  .transform((value) => value.trim())
  .transform((value, ctx) => {
    if (!value) return '';
    try {
      return normalizeBaseUrl(value);
    } catch (error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: error instanceof Error ? error.message : 'API 地址无效'
      });
      return z.NEVER;
    }
  });

export const PersistedAiSettingsSchema = z.object({
  version: z.literal(AI_SETTINGS_VERSION),
  mode: z.enum(['demo', 'compatible']),
  baseUrl: z.string(),
  model: z.string()
});

export const DEFAULT_AI_SETTINGS: PersistedAiSettings = {
  version: AI_SETTINGS_VERSION,
  mode: 'demo',
  baseUrl: '',
  model: ''
};

export const PersistedAiCredentialsSchema = z.object({
  version: z.literal(AI_CREDENTIALS_VERSION),
  apiKey: z.string().min(1)
});

export const PublicAiSettingsSchema = z.object({
  mode: z.enum(['demo', 'compatible']),
  baseUrl: z.string(),
  model: z.string(),
  hasApiKey: z.boolean()
});

export const AiSettingsUpdateSchema = z
  .object({
    mode: z.enum(['demo', 'compatible']),
    baseUrl: OptionalBaseUrl,
    model: z.string().transform((value) => value.trim()),
    apiKey: z.string().min(1).optional(),
    clearApiKey: z.boolean().optional()
  })
  .superRefine((value, ctx) => {
    if (value.apiKey && value.clearApiKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['clearApiKey'],
        message: '不能同时提交新密钥和清除密钥'
      });
    }
    if (value.mode === 'compatible') {
      if (!value.baseUrl) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['baseUrl'], message: '兼容模式必须填写 API 地址' });
      }
      if (!value.model) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['model'], message: '兼容模式必须填写模型名称' });
      }
    }
  });

export const AiConnectionTestSchema = z.object({
  baseUrl: OptionalBaseUrl.refine((value) => value.length > 0, { message: '请填写 API 地址' }),
  model: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, { message: '请填写模型名称' }),
  apiKey: z.string().min(1).optional()
});

export type PersistedAiSettings = z.infer<typeof PersistedAiSettingsSchema>;
export type PersistedAiCredentials = z.infer<typeof PersistedAiCredentialsSchema>;
export type PublicAiSettings = z.infer<typeof PublicAiSettingsSchema>;
export type AiSettingsUpdate = z.infer<typeof AiSettingsUpdateSchema>;
export type AiConnectionTest = z.infer<typeof AiConnectionTestSchema>;
