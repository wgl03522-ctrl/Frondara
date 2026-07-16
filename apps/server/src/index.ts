import { buildApp } from './app.js';

const app = await buildApp(
  process.env.PNODE_WORKSPACE
    ? { initialWorkspace: process.env.PNODE_WORKSPACE }
    : {}
);
const port = Number(process.env.PNODE_PORT ?? 4317);
await app.listen({ host: '127.0.0.1', port });
