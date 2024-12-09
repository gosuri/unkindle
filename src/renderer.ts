interface CaptureState {
    isCapturing: boolean;
    outputDir: string;
    startTime?: Date;
    pagesProcessed: number;
}

const state: CaptureState = {
    isCapturing: false,
    outputDir: '',
    pagesProcessed: 0
};

// DOM Elements
const startBtn = document.getElementById('startBtn') as HTMLButtonElement;
const stopBtn = document.getElementById('stopBtn') as HTMLButtonElement;
const outputDirInput = document.getElementById('outputDir') as HTMLInputElement;
const browseBtn = document.getElementById('browseBtn') as HTMLButtonElement;
const startPageInput = document.getElementById('startPage') as HTMLInputElement;
const maxPagesInput = document.getElementById('maxPages') as HTMLInputElement;
const captureDelayInput = document.getElementById('captureDelay') as HTMLInputElement;
const statusDiv = document.getElementById('status') as HTMLDivElement;
const pdfLinkDiv = document.getElementById('pdfLink') as HTMLDivElement;
const openPdfLink = document.getElementById('openPdfLink') as HTMLAnchorElement;

// Initialize output directory
window.api.getDesktopPath().then(path => {
    state.outputDir = path;
    outputDirInput.value = path;
});

// Event Handlers
browseBtn.addEventListener('click', async () => {
    const dir = await window.api.selectDirectory();
    if (dir) {
        state.outputDir = dir;
        outputDirInput.value = dir;
    }
});

startBtn.addEventListener('click', async () => {
    try {
        state.isCapturing = true;
        state.startTime = new Date();
        state.pagesProcessed = 0;
        updateUIState();
        pdfLinkDiv.style.display = 'none';
        
        showStatus(`Starting capture at ${state.startTime.toLocaleTimeString()}...`, 'success');
        
        const result = await window.api.startCapture({
            outputDirectory: state.outputDir,
            startPage: parseInt(startPageInput.value),
            maxPages: maxPagesInput.value ? parseInt(maxPagesInput.value) : null,
            captureDelay: parseInt(captureDelayInput.value),
        });

        const endTime = new Date();
        const duration = Math.round((endTime.getTime() - state.startTime.getTime()) / 1000);

        if (result.success) {
            showStatus(
                `Capture completed successfully at ${endTime.toLocaleTimeString()}!\n` +
                `Total pages: ${result.count}\n` +
                `Duration: ${duration} seconds`,
                'success'
            );
            if (result.pdfPath) {
                showPdfLink(result.pdfPath);
            }
        } else {
            showStatus(`Capture failed: ${result.error}`, 'error');
        }
    } catch (error) {
        showStatus(`Error: ${error}`, 'error');
    } finally {
        state.isCapturing = false;
        updateUIState();
    }
});

stopBtn.addEventListener('click', async () => {
    await window.api.stopCapture();
    state.isCapturing = false;
    const endTime = new Date();
    if (state.startTime) {
        const duration = Math.round((endTime.getTime() - state.startTime.getTime()) / 1000);
        showStatus(
            `Capture stopped manually at ${endTime.toLocaleTimeString()}\n` +
            `Pages processed: ${state.pagesProcessed}\n` +
            `Duration: ${duration} seconds`,
            'success'
        );
    }
    updateUIState();
});

// Add a new IPC handler for progress updates
window.api.onCaptureProgress((pageNumber: number) => {
    state.pagesProcessed = pageNumber;
    if (state.startTime) {
        const currentTime = new Date();
        const duration = Math.round((currentTime.getTime() - state.startTime.getTime()) / 1000);
        showStatus(
            `Capturing in progress...\n` +
            `Pages processed: ${pageNumber}\n` +
            `Duration: ${duration} seconds`,
            'success'
        );
    }
});

// Helper functions
function updateUIState() {
    startBtn.disabled = state.isCapturing;
    stopBtn.disabled = !state.isCapturing;
    browseBtn.disabled = state.isCapturing;
    startPageInput.disabled = state.isCapturing;
    maxPagesInput.disabled = state.isCapturing;
    captureDelayInput.disabled = state.isCapturing;
}

function showStatus(message: string, type: 'success' | 'error') {
    statusDiv.innerHTML = message.split('\n').join('<br>');
    statusDiv.className = `status ${type}`;
}

function showPdfLink(pdfPath: string) {
    // Extract just the filename from the full path
    const fileName = pdfPath.split('/').pop() || pdfPath.split('\\').pop() || pdfPath;
    
    // Create status message with both PDF and directory links
    statusDiv.innerHTML = `The generated PDF is saved as <a href="#" class="pdf-link">${fileName}</a> in the <a href="#" class="pdf-link">${state.outputDir}</a> directory`;
    
    // Add click handlers to both links
    const links = statusDiv.querySelectorAll('.pdf-link');
    links.forEach((link, index) => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            // First link opens the PDF, second link opens the directory
            if (index === 0) {
                window.electronAPI.openFile(pdfPath);
            } else {
                window.electronAPI.openFile(state.outputDir);
            }
        });
    });
    
    // Add success styling to status
    statusDiv.className = 'status success';
    
    // Hide the separate PDF link div since we're not using it anymore
    pdfLinkDiv.style.display = 'none';
} 