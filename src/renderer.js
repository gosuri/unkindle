window.addEventListener('DOMContentLoaded', () => {
    // This will be implemented in your preload.js to safely access the desktop path
    window.api.getDesktopPath().then(desktopPath => {
        document.getElementById('outputDir').value = desktopPath;
    });
}); 