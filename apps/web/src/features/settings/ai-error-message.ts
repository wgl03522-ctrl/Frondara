import { ApiError } from '../../api/client.js';
import { translate, type Locale, type MessageKey } from '../../i18n/messages.js';

const ERROR_KEYS: Record<string, MessageKey> = {
  AI_API_KEY_REQUIRED: 'error.AI_API_KEY_REQUIRED',
  AI_AUTH_FAILED: 'error.AI_AUTH_FAILED',
  AI_ACCESS_DENIED: 'error.AI_ACCESS_DENIED',
  AI_MODEL_NOT_FOUND: 'error.AI_MODEL_NOT_FOUND',
  AI_RATE_LIMITED: 'error.AI_RATE_LIMITED',
  AI_CONNECTION_FAILED: 'error.AI_CONNECTION_FAILED',
  AI_TIMEOUT: 'error.AI_TIMEOUT',
  AI_UPSTREAM_ERROR: 'error.AI_UPSTREAM_ERROR',
  AI_INVALID_RESPONSE: 'error.AI_INVALID_RESPONSE',
  AI_SETTINGS_READ_FAILED: 'error.AI_SETTINGS_READ_FAILED',
  AI_SETTINGS_WRITE_FAILED: 'error.AI_SETTINGS_WRITE_FAILED',
  AI_SETTINGS_INVALID: 'error.AI_SETTINGS_INVALID',
  INVALID_INPUT: 'error.INVALID_INPUT'
};

export function aiErrorMessage(error: unknown, locale: Locale, fallback?: string): string {
  if (error instanceof ApiError) {
    const key = ERROR_KEYS[error.code];
    return key ? translate(locale, key) : error.message || fallback || translate(locale, 'error.generic');
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback ?? translate(locale, 'error.generic');
}
