export type AiErrorCode =
  | 'AI_API_KEY_REQUIRED'
  | 'AI_AUTH_FAILED'
  | 'AI_ACCESS_DENIED'
  | 'AI_MODEL_NOT_FOUND'
  | 'AI_RATE_LIMITED'
  | 'AI_CONNECTION_FAILED'
  | 'AI_TIMEOUT'
  | 'AI_UPSTREAM_ERROR'
  | 'AI_INVALID_RESPONSE'
  | 'AI_SETTINGS_READ_FAILED'
  | 'AI_SETTINGS_WRITE_FAILED'
  | 'AI_SETTINGS_INVALID';

/**
 * Carries a stable, client-facing code. The message is safe to surface: callers
 * must never place API keys, key fragments, credential paths, or raw upstream
 * bodies into it.
 */
export class AiError extends Error {
  constructor(
    readonly code: AiErrorCode,
    message?: string
  ) {
    super(message ?? code);
    this.name = 'AiError';
  }
}

export function isAiError(value: unknown): value is AiError {
  return value instanceof AiError;
}

/** Map an upstream HTTP status to a stable code. */
export function codeForUpstreamStatus(status: number): AiErrorCode {
  if (status === 401) return 'AI_AUTH_FAILED';
  if (status === 403) return 'AI_ACCESS_DENIED';
  if (status === 404) return 'AI_MODEL_NOT_FOUND';
  if (status === 429) return 'AI_RATE_LIMITED';
  if (status >= 500) return 'AI_UPSTREAM_ERROR';
  return 'AI_UPSTREAM_ERROR';
}

/** Map a stable AI error code to an HTTP status for our own API responses. */
export function httpStatusForAiCode(code: AiErrorCode): number {
  switch (code) {
    case 'AI_API_KEY_REQUIRED':
    case 'AI_SETTINGS_INVALID':
      return 400;
    case 'AI_AUTH_FAILED':
      return 401;
    case 'AI_ACCESS_DENIED':
      return 403;
    case 'AI_MODEL_NOT_FOUND':
      return 404;
    case 'AI_RATE_LIMITED':
      return 429;
    case 'AI_TIMEOUT':
      return 504;
    case 'AI_CONNECTION_FAILED':
    case 'AI_UPSTREAM_ERROR':
      return 502;
    case 'AI_INVALID_RESPONSE':
      return 502;
    case 'AI_SETTINGS_READ_FAILED':
    case 'AI_SETTINGS_WRITE_FAILED':
      return 500;
    default:
      return 500;
  }
}
