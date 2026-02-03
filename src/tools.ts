import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const TOOLS_DIR = path.join(process.cwd(), 'src', 'skills');
export const WORKSPACE_DIR = path.join(process.cwd(), 'workspace');

// Ensure directories exist
await fs.mkdir(TOOLS_DIR, { recursive: true });
await fs.mkdir(WORKSPACE_DIR, { recursive: true });

export const tools = {
    run_command: async (command: string) => {
        try {
            console.log(`[Tool] Running command: ${command}`);
            const { stdout, stderr } = await execAsync(command, { cwd: WORKSPACE_DIR });
            return stdout || stderr;
        } catch (error: any) {
            return `Error: ${error.message}`;
        }
    },

    write_file: async (filename: string, content: string) => {
        // Handle absolute paths, src/ paths, and workspace paths
        let targetPath: string;
        if (filename.startsWith('/')) {
            targetPath = filename; // Absolute path - use as-is
        } else if (filename.startsWith('src/')) {
            targetPath = path.join(process.cwd(), filename);
        } else {
            targetPath = path.join(WORKSPACE_DIR, filename);
        }

        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        await fs.writeFile(targetPath, content, 'utf-8');
        return `File written to ${targetPath}`;
    },

    read_file: async (filename: string) => {
        let targetPath: string;
        if (filename.startsWith('/')) {
            targetPath = filename; // Absolute path - use as-is
        } else if (filename.startsWith('src/')) {
            targetPath = path.join(process.cwd(), filename);
        } else {
            targetPath = path.join(WORKSPACE_DIR, filename);
        }

        try {
            const content = await fs.readFile(targetPath, 'utf-8');
            return content;
        } catch (error: any) {
            return `Error reading file: ${error.message}`;
        }
    },

    list_files: async (dir: string = '.') => {
        let targetDir: string;
        if (dir.startsWith('/')) {
            targetDir = dir; // Absolute path - use as-is
        } else if (dir.startsWith('src/')) {
            targetDir = path.join(process.cwd(), dir);
        } else {
            targetDir = path.join(WORKSPACE_DIR, dir);
        }

        try {
            const files = await fs.readdir(targetDir);
            return files.join('\n');
        } catch (err: any) {
            return `Error listing files: ${err.message}`;
        }
    },

    restart: async () => {
        console.log('[Tool] 🔄 Restarting agent to apply changes...');
        // Give time for the message to be sent before exiting
        setTimeout(() => {
            process.exit(0);
        }, 500);
        return 'Restarting now...';
    }
};

export type ToolName = keyof typeof tools;
