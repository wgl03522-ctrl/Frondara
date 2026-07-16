import { isAbsolute, relative, resolve } from 'node:path';

export function resolveWorkspacePath(root: string, relativePath: string): string {
  if (!relativePath || isAbsolute(relativePath) || /^[A-Za-z]:[\\/]/.test(relativePath)) {
    throw new Error('PATH_OUTSIDE_WORKSPACE');
  }
  const resolvedRoot = resolve(root);
  const candidate = resolve(resolvedRoot, relativePath);
  const fromRoot = relative(resolvedRoot, candidate);
  if (fromRoot === '..' || fromRoot.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) || isAbsolute(fromRoot)) {
    throw new Error('PATH_OUTSIDE_WORKSPACE');
  }
  return candidate;
}

export function toWorkspacePath(path: string): string {
  return path.replaceAll('\\', '/');
}
