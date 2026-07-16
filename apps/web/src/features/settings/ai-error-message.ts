import { ApiError } from '../../api/client.js';

const MESSAGES: Record<string, string> = {
  AI_API_KEY_REQUIRED: '请先填写 API 密钥。',
  AI_AUTH_FAILED: 'API 密钥无效或已过期，请检查后重试。',
  AI_ACCESS_DENIED: '当前密钥没有访问该模型或接口的权限。',
  AI_MODEL_NOT_FOUND: '找不到该模型，请确认模型名称与服务商文档一致。',
  AI_RATE_LIMITED: '请求过于频繁或额度已用尽，请稍后再试。',
  AI_CONNECTION_FAILED: '无法连接到该地址，请检查网络与 API 地址。',
  AI_TIMEOUT: '连接超时，请稍后重试或确认服务是否可达。',
  AI_UPSTREAM_ERROR: '上游服务返回了错误，请稍后重试。',
  AI_INVALID_RESPONSE: '服务返回的内容无法解析，请确认地址与模型是否为 OpenAI 兼容接口。',
  AI_SETTINGS_READ_FAILED: '读取本地 AI 配置失败，配置文件可能已损坏。',
  AI_SETTINGS_WRITE_FAILED: '保存本地 AI 配置失败，请检查磁盘权限。',
  AI_SETTINGS_INVALID: '提交的配置无效，请检查各字段。',
  INVALID_INPUT: '表单填写有误，请检查各字段。'
};

/** Translate an error (typically an ApiError code) into an actionable Chinese message. */
export function aiErrorMessage(error: unknown, fallback = '操作失败，请稍后重试。'): string {
  if (error instanceof ApiError) {
    return MESSAGES[error.code] ?? error.message ?? fallback;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
