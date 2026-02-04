import inquirer from 'inquirer';
import chalk from 'chalk';
import { execSync } from 'child_process';
import { Agent } from './agent.js';
import { tools, ToolName } from './tools.js';

// === SELF-HEALING: Console Observer ===
// Capture warnings and errors so agent can see and fix them
const recentIssues: string[] = [];
const MAX_ISSUES = 5;

const originalWarn = console.warn;
const originalError = console.error;

console.warn = (...args: any[]) => {
    const msg = args.map(a => String(a)).join(' ');
    recentIssues.push(`[WARN] ${msg}`);
    if (recentIssues.length > MAX_ISSUES) recentIssues.shift();
    originalWarn.apply(console, args);
};

console.error = (...args: any[]) => {
    const msg = args.map(a => String(a)).join(' ');
    recentIssues.push(`[ERROR] ${msg}`);
    if (recentIssues.length > MAX_ISSUES) recentIssues.shift();
    originalError.apply(console, args);
};
// === END SELF-HEALING ===

const agent = new Agent();

// Gather startup context for the agent
function getStartupContext(): string {
    let context = "=== STARTUP CONTEXT ===\n";

    // CRITICAL: Check for crash from previous run
    try {
        const crashLog = execSync('cat workspace/last_crash.log 2>/dev/null', { encoding: 'utf-8' });
        if (crashLog && crashLog.trim()) {
            context += `\n--- ⚠️ PREVIOUS CRASH DETECTED ---\nYou crashed on your last run. FIX THIS FIRST before doing anything else:\n\n${crashLog}\n\n--- END CRASH LOG ---\n`;
        }
    } catch { /* No crash log, good! */ }

    try {
        const playbook = execSync('cat workspace/playbook.md 2>/dev/null || echo "No playbook yet."', { encoding: 'utf-8' });
        context += `\n--- PLAYBOOK ---\n${playbook}\n`;
    } catch { context += "\n--- PLAYBOOK ---\nNot found.\n"; }

    try {
        const skills = execSync('ls -la src/skills/ 2>/dev/null || echo "No skills yet."', { encoding: 'utf-8' });
        context += `\n--- YOUR SKILLS ---\n${skills}\n`;
    } catch { context += "\n--- YOUR SKILLS ---\nNone yet.\n"; }

    // Scan active tasks
    try {
        const taskDirs = execSync('ls workspace/tasks/ 2>/dev/null', { encoding: 'utf-8' }).trim().split('\n').filter(Boolean);
        if (taskDirs.length > 0) {
            context += `\n--- ACTIVE TASKS ---\n`;
            for (const task of taskDirs) {
                try {
                    const progress = execSync(`cat workspace/tasks/${task}/progress.md 2>/dev/null | head -20`, { encoding: 'utf-8' });
                    context += `\n### ${task}\n${progress}\n`;
                } catch { /* skip if no progress.md */ }
            }
        }
    } catch { /* no tasks folder */ }

    try {
        const recentLog = execSync('ls -t workspace/logs/*.md 2>/dev/null | head -1 | xargs cat 2>/dev/null | tail -50 || echo "No logs yet."', { encoding: 'utf-8' });
        context += `\n--- RECENT LOG (last 50 lines) ---\n${recentLog}\n`;
    } catch { context += "\n--- RECENT LOG ---\nNone yet.\n"; }

    context += "\n=== END CONTEXT ===\nYou are now ready. Greet the user briefly.";
    return context;
}

async function main() {
    console.log(chalk.green.bold("Starting 'The Last' Agent..."));

    // Inject startup context
    console.log(chalk.yellow("Gathering context..."));
    const startupContext = getStartupContext();
    await agent.chat(startupContext);
    console.log(chalk.green("✓ Agent initialized with context."));

    console.log(chalk.gray("Type 'exit' to quit."));

    while (true) {
        const { input } = await inquirer.prompt([{
            type: 'input',
            name: 'input',
            message: chalk.blue('You:'),
        }]);

        if (input.toLowerCase() === 'exit') process.exit(0);

        let currentInput = input;

        // Inner Loop: ReAct Cycle (runs until agent sends 'reply')
        while (true) {
            process.stdout.write(chalk.yellow("Thinking... \r"));

            // SELF-HEALING: Inject any captured warnings/errors
            if (recentIssues.length > 0) {
                currentInput = `SYSTEM ALERT - You caused these issues. Fix them before continuing:\n${recentIssues.join('\n')}\n\nOriginal task: ${currentInput}`;
                recentIssues.length = 0; // Clear after injecting
            }

            let responseJson: string;
            try {
                responseJson = await agent.chat(currentInput);
            } catch (chatError: any) {
                console.log(chalk.red("[ERROR] agent.chat() threw:"), chatError.message);
                break;
            }

            if (!responseJson || responseJson.trim() === '') {
                console.log(chalk.red("[ERROR] agent.chat() returned empty response"));
                break;
            }

            let response: any;

            // Strip markdown code blocks if present (LLM sometimes wraps JSON in ```json ... ```)
            responseJson = responseJson.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

            try {
                response = JSON.parse(responseJson);
            } catch {
                console.log(chalk.red("Error parsing JSON from agent:"), responseJson.slice(0, 500));
                currentInput = "Error: Your last response was not valid JSON. Please respond with ONLY raw JSON, no markdown.";
                continue;
            }

            // 1. Show Thought
            if (response.thought) {
                console.log(chalk.dim(`Thought: ${response.thought}`));
            }



            // 2. Handle Action vs Reply
            if (response.reply) {
                console.log(chalk.green('Genesis:'), response.reply);
                break; // Task done, return to user input
            }

            if (response.action) {
                const { tool, args } = response.action;
                console.log(chalk.cyan(`Action: ${tool}(${JSON.stringify(args)})`));

                let toolResult = "";
                const toolFn = tools[tool as ToolName];

                if (toolFn) {
                    // Handle arguments (handle array vs spread vs single arg)
                    const argsArray = Array.isArray(args) ? args : [args];
                    // @ts-expect-error - dynamic tool call
                    toolResult = await toolFn(...argsArray);
                } else {
                    toolResult = `Error: Tool ${tool} not found.`;
                }

                console.log(chalk.dim(`Result: ${toolResult.slice(0, 100)}...`));

                // Feed result back to agent
                currentInput = `Tool Output: ${toolResult}`;
            } else {
                // No action, no reply - treat thought as the reply
                console.log(chalk.green('Genesis:'), response.thought || "I'm not sure how to respond.");
                break;
            }
        }
    }
}

main();
