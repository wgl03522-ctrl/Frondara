import { contextBridge, ipcRenderer } from 'electron';

// The only surface exposed to the renderer. contextIsolation is on, so the web
// app sees exactly these two methods and nothing else from Node/Electron.
export interface PnodeBridge {
  invoke(payload: {
    method: string;
    url: string;
    body?: unknown;
    headers?: Record<string, string>;
  }): Promise<{ status: number; body: string; contentType: string }>;
  pickFolder(): Promise<string | null>;
}

const bridge: PnodeBridge = {
  invoke: (payload) => ipcRenderer.invoke('pnode:invoke', payload),
  pickFolder: () => ipcRenderer.invoke('pnode:pick-folder')
};

contextBridge.exposeInMainWorld('pnode', bridge);
