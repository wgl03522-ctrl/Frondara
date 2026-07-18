import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/coverage/**', 'node_modules/**', '.superpowers/**', 'playwright-report/**', 'test-results/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-hooks/set-state-in-effect': 'off'
    }
  },
  {
    files: ['apps/server/**/*.ts', 'apps/cli/**/*.ts', 'apps/desktop/**/*.ts', 'packages/**/*.ts', '*.ts'],
    languageOptions: { globals: globals.node }
  },
  {
    // Node build/util scripts (esbuild bundler, image generators). Plain JS, so
    // no-undef is active — give them the Node globals they rely on.
    files: ['**/*.mjs'],
    languageOptions: { globals: globals.node }
  }
);
