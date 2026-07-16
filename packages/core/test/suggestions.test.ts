import { expect, it } from 'vitest';
import { applySuggestion, applySuggestionBlocks } from '../src/index.js';

it('applies only when the expected original text still matches', () => {
  expect(applySuggestion('abc old xyz', 4, 7, 'old', 'new')).toBe('abc new xyz');
  expect(() => applySuggestion('abc changed xyz', 4, 7, 'old', 'new')).toThrow('TARGET_MISMATCH');
});

it('applies selected blocks from right to left', () => {
  expect(applySuggestionBlocks('one two three', [
    { id: 'b1', from: 0, to: 3, originalText: 'one', suggestedText: '1' },
    { id: 'b2', from: 8, to: 13, originalText: 'three', suggestedText: '3' }
  ], ['b1', 'b2'])).toBe('1 two 3');
});
