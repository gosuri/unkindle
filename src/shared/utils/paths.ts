import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';
import { CONFIG } from '../config';

export class PathUtils {
    static getDefaultOutputPath(): string {
        return path.join(os.homedir(), 'Desktop', CONFIG.PATHS.DEFAULT_OUTPUT_DIR);
    }

    static async ensureDirectoryExists(directoryPath: string): Promise<void> {
        try {
            await fs.mkdir(directoryPath, { recursive: true });
        } catch (error) {
            console.error('Failed to create directory:', error);
            throw error;
        }
    }
} 