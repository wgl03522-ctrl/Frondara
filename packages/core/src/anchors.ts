import type { TextAnchor } from './schemas.js';

export interface AnchorCandidate {
  from: number;
  to: number;
  confidence: number;
}

export type AnchorResolution =
  | ({ status: 'resolved' } & AnchorCandidate)
  | { status: 'ambiguous'; candidates: AnchorCandidate[] }
  | { status: 'missing'; candidates: [] };

export function resolveAnchor(text: string, anchor: TextAnchor): AnchorResolution {
  const positions: number[] = [];
  for (
    let position = text.indexOf(anchor.quote);
    position >= 0;
    position = text.indexOf(anchor.quote, position + 1)
  ) {
    positions.push(position);
  }

  if (positions.length === 1) {
    const from = positions[0]!;
    return { status: 'resolved', from, to: from + anchor.quote.length, confidence: 1 };
  }

  const candidates = positions.map((from) => {
    const prefixMatches = anchor.prefix.length > 0
      && text.slice(Math.max(0, from - anchor.prefix.length), from) === anchor.prefix;
    const suffixMatches = anchor.suffix.length > 0
      && text.slice(from + anchor.quote.length, from + anchor.quote.length + anchor.suffix.length) === anchor.suffix;
    const contextParts = Number(anchor.prefix.length > 0) + Number(anchor.suffix.length > 0);
    const matchedParts = Number(prefixMatches) + Number(suffixMatches);
    const confidence = contextParts === 0 ? 0.5 : 0.5 + (matchedParts / contextParts) * 0.5;
    return { from, to: from + anchor.quote.length, confidence };
  });

  const uniquelyMatched = candidates.filter((candidate) => candidate.confidence === 1);
  if (uniquelyMatched.length === 1) {
    return { status: 'resolved', ...uniquelyMatched[0]! };
  }

  return candidates.length > 0
    ? { status: 'ambiguous', candidates }
    : { status: 'missing', candidates: [] };
}
