import { describe, expect, it } from 'vitest';
import { ApiError } from '../src/api/client.js';
import { aiErrorMessage } from '../src/features/settings/ai-error-message.js';

describe('AI error localization', () => {
  it('uses stable error codes in Chinese and English', () => {
    const error = new ApiError(401, 'AI_AUTH_FAILED', 'server message');
    expect(aiErrorMessage(error, 'zh-CN')).toContain('API 密钥无效');
    expect(aiErrorMessage(error, 'en-US')).toContain('API key is invalid');
  });

  it('keeps an unmapped server message', () => {
    const error = new ApiError(500, 'UNKNOWN_CODE', 'provider-specific detail');
    expect(aiErrorMessage(error, 'en-US')).toBe('provider-specific detail');
  });
});
