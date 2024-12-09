import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { BookScreenshotAutomator } from './unkindle';
import { enable } from '@electron/remote/main';
import * as os from 'os';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Window loaded successfully');
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
  });

  enable(mainWindow.webContents);
  mainWindow.loadFile(path.join(__dirname, '../src/index.html'));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

let automator: BookScreenshotAutomator | null = null;

ipcMain.handle('start-capture', async (event, options) => {
  console.log('Main process: Starting capture with options:', options);
  try {
    automator = new BookScreenshotAutomator(
      options.outputDirectory,
      options.captureDelay,
      options.startPage,
      options.maxPages
    );

    const screenshots = await automator.processBook();
    const pdfPath = await automator.cleanup();
    console.log(`Main process: Capture completed successfully. Captured ${screenshots.length} pages.`);
    return { success: true, count: screenshots.length, pdfPath };
  } catch (error) {
    console.error('Main process: Capture failed:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('stop-capture', () => {
  console.log('Main process: Stopping capture...');
  if (automator) {
    automator.stopScreenshots();
    console.log('Main process: Stop signal sent to automator');
  }
});

ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Select Output Directory'
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('get-desktop-path', async () => {
    const defaultDir = path.join(os.homedir(), 'Desktop', 'Unkindle');
    // Create the directory if it doesn't exist
    try {
        await fs.mkdir(defaultDir, { recursive: true });
    } catch (error) {
        console.error('Failed to create default directory:', error);
    }
    return defaultDir;
}); 