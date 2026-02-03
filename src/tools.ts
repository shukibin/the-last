import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const tools = {
    run_command: async (command: string) => {
        try {
            console.log(`[Tool] Running: ${command}`);
            // Run from project root (/app) so agent can access src/, workspace/, etc.
            const { stdout, stderr } = await execAsync(command, {
                cwd: process.cwd(),
                maxBuffer: 10 * 1024 * 1024  // 10MB buffer for large outputs
            });
            return stdout || stderr || '(no output)';
        } catch (error: any) {
            return `Error: ${error.message}\n${error.stderr || ''}`;
        }
    },

    restart: async () => {
        console.log('[Tool] 🔄 Restarting agent to apply changes...');
        setTimeout(() => process.exit(0), 500);
        return 'Restarting now...';
    }
};

export type ToolName = keyof typeof tools;
