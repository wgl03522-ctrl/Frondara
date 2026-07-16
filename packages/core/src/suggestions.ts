export interface PositionedSuggestionBlock {
  id: string;
  from: number;
  to: number;
  originalText: string;
  suggestedText: string;
}

export function applySuggestion(
  document: string,
  from: number,
  to: number,
  expected: string,
  replacement: string
): string {
  if (from < 0 || to < from || document.slice(from, to) !== expected) {
    throw new Error('TARGET_MISMATCH');
  }
  return document.slice(0, from) + replacement + document.slice(to);
}

export function applySuggestionBlocks(
  document: string,
  blocks: PositionedSuggestionBlock[],
  selectedBlockIds: string[]
): string {
  const selected = new Set(selectedBlockIds);
  return blocks
    .filter((block) => selected.has(block.id))
    .slice()
    .sort((left, right) => right.from - left.from)
    .reduce(
      (content, block) => applySuggestion(
        content,
        block.from,
        block.to,
        block.originalText,
        block.suggestedText
      ),
      document
    );
}
