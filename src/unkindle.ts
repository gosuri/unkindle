import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import * as crypto from 'crypto';
import * as os from 'os';
import { Screenshot, WindowBounds } from './types/types';

class Utils {
  static readonly execAsync = promisify(exec);

  static async ensureDirectory(dir: string): Promise<void> {
    await fs.mkdir(dir, { recursive: true });
  }

  static getDesktopPath(): string {
    return path.join(os.homedir(), 'Desktop');
  }

  static async calculateFileHash(filePath: string): Promise<string> {
    const fileBuffer = await fs.readFile(filePath);
    return crypto.createHash('md5').update(fileBuffer).digest('hex');
  }
}

async function getAllScreenshotsInDirectory(directory: string): Promise<Screenshot[]> {
  const files = await fs.readdir(directory);
  return files
    .filter(f => f.startsWith('page_') && f.endsWith('.png'))
    .map(f => {
      const [_, pageNum] = f.split('_');
      return {
        path: path.join(directory, f),
        pageNumber: parseInt(pageNum)
      };
    })
    .filter(screenshot => !isNaN(screenshot.pageNumber));
}

export class BookScreenshotAutomator {
  private outputDir: string;
  private currentPage: number = 1;
  private pagesProcessed: number = 0;
  private screenshots: Screenshot[] = [];
  private isCancelled: boolean = false;
  private stopCapture: boolean = false;
  private readonly captureDelay: number;
  private windowBounds: WindowBounds | null = null;
  private maxPages: number | null = null;

  constructor(
    outputDirectory: string, 
    captureDelay: number = 1000,
    startPage: number = 1,
    maxPages: number | null = null
  ) {
    this.outputDir = outputDirectory;
    this.captureDelay = captureDelay;
    this.currentPage = startPage;
    this.maxPages = maxPages;
  }

  cancel(): void {
    console.log('Automator: Cancelling capture process');
    this.isCancelled = true;
  }

  stopScreenshots(): void {
    console.log('Automator: Stopping screenshot process');
    this.stopCapture = true;
  }

  async getWindowBounds(): Promise<WindowBounds> {
    const script = `
      tell application "Amazon Kindle"
        if not running then
          return "NOT_RUNNING"
        end if
        activate
      end tell
      delay 0.5
      tell application "System Events"
        tell process "Amazon Kindle"
          get {position, size} of window 1
        end tell
      end tell
    `;

    try {
      const { stdout } = await Utils.execAsync(`osascript -e '${script}'`);
      
      if (stdout.trim() === "NOT_RUNNING") {
        throw new Error(
          "Cannot find Kindle application. Please make sure Kindle is running with a book open."
        );
      }

      const matches = stdout.match(/-?\d+/g);
      
      if (!matches || matches.length !== 4) {
        throw new Error(
          "Cannot detect Kindle window. Please ensure Kindle is not minimized and visible."
        );
      }

      const [x, y, width, height] = matches.map(Number);
      const titleBarHeight = 22;
      return { 
        x, 
        y: y + titleBarHeight, 
        width, 
        height: height - titleBarHeight 
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes("Cannot")) {
        throw error;
      }
      throw new Error("Failed to interact with Kindle application. Check permissions and ensure Kindle is running.");
    }
  }

  async initialize(): Promise<void> {
    await Utils.ensureDirectory(this.outputDir);
    this.windowBounds = await this.getWindowBounds();
  }

  async activateWindow(): Promise<void> {
    const script = `
      tell application "Amazon Kindle"
        activate
      end tell
    `;
    await Utils.execAsync(`osascript -e '${script}'`);
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  async captureScreenshot(): Promise<string> {
    if (!this.windowBounds) {
      throw new Error('Window bounds not initialized');
    }

    const timestamp = new Date().getTime();
    const filename = `page_${this.currentPage}_${timestamp}.png`;
    const outputPath = path.join(this.outputDir, filename);

    try {
      await this.activateWindow();
      await new Promise(resolve => setTimeout(resolve, this.captureDelay));
      
      const { x, y, width, height } = this.windowBounds;
      await Utils.execAsync(`screencapture -xR${x},${y},${width},${height} ${outputPath}`);
      
      const stats = await fs.stat(outputPath);
      if (stats.size === 0) {
        throw new Error('Screenshot file is empty');
      }
      
      return outputPath;
    } catch (error) {
      try {
        await fs.unlink(outputPath);
      } catch {} 
      throw new Error(`Failed to capture screenshot: ${error}`);
    }
  }

  async simulateNextPage(): Promise<void> {
    const script = `
      tell application "Amazon Kindle"
        activate
      end tell
      
      tell application "System Events"
        tell process "Amazon Kindle"
          key code 124
          delay 0.2
        end tell
      end tell
    `;
    
    try {
      await Utils.execAsync(`osascript -e '${script}'`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      throw new Error('Failed to navigate to next page');
    }
  }

  async processBook(): Promise<Screenshot[]> {
    console.log('Automator: Starting book processing');
    await this.initialize();
    let lastScreenshotHash: string | null = null;

    try {
      while (!this.isCancelled && !this.stopCapture && 
             (!this.maxPages || this.pagesProcessed < this.maxPages)) {
        
        console.log(`Automator: Processing page ${this.currentPage}`);
        const screenshotPath = await this.captureScreenshot();
        const currentHash = await Utils.calculateFileHash(screenshotPath);

        if (lastScreenshotHash === currentHash) {
          await fs.unlink(screenshotPath);
          break;
        }

        this.screenshots.push({
          path: screenshotPath,
          pageNumber: this.currentPage
        });

        lastScreenshotHash = currentHash;

        if (!this.isCancelled && !this.stopCapture) {
          await this.simulateNextPage();
          this.currentPage++;
          this.pagesProcessed++;
        }
      }
    } catch (error) {
      console.error('Automator: Error during processing:', error);
      throw error;
    }

    console.log('Automator: Book processing completed');
    return this.screenshots;
  }

  async createPDF(): Promise<string> {
    const allScreenshots = await getAllScreenshotsInDirectory(this.outputDir);
    
    if (allScreenshots.length === 0) {
      throw new Error('No screenshots available to create PDF');
    }

    const pdfPath = path.join(this.outputDir, 'book.pdf');
    
    try {
      const sortedScreenshots = allScreenshots.sort((a, b) => a.pageNumber - b.pageNumber);
      const pdfDoc = await PDFDocument.create();

      for (const screenshot of sortedScreenshots) {
        const optimizedImage = await sharp(screenshot.path)
          .jpeg({ quality: 85 })
          .toBuffer();

        const image = await pdfDoc.embedJpg(optimizedImage);
        const page = pdfDoc.addPage([image.width, image.height]);
        
        page.drawImage(image, {
          x: 0,
          y: 0,
          width: image.width,
          height: image.height,
        });
      }

      const pdfBytes = await pdfDoc.save();
      await fs.writeFile(pdfPath, pdfBytes);
      
      return pdfPath;
    } catch (error) {
      throw new Error(`Failed to create PDF: ${error}`);
    }
  }

  async cleanup(): Promise<void> {
    if (this.screenshots.length > 0 && !this.isCancelled) {
      try {
        await this.createPDF();
      } catch (error) {
        throw new Error(`Error creating PDF: ${error}`);
      }
    }
    
    if (this.isCancelled && this.screenshots.length > 0) {
      const lastScreenshot = this.screenshots[this.screenshots.length - 1];
      try {
        await fs.unlink(lastScreenshot.path);
      } catch (error) {
        console.error('Error cleaning up partial capture:', error);
      }
    }
  }
}