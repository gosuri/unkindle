import { contextBridge, ipcRenderer } from 'electron';

export type CaptureOptions = {
  outputDirectory: string;
  startPage: number;
  maxPages: number | null;
  captureDelay: number;
};

export type CaptureResult = {
  success: boolean;
  count?: number;
  error?: string;
};

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'api', 
  {
    getDesktopPath: () => ipcRenderer.invoke('get-desktop-path'),
    selectDirectory: () => ipcRenderer.invoke('select-directory'),
    startCapture: (options: CaptureOptions) => ipcRenderer.invoke('start-capture', options),
    stopCapture: () => ipcRenderer.invoke('stop-capture')
  }
); 