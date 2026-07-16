import { readFile } from 'node:fs/promises';
import type { ZodType } from 'zod';
import { writeAtomic } from './atomic-file.js';

export class JsonStore<T> {
  constructor(
    private readonly path: string,
    private readonly schema: ZodType<T>,
    private readonly initial: T
  ) {}

  async read(): Promise<T> {
    try {
      const content = await readFile(this.path, 'utf8');
      return this.schema.parse(JSON.parse(content));
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return this.initial;
      if (error instanceof SyntaxError || (typeof error === 'object' && error !== null && 'issues' in error)) {
        throw new Error(`METADATA_INVALID:${this.path}`, { cause: error });
      }
      throw error;
    }
  }

  async write(value: T): Promise<void> {
    let parsed: T;
    try {
      parsed = this.schema.parse(value);
    } catch (error: unknown) {
      throw new Error(`METADATA_INVALID:${this.path}`, { cause: error });
    }
    await writeAtomic(this.path, `${JSON.stringify(parsed, null, 2)}\n`);
  }
}
