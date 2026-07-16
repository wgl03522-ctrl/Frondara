import type { AiProvider, AiRequest, AiResult } from './ai-provider.js';

const revisionPattern = /检查|论证|改写|修改|建议|引用|improve|revise|argument/i;

export class DemoAiProvider implements AiProvider {
  async complete(request: AiRequest): Promise<AiResult> {
    const historyCount = request.history?.length ?? 0;
    const answer = `当前表述的结论强度可能超过已提供证据。建议明确测量范围，并将“证明”调整为更谨慎的“结果表明”。已读取 ${request.contexts.length} 项显式上下文、${historyCount} 轮历史对话。`;
    if (!revisionPattern.test(request.question)) return { answer };
    return {
      answer,
      suggestion: {
        originalText: request.quote,
        suggestedText: request.quote.replace('证明', '结果表明').replace('显著提高', '可能有助于改善')
      }
    };
  }
}
