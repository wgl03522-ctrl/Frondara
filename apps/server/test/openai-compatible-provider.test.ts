import { describe, expect, it, vi } from 'vitest';
import { AiError } from '../src/services/ai-errors.js';
import { OpenAiCompatibleProvider } from '../src/services/openai-compatible-provider.js';

function jsonResponse(body: unknown, init: { status?: number } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json' }
  });
}

function completion(content: string): unknown {
  return { choices: [{ message: { content } }] };
}

const baseUrl = 'https://api.example.com/v1/';

describe('OpenAiCompatibleProvider.complete', () => {
  it('posts to the chat/completions endpoint with a bearer header', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(completion(JSON.stringify({ answer: '好的' })))
    );
    const provider = new OpenAiCompatibleProvider(baseUrl, 'demo-model', 'k-secret', { fetch: fetchMock });

    const result = await provider.complete({ question: 'q', quote: 'x', contexts: [] });

    expect(result.answer).toBe('好的');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.example.com/v1/chat/completions');
    expect((init as RequestInit).headers).toMatchObject({ authorization: 'Bearer k-secret' });
  });

  it('expands history into multi-turn messages with the question as a plain final user turn', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(completion(JSON.stringify({ answer: '好的' })))
    );
    const provider = new OpenAiCompatibleProvider(baseUrl, 'demo-model', 'k', { fetch: fetchMock });

    await provider.complete({
      question: '再展开讲讲',
      quote: '选定段落',
      contexts: [{ label: '选定段落', content: '选定段落' }],
      history: [
        { role: 'user', content: '第一个问题' },
        { role: 'assistant', content: '第一个回答' }
      ]
    });

    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    const messages = body.messages as Array<{ role: string; content: string }>;
    // system (with folded context) + two history turns + the plain question.
    expect(messages.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'user']);
    expect(messages[0]!.content).toContain('选定段落');
    expect(messages[1]!.content).toBe('第一个问题');
    expect(messages[2]!.content).toBe('第一个回答');
    // The current question is sent verbatim, not JSON-encoded.
    expect(messages[3]!.content).toBe('再展开讲讲');
  });

  it('parses and validates the returned JSON payload', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(completion(JSON.stringify({
        answer: '答复',
        suggestion: { originalText: '旧', suggestedText: '新' }
      })))
    );
    const provider = new OpenAiCompatibleProvider(baseUrl, 'demo-model', 'k', { fetch: fetchMock });

    const result = await provider.complete({ question: 'q', quote: 'x', contexts: [] });

    expect(result.suggestion).toEqual({ originalText: '旧', suggestedText: '新' });
  });

  it('retries once without response_format on a 400 then succeeds', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'bad' }, { status: 400 }))
      .mockResolvedValueOnce(jsonResponse(completion(JSON.stringify({ answer: '回退成功' }))));
    const provider = new OpenAiCompatibleProvider(baseUrl, 'demo-model', 'k', { fetch: fetchMock });

    const result = await provider.complete({ question: 'q', quote: 'x', contexts: [] });

    expect(result.answer).toBe('回退成功');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstBody = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    const secondBody = JSON.parse((fetchMock.mock.calls[1]![1] as RequestInit).body as string);
    expect(firstBody.response_format).toEqual({ type: 'json_object' });
    expect(secondBody.response_format).toBeUndefined();
  });

  it('retries once without response_format on a 422', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'unprocessable' }, { status: 422 }))
      .mockResolvedValueOnce(jsonResponse(completion(JSON.stringify({ answer: 'ok' }))));
    const provider = new OpenAiCompatibleProvider(baseUrl, 'demo-model', 'k', { fetch: fetchMock });

    await provider.complete({ question: 'q', quote: 'x', contexts: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry on 401 and maps to AI_AUTH_FAILED', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ error: 'nope' }, { status: 401 }));
    const provider = new OpenAiCompatibleProvider(baseUrl, 'demo-model', 'k', { fetch: fetchMock });

    await expect(provider.complete({ question: 'q', quote: 'x', contexts: [] }))
      .rejects.toMatchObject({ code: 'AI_AUTH_FAILED' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('maps 403/404/429/500 to stable codes without retrying', async () => {
    const cases: Array<[number, string]> = [
      [403, 'AI_ACCESS_DENIED'],
      [404, 'AI_MODEL_NOT_FOUND'],
      [429, 'AI_RATE_LIMITED'],
      [500, 'AI_UPSTREAM_ERROR']
    ];
    for (const [status, code] of cases) {
      const fetchMock = vi.fn(async () => jsonResponse({ error: 'x' }, { status }));
      const provider = new OpenAiCompatibleProvider(baseUrl, 'demo-model', 'k', { fetch: fetchMock });
      await expect(provider.complete({ question: 'q', quote: 'x', contexts: [] }))
        .rejects.toMatchObject({ code });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    }
  });

  it('maps a network failure to AI_CONNECTION_FAILED', async () => {
    const fetchMock = vi.fn(async () => { throw new TypeError('fetch failed'); });
    const provider = new OpenAiCompatibleProvider(baseUrl, 'demo-model', 'k', { fetch: fetchMock });
    await expect(provider.complete({ question: 'q', quote: 'x', contexts: [] }))
      .rejects.toMatchObject({ code: 'AI_CONNECTION_FAILED' });
  });

  it('maps an abort/timeout to AI_TIMEOUT', async () => {
    const fetchMock = vi.fn(async () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      throw error;
    });
    const provider = new OpenAiCompatibleProvider(baseUrl, 'demo-model', 'k', { fetch: fetchMock, timeoutMs: 10 });
    await expect(provider.complete({ question: 'q', quote: 'x', contexts: [] }))
      .rejects.toMatchObject({ code: 'AI_TIMEOUT' });
  });

  it('keeps the answer and drops a malformed (string) suggestion instead of failing', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(completion(JSON.stringify({ answer: '答复', suggestion: '改写后的整句' })))
    );
    const provider = new OpenAiCompatibleProvider(baseUrl, 'demo-model', 'k', { fetch: fetchMock });

    const result = await provider.complete({ question: 'q', quote: 'x', contexts: [] });
    expect(result.answer).toBe('答复');
    expect(result.suggestion).toBeUndefined();
  });

  it('maps unparseable content to AI_INVALID_RESPONSE', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(completion('this is not json')));
    const provider = new OpenAiCompatibleProvider(baseUrl, 'demo-model', 'k', { fetch: fetchMock });
    await expect(provider.complete({ question: 'q', quote: 'x', contexts: [] }))
      .rejects.toMatchObject({ code: 'AI_INVALID_RESPONSE' });
  });

  it('never leaks the api key in a thrown error', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ error: 'k-secret leaked?' }, { status: 500 }));
    const provider = new OpenAiCompatibleProvider(baseUrl, 'demo-model', 'k-secret', { fetch: fetchMock });
    const error = await provider.complete({ question: 'q', quote: 'x', contexts: [] }).catch((caught) => caught);
    expect(error).toBeInstanceOf(AiError);
    expect(JSON.stringify({ message: error.message, code: error.code })).not.toContain('k-secret');
  });
});

describe('OpenAiCompatibleProvider.testConnection', () => {
  it('returns ok with model and latency when assistant content is non-empty', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(completion('hi there')));
    const provider = new OpenAiCompatibleProvider(baseUrl, 'demo-model', 'k', { fetch: fetchMock });

    const result = await provider.testConnection();
    expect(result.ok).toBe(true);
    expect(result.model).toBe('demo-model');
    expect(typeof result.latencyMs).toBe('number');
  });

  it('does not require JSON content', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(completion('plain prose, not json')));
    const provider = new OpenAiCompatibleProvider(baseUrl, 'demo-model', 'k', { fetch: fetchMock });
    await expect(provider.testConnection()).resolves.toMatchObject({ ok: true });
  });

  it('maps auth failure during a connection test', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ error: 'x' }, { status: 401 }));
    const provider = new OpenAiCompatibleProvider(baseUrl, 'demo-model', 'k', { fetch: fetchMock });
    await expect(provider.testConnection()).rejects.toMatchObject({ code: 'AI_AUTH_FAILED' });
  });

  it('rejects an empty assistant message as AI_INVALID_RESPONSE', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(completion('')));
    const provider = new OpenAiCompatibleProvider(baseUrl, 'demo-model', 'k', { fetch: fetchMock });
    await expect(provider.testConnection()).rejects.toMatchObject({ code: 'AI_INVALID_RESPONSE' });
  });

  it('accepts a reasoning-only reply (empty content, non-empty reasoning_content)', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ choices: [{ message: { content: '', reasoning_content: 'thinking about pong' } }] })
    );
    const provider = new OpenAiCompatibleProvider(baseUrl, 'reasoner-model', 'k', { fetch: fetchMock });
    await expect(provider.testConnection()).resolves.toMatchObject({ ok: true, model: 'reasoner-model' });
  });

  it('does not cap max_tokens so reasoning models can produce output', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(completion('ok')));
    const provider = new OpenAiCompatibleProvider(baseUrl, 'reasoner-model', 'k', { fetch: fetchMock });
    await provider.testConnection();
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.max_tokens).toBeUndefined();
  });
});

describe('OpenAiCompatibleProvider JSON tolerance', () => {
  it('parses JSON wrapped in a ```json markdown fence', async () => {
    const fenced = '```json\n{"answer":"围栏内的答复"}\n```';
    const fetchMock = vi.fn(async () => jsonResponse(completion(fenced)));
    const provider = new OpenAiCompatibleProvider(baseUrl, 'demo-model', 'k', { fetch: fetchMock });
    const result = await provider.complete({ question: 'q', quote: 'x', contexts: [] });
    expect(result.answer).toBe('围栏内的答复');
  });

  it('extracts the first JSON object when surrounded by prose', async () => {
    const noisy = '好的，结果如下：{"answer":"夹在文字中的答复"} 以上。';
    const fetchMock = vi.fn(async () => jsonResponse(completion(noisy)));
    const provider = new OpenAiCompatibleProvider(baseUrl, 'demo-model', 'k', { fetch: fetchMock });
    const result = await provider.complete({ question: 'q', quote: 'x', contexts: [] });
    expect(result.answer).toBe('夹在文字中的答复');
  });
});
