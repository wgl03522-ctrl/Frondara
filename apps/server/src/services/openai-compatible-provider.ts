import { z } from 'zod';
import type { AiContext, AiProvider, AiRequest, AiResult } from './ai-provider.js';
import { AiError, codeForUpstreamStatus } from './ai-errors.js';

const ResultSchema = z.object({
  answer: z.string(),
  // A valid answer must never be discarded because of a malformed suggestion:
  // if the model returns a differently-shaped suggestion (e.g. a bare string),
  // degrade to answer-only rather than failing the whole response.
  suggestion: z.object({
    originalText: z.string(),
    suggestedText: z.string()
  }).optional().catch(undefined)
});

const CompletionEnvelopeSchema = z.object({
  choices: z.array(z.object({
    message: z.object({
      content: z.string().nullish(),
      reasoning_content: z.string().nullish()
    })
  })).min(1)
});

interface AssistantMessage {
  content: string;
  reasoning: string;
}

const SYSTEM_PROMPT =
  'You are a research writing assistant. Reply with a JSON object shaped exactly as ' +
  '{"answer": string, "suggestion"?: {"originalText": string, "suggestedText": string}}. ' +
  '"answer" is required. Include "suggestion" only when proposing a concrete rewrite, and then ' +
  '"originalText" must be the exact text to replace and "suggestedText" the replacement. ' +
  'Do not use any other shape for suggestion. Never modify text without a user request.';

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export interface OpenAiCompatibleOptions {
  fetch?: FetchLike;
  timeoutMs?: number;
}

export interface ConnectionTestResult {
  ok: boolean;
  model: string;
  latencyMs: number;
}

export class OpenAiCompatibleProvider implements AiProvider {
  private readonly endpoint: string;
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;

  constructor(
    baseUrl: string,
    private readonly model: string,
    private readonly apiKey: string,
    options: OpenAiCompatibleOptions = {}
  ) {
    this.endpoint = new URL('chat/completions', baseUrl).href;
    this.fetchImpl = options.fetch ?? ((input, init) => fetch(input, init));
    this.timeoutMs = options.timeoutMs ?? 60_000;
  }

  async complete(request: AiRequest): Promise<AiResult> {
    const content = await this.requestJsonContent(request);
    const parsed = this.parseResult(content);
    return parsed.suggestion
      ? { answer: parsed.answer, suggestion: parsed.suggestion }
      : { answer: parsed.answer };
  }

  async testConnection(): Promise<ConnectionTestResult> {
    const started = Date.now();
    // No max_tokens cap: reasoning models spend the budget on reasoning_content
    // first and would otherwise be truncated before producing visible content.
    const response = await this.send({
      model: this.model,
      messages: [
        { role: 'system', content: 'Reply with a short acknowledgement.' },
        { role: 'user', content: 'ping' }
      ],
      stream: false
    }, 15_000);
    if (!response.ok) throw this.errorForStatus(response.status);
    const message = await this.readAssistantMessage(response);
    // Either visible content or reasoning output proves auth, model and endpoint
    // are all working; the connection test does not require JSON.
    if (!message.content.trim() && !message.reasoning.trim()) {
      throw new AiError('AI_INVALID_RESPONSE', '连接测试未返回有效内容');
    }
    return { ok: true, model: this.model, latencyMs: Date.now() - started };
  }

  private async requestJsonContent(request: AiRequest): Promise<string> {
    const payload = {
      model: this.model,
      messages: buildMessages(request),
      stream: false
    };

    let response = await this.send({ ...payload, response_format: { type: 'json_object' } }, this.timeoutMs);
    if (!response.ok && (response.status === 400 || response.status === 422)) {
      response = await this.send(payload, this.timeoutMs);
    }
    if (!response.ok) throw this.errorForStatus(response.status);
    return (await this.readAssistantMessage(response)).content;
  }

  private async send(body: Record<string, unknown>, timeoutMs: number): Promise<Response> {
    try {
      return await this.fetchImpl(this.endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs)
      });
    } catch (error: unknown) {
      throw this.errorForTransport(error);
    }
  }

  private async readAssistantMessage(response: Response): Promise<AssistantMessage> {
    let json: unknown;
    try {
      json = await response.json();
    } catch {
      throw new AiError('AI_INVALID_RESPONSE', '上游返回了无法解析的响应');
    }
    const envelope = CompletionEnvelopeSchema.safeParse(json);
    if (!envelope.success) throw new AiError('AI_INVALID_RESPONSE', '上游响应结构不符合预期');
    const message = envelope.data.choices[0]!.message;
    return { content: message.content ?? '', reasoning: message.reasoning_content ?? '' };
  }

  private parseResult(content: string): z.infer<typeof ResultSchema> {
    const raw = this.parseJsonContent(content);
    const parsed = ResultSchema.safeParse(raw);
    if (!parsed.success) throw new AiError('AI_INVALID_RESPONSE', '模型返回的 JSON 缺少必要字段');
    return parsed.data;
  }

  // Reasoning models and some providers wrap JSON in ```json fences; tolerate that
  // and fall back to the first {...} span before giving up.
  private parseJsonContent(content: string): unknown {
    const attempts = [content, stripCodeFence(content), extractFirstJsonObject(content)];
    for (const candidate of attempts) {
      if (!candidate) continue;
      try {
        return JSON.parse(candidate);
      } catch {
        continue;
      }
    }
    throw new AiError('AI_INVALID_RESPONSE', '模型未返回有效 JSON');
  }

  private errorForStatus(status: number): AiError {
    return new AiError(codeForUpstreamStatus(status), `上游服务返回状态 ${status}`);
  }

  private errorForTransport(error: unknown): AiError {
    if (error instanceof AiError) return error;
    if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
      return new AiError('AI_TIMEOUT', '连接上游服务超时');
    }
    return new AiError('AI_CONNECTION_FAILED', '无法连接到上游服务');
  }
}

// Assemble the chat messages sent to the model. The prior discussion turns are
// expanded into real user/assistant messages (giving the model memory of the
// conversation), the reference material (selected paragraph, full document, other
// files/discussions) is folded into the system prompt so we never send two user
// messages back-to-back, and the current question goes last as plain text.
function buildMessages(request: AiRequest): Array<{ role: string; content: string }> {
  const system = request.contexts.length > 0
    ? `${SYSTEM_PROMPT}\n\n${formatContextBlock(request.contexts)}`
    : SYSTEM_PROMPT;
  const messages: Array<{ role: string; content: string }> = [{ role: 'system', content: system }];
  for (const turn of request.history ?? []) {
    messages.push({ role: turn.role, content: turn.content });
  }
  messages.push({ role: 'user', content: request.question });
  return messages;
}

function formatContextBlock(contexts: AiContext[]): string {
  const blocks = contexts.map((context) => `### ${context.label}\n${context.content}`).join('\n\n');
  return `以下是供参考的材料，请在回答时结合它们：\n\n${blocks}`;
}

/** Strip a leading/trailing ```json (or ```) fence if the whole string is fenced. */
function stripCodeFence(content: string): string {
  const match = content.trim().match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i);
  return match ? match[1]!.trim() : '';
}

/** Extract the first balanced {...} span, tolerating prose around the JSON. */
function extractFirstJsonObject(content: string): string {
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return '';
  return content.slice(start, end + 1);
}
