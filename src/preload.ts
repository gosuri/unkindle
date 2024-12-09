import { contextBridge, ipcRenderer, shell } from 'electron';
import { CaptureOptions, CaptureResult } from './types/types';

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

contextBridge.exposeInMainWorld('electronAPI', {
    // ... existing exposed methods ...
    openFile: (filePath: string) => shell.openPath(filePath),
}); 