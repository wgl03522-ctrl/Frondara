import { join } from 'node:path';
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '@pnode/server/app';

// The desktop shell hosts the Fastify app in-process and answers the renderer's
// API calls via app.inject(), so no TCP port is ever opened. In dev we load the
// Vite server over HTTP (for HMR); packaged builds load the built web assets
// from disk over file://.
const isDev = !app.isPackaged;
const DEV_URL = 'http://localhost:4318';

let server: FastifyInstance | undefined;

interface InvokePayload {
  method: string;
  url: string;
  body?: unknown;
  headers?: Record<string, string>;
}

type Locale = 'zh-CN' | 'en-US';

export function normalizeLocale(value: unknown): Locale {
  return value === 'en-US' ? 'en-US' : 'zh-CN';
}

export function folderPickerTitle(locale: Locale): string {
  return locale === 'en-US' ? 'Select workspace folder' : '选择工作区文件夹';
}

export function startupErrorTitle(systemLocale: string): string {
  return systemLocale.toLowerCase().startsWith('en') ? 'Frondara failed to start' : 'Frondara 启动失败';
}

async function createServer(): Promise<FastifyInstance> {
  // No initialWorkspace: the user picks a folder from the UI (which persists it
  // in UI state). Config/credentials resolve to the per-user APPDATA dir.
  const instance = await buildApp();
  await instance.ready();
  return instance;
}

function registerIpc(instance: FastifyInstance): void {
  // Single bridge for every API call the web client makes. Mirrors what a real
  // HTTP round-trip would return so the client's request() logic is unchanged.
  ipcMain.handle('pnode:invoke', async (_event, payload: InvokePayload) => {
    const response = await instance.inject({
      method: payload.method as 'GET',
      url: payload.url,
      headers: { 'content-type': 'application/json', ...payload.headers },
      ...(payload.body !== undefined ? { payload: payload.body as object } : {})
    });
    return {
      status: response.statusCode,
      body: response.body,
      contentType: response.headers['content-type'] ?? 'application/json'
    };
  });

  // Native folder picker for "open workspace" — returns an absolute path or null.
  ipcMain.handle('pnode:pick-folder', async (_event, locale: unknown) => {
    const result = await dialog.showOpenDialog({
      title: folderPickerTitle(normalizeLocale(locale)),
      properties: ['openDirectory', 'createDirectory']
    });
    return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
  });
}

async function createWindow(): Promise<void> {
  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0f1115',
    show: false,
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  // Open external links (http/https) in the system browser, never in-app.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      void shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  window.once('ready-to-show', () => window.show());

  if (isDev) {
    await window.loadURL(DEV_URL);
    window.webContents.openDevTools({ mode: 'detach' });
  } else {
    await window.loadFile(join(__dirname, 'web', 'index.html'));
  }
}

app.whenReady().then(async () => {
  server = await createServer();
  registerIpc(server);
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
}).catch((error: unknown) => {
  dialog.showErrorBox(startupErrorTitle(app.getLocale()), error instanceof Error ? error.message : String(error));
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', async () => {
  await server?.close();
});
