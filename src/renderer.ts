const { ipcRenderer } = require('electron');

console.log('Attempting to initialize renderer...');

document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM Content Loaded - Setting up...');
    
    // Set default directory to desktop
    try {
        const desktopPath = await ipcRenderer.invoke('get-desktop-path');
        const outputDirInput = document.getElementById('outputDir') as HTMLInputElement;
        if (outputDirInput) {
            outputDirInput.value = desktopPath;
            console.log('Set default directory to:', desktopPath);
        }
    } catch (error) {
        console.error('Failed to set default directory:', error);
    }

    // Rest of your event listener setup...
    const browseBtn = document.getElementById('browseBtn');
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    
    console.log('Found buttons:', { 
        browseBtn: !!browseBtn, 
        startBtn: !!startBtn, 
        stopBtn: !!stopBtn 
    });

    browseBtn?.addEventListener('click', () => {
        console.log('Browse button clicked');
        selectDirectory();
    });
    
    startBtn?.addEventListener('click', () => {
        console.log('Start button clicked');
        startCapture();
    });
    
    stopBtn?.addEventListener('click', () => {
        console.log('Stop button clicked');
        stopCapture();
    });
    
    console.log('Event listeners attached');
});

let isCapturing = false;

async function selectDirectory() {
    try {
        const dir = await ipcRenderer.invoke('select-directory');
        const outputDirInput = document.getElementById('outputDir') as HTMLInputElement;
        if (dir && outputDirInput) {
            outputDirInput.value = dir;
        }
    } catch (error) {
        showStatus('Failed to select directory', 'error');
        console.error('Directory selection error:', error);
    }
}

async function startCapture() {
    console.log('Starting capture process...');
    const outputDirInput = document.getElementById('outputDir') as HTMLInputElement;
    if (!outputDirInput) return;
    const outputDir = outputDirInput.value;
    
    if (!outputDir) {
        showStatus('Please select an output directory', 'error');
        return;
    }

    const options = {
        outputDirectory: outputDir,
        startPage: parseInt((document.getElementById('startPage') as HTMLInputElement)?.value || '0'),
        maxPages: parseInt((document.getElementById('maxPages') as HTMLInputElement)?.value || '0') || null,
        captureDelay: parseInt((document.getElementById('captureDelay') as HTMLInputElement)?.value || '0')
    };

    console.log('Capture options:', options);
    isCapturing = true;
    const startBtn = document.getElementById('startBtn') as HTMLButtonElement;
    const stopBtn = document.getElementById('stopBtn') as HTMLButtonElement;
    if (startBtn) startBtn.disabled = true;
    if (stopBtn) stopBtn.disabled = false;
    showStatus('Capturing...', 'success');

    const result = await ipcRenderer.invoke('start-capture', options);
    
    isCapturing = false;
    if (startBtn) startBtn.disabled = false;
    if (stopBtn) stopBtn.disabled = true;

    if (result.success) {
        showStatus(`Captured ${result.count} pages successfully!`, 'success');
    } else {
        showStatus(`Error: ${result.error}`, 'error');
    }
}

function stopCapture() {
    console.log('Stopping capture process...');
    ipcRenderer.invoke('stop-capture');
    const stopBtn = document.getElementById('stopBtn') as HTMLButtonElement;
    if (stopBtn) stopBtn.disabled = true;
    showStatus('Stopping capture...', 'success');
}

function showStatus(message: string, type: string) {
    const status = document.getElementById('status');
    if (!status) return;
    
    status.textContent = message;
    status.className = `status ${type}`;
} 