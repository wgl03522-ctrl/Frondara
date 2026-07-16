import { cp, rm, access } from 'node:fs/promises';
import { build } from 'esbuild';

// Bundle the Electron main + preload into standalone CommonJS. Everything the
// main process needs (fastify, zod, @pnode/*) is inlined, so the packaged app
// carries no workspace symlinks or transitive node_modules to resolve at
// runtime. Only 'electron' stays external — it's provided by the runtime.
const shared = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  external: ['electron'],
  logLevel: 'info',
  sourcemap: true
};

await build({
  ...shared,
  entryPoints: ['src/main.ts'],
  outfile: 'dist/main.cjs'
});

await build({
  ...shared,
  entryPoints: ['src/preload.ts'],
  outfile: 'dist/preload.cjs'
});

// Stage the built web assets next to main.cjs so the packaged app loads them
// from dist/web/index.html over file://. Skipped (with a note) when the web
// build hasn't run yet — `npm run build` builds web first, then bundles.
const webDist = '../web/dist';
try {
  await access(webDist);
  await rm('dist/web', { recursive: true, force: true });
  await cp(webDist, 'dist/web', { recursive: true });
  console.log('staged web assets: dist/web');
} catch {
  console.log('note: ../web/dist not found — run `npm run build -w @pnode/web` before packaging');
}

console.log('desktop bundle ready: dist/main.cjs, dist/preload.cjs');
