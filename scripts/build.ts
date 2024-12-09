import * as fs from 'fs';
import * as path from 'path';
import { BUILD_CONFIG } from '../src/shared/config/build';

function ensureBuildDirectory() {
    const buildDir = path.join(__dirname, '../build');
    if (!fs.existsSync(buildDir)) {
        fs.mkdirSync(buildDir);
    }

    // Check for required files
    BUILD_CONFIG.requiredFiles.forEach(file => {
        const filePath = path.join(__dirname, '..', file);
        if (!fs.existsSync(filePath)) {
            console.warn(`Warning: ${file} is missing. This may affect packaging for some platforms.`);
        }
    });
}

ensureBuildDirectory(); 