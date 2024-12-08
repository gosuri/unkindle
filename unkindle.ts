import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import * as readline from 'readline';
import sanitize from 'sanitize-filename';

interface Screenshot {
  path: string;
  pageNumber: number;
}

interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface BookAutomatorOptions {
  outputDirectory: string;
  captureDelay?: number;
  startPage?: number;
  maxPages?: number | null;
}

class Utils {
  static readonly execAsync = promisify(exec);

  static async ensureDirectory(dir: string): Promise<void> {
    await fs.mkdir(dir, { recursive: true });
  }

  static async getExistingBooks(): Promise<string[]> {
    const booksDir = path.join(process.cwd(), 'books');
    await Utils.ensureDirectory(booksDir);
    
    const entries = await fs.readdir(booksDir, { withFileTypes: true });
    return entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name);
  }

  static async getLastPageNumber(bookDir: string): Promise<number> {
    try {
      const files = await fs.readdir(bookDir);
      const pageNumbers = files
        .filter(f => f.startsWith('page_') && f.endsWith('.png'))
        .map(f => parseInt(f.split('_')[1]))
        .filter(n => !isNaN(n));
      
      return Math.max(0, ...pageNumbers);
    } catch {
      return 0;
    }
  }
}

class UserInterface {
  private rl: readline.Interface;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  async askQuestion(question: string, defaultAnswer?: string): Promise<string> {
    const defaultPrompt = defaultAnswer ? ` (default: ${defaultAnswer})` : '';
    const answer = await new Promise<string>(resolve => {
      this.rl.question(`${question}${defaultPrompt}: `, resolve);
    });
    return answer.trim() || defaultAnswer || '';
  }

  async getBookConfiguration(): Promise<BookAutomatorOptions> {
    const existingBooks = await Utils.getExistingBooks();
    console.log('\nAvailable books:');
    existingBooks.forEach((book, i) => {
      console.log(`${i + 1}. ${book}`);
    });
    console.log(`${existingBooks.length + 1}. New book`);

    const choice = parseInt(await this.askQuestion('Choose an option (number)'));
    let outputDirectory: string;

    if (choice === existingBooks.length + 1) {
      const title = await this.askQuestion('Enter book title');
      const sanitizedTitle = sanitize(title).toLowerCase().replace(/\s+/g, '_');
      outputDirectory = path.join(process.cwd(), 'books', sanitizedTitle);
      await Utils.ensureDirectory(outputDirectory);
    } else if (choice > 0 && choice <= existingBooks.length) {
      outputDirectory = path.join(process.cwd(), 'books', existingBooks[choice - 1]);
    } else {
      throw new Error('Invalid choice');
    }

    const lastPage = await Utils.getLastPageNumber(outputDirectory);
    let startPage = 1;
    
    if (lastPage > 0) {
      const continueFromLast = (await this.askQuestion(`Continue from page ${lastPage + 1}?`, 'yes')).toLowerCase();
      if (continueFromLast === 'yes' || continueFromLast === 'y') {
        startPage = lastPage + 1;
      }
    }

    const maxPagesStr = await this.askQuestion('How many pages to capture? (Enter for unlimited)');
    const maxPages = maxPagesStr ? parseInt(maxPagesStr) : null;

    return {
      outputDirectory,
      startPage,
      maxPages,
      captureDelay: 1000
    };
  }

  close(): void {
    this.rl.close();
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

class BookScreenshotAutomator {
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
    this.isCancelled = true;
  }

  stopScreenshots(): void {
    this.stopCapture = true;
  }

  async getWindowBounds(): Promise<WindowBounds> {
    const script = `
      tell application "Amazon Kindle"
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
      const matches = stdout.match(/-?\d+/g);
      
      if (!matches || matches.length !== 4) {
        throw new Error('Failed to get window bounds');
      }

      const [x, y, width, height] = matches.map(Number);
      // Adjust y position and height to exclude title bar (22px)
      const titleBarHeight = 22;
      return { 
        x, 
        y: y + titleBarHeight, 
        width, 
        height: height - titleBarHeight 
      };
    } catch (error) {
      throw new Error(`Failed to get window bounds: ${error}`);
    }
  }

  async initialize(): Promise<void> {
    await Utils.ensureDirectory(this.outputDir);
    this.windowBounds = await this.getWindowBounds();
    console.log('Window bounds:', this.windowBounds);
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
      
      // Wait before capture
      await new Promise(resolve => setTimeout(resolve, this.captureDelay));
      
      const { x, y, width, height } = this.windowBounds;
      await Utils.execAsync(`screencapture -R${x},${y},${width},${height} ${outputPath}`);
      
      // Verify the file was created and has content
      const stats = await fs.stat(outputPath);
      if (stats.size === 0) {
        throw new Error('Screenshot file is empty');
      }
      
      return outputPath;
    } catch (error) {
      // Clean up empty or partial files
      try {
        await fs.unlink(outputPath);
      } catch {} // Ignore cleanup errors
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
          -- Try multiple methods to advance the page
          try
            key code 124
            delay 0.2
          end try
          
        end tell
      end tell
    `;
    
    try {
      await Utils.execAsync(`osascript -e '${script}'`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log(`Navigated to next page (${this.currentPage + 1})`);
    } catch (error) {
      console.error('Navigation error:', error);
      throw new Error('Failed to navigate to next page');
    }
  }

  async processBook(): Promise<Screenshot[]> {
    await this.initialize();
    console.log('Starting capture');
    console.log(`Capture delay set to ${this.captureDelay}ms`);
    console.log(`Starting from page ${this.currentPage}`);
    console.log('Press "c" to stop capturing and create PDF');
    console.log('Press "Esc" or Ctrl+C to cancel everything\n');

    try {
      while (!this.isCancelled && !this.stopCapture && 
             (!this.maxPages || this.pagesProcessed < this.maxPages)) {
        console.log(`Capturing page ${this.currentPage} (${this.pagesProcessed + 1}/${this.maxPages || '∞'})`);
        
        const screenshotPath = await this.captureScreenshot();
        
        this.screenshots.push({
          path: screenshotPath,
          pageNumber: this.currentPage
        });

        if (!this.isCancelled && !this.stopCapture) {
          console.log('Navigating to next page...');
          await this.simulateNextPage();
          this.currentPage++;
          this.pagesProcessed++;
        }
      }
    } catch (error) {
      console.error('Error during processing:', error);
      throw error;
    }

    return this.screenshots;
  }

  async createPDF(): Promise<string> {
    // Get all screenshots from directory instead of just using this.screenshots
    const allScreenshots = await getAllScreenshotsInDirectory(this.outputDir);
    
    if (allScreenshots.length === 0) {
      throw new Error('No screenshots available to create PDF');
    }

    const pdfPath = path.join(this.outputDir, 'book.pdf');
    
    try {
      // Sort screenshots by page number and timestamp
      const sortedScreenshots = allScreenshots.sort((a, b) => a.pageNumber - b.pageNumber);
      
      // Create a new PDF document
      const pdfDoc = await PDFDocument.create();

      // Process each screenshot
      for (const screenshot of sortedScreenshots) {
        // Convert PNG to JPEG and optimize
        const optimizedImage = await sharp(screenshot.path)
          .jpeg({ quality: 85 })
          .toBuffer();

        // Convert JPEG to PDF-compatible format
        const image = await pdfDoc.embedJpg(optimizedImage);
        
        // Add a new page
        const page = pdfDoc.addPage([image.width, image.height]);
        
        // Draw the image on the page
        page.drawImage(image, {
          x: 0,
          y: 0,
          width: image.width,
          height: image.height,
        });
      }

      // Save the PDF
      const pdfBytes = await pdfDoc.save();
      await fs.writeFile(pdfPath, pdfBytes);
      
      console.log(`Created PDF at: ${pdfPath}`);
      return pdfPath;
    } catch (error) {
      throw new Error(`Failed to create PDF: ${error}`);
    }
  }

  async cleanup(): Promise<void> {
    const processedCount = this.screenshots.length;
    console.log(`Processed ${processedCount} pages`);
    
    if (processedCount > 0 && !this.isCancelled) {
      try {
        console.log('Creating PDF...');
        await this.createPDF();
      } catch (error) {
        console.error('Error creating PDF:', error);
      }
    }
    
    if (this.isCancelled) {
      console.log('\nProcess cancelled. Cleaning up...');
      if (this.screenshots.length > 0) {
        const lastScreenshot = this.screenshots[this.screenshots.length - 1];
        try {
          await fs.unlink(lastScreenshot.path);
          console.log('Removed partial capture');
        } catch (error) {
          console.error('Error cleaning up partial capture:', error);
        }
      }
    }
  }
}

async function main() {
  const ui = new UserInterface();
  
  try {
    const config = await ui.getBookConfiguration();
    const automator = new BookScreenshotAutomator(
      config.outputDirectory,
      config.captureDelay,
      config.startPage,
      config.maxPages
    );

    // Set up key listeners
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    
    process.stdin.on('data', (key: string) => {
      if (key === '\u0003') {  // Ctrl+C
        console.log('\nReceived interrupt signal');
        automator.cancel();
        process.exit();
      } else if (key === '\u001b') {  // Escape
        console.log('\nReceived escape signal');
        automator.cancel();
        process.exit();
      } else if (key.toLowerCase() === 'c') {
        console.log('\nStopping capture, will create PDF...');
        automator.stopScreenshots();
      }
    });

    const screenshots = await automator.processBook();
    await automator.cleanup();
    
    console.log(`Captured ${screenshots.length} pages successfully`);
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
  } finally {
    process.stdin.setRawMode(false);
    process.stdin.pause();
    ui.close();
  }
}

main().catch(console.error);