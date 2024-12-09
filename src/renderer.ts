interface CaptureState {
    isCapturing: boolean;
    outputDir: string;
}

const state: CaptureState = {
    isCapturing: false,
    outputDir: '',
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
        updateUIState();
        pdfLinkDiv.style.display = 'none';
        
        const result = await window.api.startCapture({
            outputDirectory: state.outputDir,
            startPage: parseInt(startPageInput.value),
            maxPages: maxPagesInput.value ? parseInt(maxPagesInput.value) : null,
            captureDelay: parseInt(captureDelayInput.value),
        });

        if (result.success) {
            showStatus(`Capture completed successfully! Captured ${result.count} pages.`, 'success');
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
    updateUIState();
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
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
}

function showPdfLink(pdfPath: string) {
    // Extract just the filename from the full path
    const fileName = pdfPath.split('/').pop() || pdfPath.split('\\').pop() || pdfPath;
    
    // Create status message with inline link
    statusDiv.innerHTML = `The PDF is saved as <a href="#" class="pdf-link">${fileName}</a> in the Output directory`;
    
    // Add click handler to the link
    const pdfLink = statusDiv.querySelector('.pdf-link');
    if (pdfLink) {
        pdfLink.addEventListener('click', (e) => {
            e.preventDefault();
            window.electronAPI.openFile(pdfPath);
        });
    }
    
    // Add success styling to status
    statusDiv.className = 'status success';
    
    // Hide the separate PDF link div since we're not using it anymore
    pdfLinkDiv.style.display = 'none';
} 