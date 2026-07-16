import { expect, it } from 'vitest';
import { resolveWorkspacePath } from '../src/index.js';

it('resolves paths inside the workspace', () => {
  expect(resolveWorkspacePath('C:/workspace', 'Paper/main.md').replaceAll('\\', '/'))
    .toBe('C:/workspace/Paper/main.md');
});

it('rejects relative and absolute paths outside the workspace', () => {
  expect(() => resolveWorkspacePath('C:/workspace', '../secret.txt')).toThrow('PATH_OUTSIDE_WORKSPACE');
  expect(() => resolveWorkspacePath('C:/workspace', 'C:/secret.txt')).toThrow('PATH_OUTSIDE_WORKSPACE');
});
