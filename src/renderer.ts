type StatusType = 'error' | 'success' | 'info';

class CaptureUI {
  private isCapturing = false;
  private readonly elements: {
    outputDir: HTMLInputElement;
    startBtn: HTMLButtonElement;
    stopBtn: HTMLButtonElement;
    browseBtn: HTMLButtonElement;
    startPage: HTMLInputElement;
    maxPages: HTMLInputElement;
    captureDelay: HTMLInputElement;
    status: HTMLElement;
  };

  constructor() {
    this.elements = this.initializeElements();
    this.setupEventListeners();
    this.initializeDefaultPath();
  }

  private initializeElements() {
    return {
      outputDir: document.getElementById('outputDir') as HTMLInputElement,
      startBtn: document.getElementById('startBtn') as HTMLButtonElement,
      stopBtn: document.getElementById('stopBtn') as HTMLButtonElement,
      browseBtn: document.getElementById('browseBtn') as HTMLButtonElement,
      startPage: document.getElementById('startPage') as HTMLInputElement,
      maxPages: document.getElementById('maxPages') as HTMLInputElement,
      captureDelay: document.getElementById('captureDelay') as HTMLInputElement,
      status: document.getElementById('status') as HTMLElement
    };
  }

  private async initializeDefaultPath() {
    try {
      const desktopPath = await window.api.getDesktopPath();
      this.elements.outputDir.value = desktopPath;
    } catch (error) {
      this.showStatus('Failed to set default directory', 'error');
    }
  }

  private setupEventListeners() {
    this.elements.browseBtn.addEventListener('click', () => this.selectDirectory());
    this.elements.startBtn.addEventListener('click', () => this.startCapture());
    this.elements.stopBtn.addEventListener('click', () => this.stopCapture());
  }

  private async selectDirectory() {
    try {
      const dir = await window.api.selectDirectory();
      if (dir) {
        this.elements.outputDir.value = dir;
      }
    } catch (error) {
      this.showStatus('Failed to select directory', 'error');
    }
  }

  private async startCapture() {
    const outputDir = this.elements.outputDir.value;
    if (!outputDir) {
      this.showStatus('Please select an output directory', 'error');
      return;
    }

    const options = {
      outputDirectory: outputDir,
      startPage: parseInt(this.elements.startPage.value || '1'),
      maxPages: parseInt(this.elements.maxPages.value || '0') || null,
      captureDelay: parseInt(this.elements.captureDelay.value || '1000')
    };

    this.isCapturing = true;
    this.updateButtonStates();
    this.showStatus('Capturing...', 'info');

    try {
      const result = await window.api.startCapture(options);
      if (result.success) {
        this.showStatus(`Captured ${result.count} pages successfully!`, 'success');
      } else {
        this.showStatus(`Error: ${result.error}`, 'error');
      }
    } finally {
      this.isCapturing = false;
      this.updateButtonStates();
    }
  }

  private async stopCapture() {
    await window.api.stopCapture();
    this.elements.stopBtn.disabled = true;
    this.showStatus('Stopping capture...', 'info');
  }

  private updateButtonStates() {
    this.elements.startBtn.disabled = this.isCapturing;
    this.elements.stopBtn.disabled = !this.isCapturing;
  }

  private showStatus(message: string, type: StatusType) {
    this.elements.status.textContent = message;
    this.elements.status.className = `status ${type}`;
  }
}

// Initialize the UI when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new CaptureUI();
}); 