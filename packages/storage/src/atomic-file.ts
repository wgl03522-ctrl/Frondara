import { randomUUID } from 'node:crypto';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export interface WriteAtomicOptions {
  /** Directory permission for created parents (best effort; ignored where unsupported). */
  dirMode?: number;
  /** File permission for the written file (best effort; ignored where unsupported). */
  fileMode?: number;
}

export async function writeAtomic(path: string, content: string, options: WriteAtomicOptions = {}): Promise<void> {
  await mkdir(dirname(path), { recursive: true, ...(options.dirMode !== undefined ? { mode: options.dirMode } : {}) });
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, content, options.fileMode !== undefined ? { encoding: 'utf8', mode: options.fileMode } : 'utf8');
  try {
    await rename(temporary, path);
  } catch (error: unknown) {
    await rm(temporary, { force: true });
    throw error;
  }
}
