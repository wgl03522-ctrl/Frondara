export interface AiContext {
  label: string;
  content: string;
}

export interface AiTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiRequest {
  question: string;
  quote: string;
  contexts: AiContext[];
  // Prior turns in this discussion, oldest first. Expanded into real chat
  // messages by the provider so the model has conversational memory.
  history?: AiTurn[];
}

export interface AiResult {
  answer: string;
  suggestion?: {
    originalText: string;
    suggestedText: string;
  };
}

export interface AiProvider {
  complete(request: AiRequest): Promise<AiResult>;
}
