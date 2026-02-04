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
        console.log('[Tool] 🔍 Validating TypeScript before restart...');

        try {
            // Run TypeScript validation
            const { stdout, stderr } = await execAsync('npx tsc --noEmit 2>&1', {
                cwd: process.cwd(),
                maxBuffer: 1024 * 1024
            });

            // Check for errors in output
            const output = stdout + stderr;
            if (output.includes('error TS')) {
                console.log('[Tool] ❌ TypeScript errors found! Fix before restart.');
                return `TypeScript validation FAILED. Fix these errors before restarting:\n\n${output}`;
            }

            console.log('[Tool] ✅ TypeScript valid. Restarting...');
            setTimeout(() => process.exit(0), 500);
            return 'TypeScript OK. Restarting now...';

        } catch (error: any) {
            // tsc returns non-zero on errors
            const output = error.stdout || error.stderr || error.message;
            if (output.includes('error TS')) {
                console.log('[Tool] ❌ TypeScript errors found! Fix before restart.');
                return `TypeScript validation FAILED. Fix these errors before restarting:\n\n${output}`;
            }
            // Other error, proceed with restart
            console.log('[Tool] ⚠️ Could not validate TypeScript, restarting anyway...');
            setTimeout(() => process.exit(0), 500);
            return 'Restarting now...';
        }
    }
};

export type ToolName = keyof typeof tools;
