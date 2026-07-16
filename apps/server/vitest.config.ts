import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@pnode/core': fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url)),
      '@pnode/storage': fileURLToPath(new URL('../../packages/storage/src/index.ts', import.meta.url))
    }
  },
  test: { environment: 'node' }
});
