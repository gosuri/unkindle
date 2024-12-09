import { CaptureOptions, CaptureResult } from '../types/types';

declare global {
  interface Window {
    api: {
      getDesktopPath: () => Promise<string>;
      selectDirectory: () => Promise<string | null>;
      startCapture: (options: CaptureOptions) => Promise<CaptureResult>;
      stopCapture: () => Promise<void>;
    };
    electronAPI: ElectronAPI;
  }
}

interface ElectronAPI {
  openFile: (filePath: string) => Promise<string>;
} 