import { join } from 'node:path';
import { z } from 'zod';
import { SuggestionSchema, type Suggestion } from '@pnode/core';
import { JsonStore } from './json-store.js';

const SuggestionListSchema = z.array(SuggestionSchema);

export class SuggestionStore {
  private readonly file: JsonStore<Suggestion[]>;

  constructor(root: string) {
    this.file = new JsonStore(
      join(root, '.pnode', 'suggestions', 'index.json'),
      SuggestionListSchema,
      []
    );
  }

  async list(discussionId?: string): Promise<Suggestion[]> {
    const suggestions = await this.file.read();
    return discussionId
      ? suggestions.filter((suggestion) => suggestion.discussionId === discussionId)
      : suggestions;
  }

  async get(id: string): Promise<Suggestion> {
    const suggestion = (await this.file.read()).find((item) => item.id === id);
    if (!suggestion) throw new Error('SUGGESTION_NOT_FOUND');
    return suggestion;
  }

  async save(suggestion: Suggestion): Promise<Suggestion> {
    const parsed = SuggestionSchema.parse(suggestion);
    const suggestions = await this.file.read();
    const index = suggestions.findIndex((item) => item.id === parsed.id);
    if (index >= 0) suggestions[index] = parsed;
    else suggestions.push(parsed);
    await this.file.write(suggestions);
    return parsed;
  }
}
