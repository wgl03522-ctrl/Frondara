import { expect, it } from 'vitest';
import { resolveAnchor } from '../src/index.js';

it('resolves a unique quote before using context matching', () => {
  const text = '# 结果\n\n前文 原文 后文';
  const result = resolveAnchor(text, {
    documentPath: 'Paper/main.md',
    quote: '原文',
    prefix: '前文 ',
    suffix: ' 后文',
    headingPath: ['结果'],
    documentVersionId: 'v1'
  });
  expect(result).toEqual({ status: 'resolved', from: 9, to: 11, confidence: 1 });
});

it('uses prefix and suffix to disambiguate duplicated quotes', () => {
  const result = resolveAnchor('甲 原文 后文；前文 原文 乙', {
    documentPath: 'x.md',
    quote: '原文',
    prefix: '前文 ',
    suffix: ' 乙',
    headingPath: [],
    documentVersionId: 'v1'
  });
  expect(result.status).toBe('resolved');
  if (result.status === 'resolved') expect(result.confidence).toBe(1);
});

it('returns candidates rather than silently choosing duplicated text', () => {
  const result = resolveAnchor('原文 A 原文 B', {
    documentPath: 'x.md', quote: '原文', prefix: '', suffix: '', headingPath: [], documentVersionId: 'v1'
  });
  expect(result.status).toBe('ambiguous');
});
