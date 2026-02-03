import inquirer from 'inquirer';
import chalk from 'chalk';
import { execSync } from 'child_process';
import { Agent } from './agent.js';
import { tools, ToolName } from './tools.js';

const agent = new Agent();

// Gather startup context for the agent
function getStartupContext(): string {
    let context = "=== STARTUP CONTEXT ===\n";

    try {
        const playbook = execSync('cat workspace/playbook.md 2>/dev/null || echo "No playbook yet."', { encoding: 'utf-8' });
        context += `\n--- PLAYBOOK ---\n${playbook.slice(0, 2000)}\n`;
    } catch { context += "\n--- PLAYBOOK ---\nNot found.\n"; }

    try {
        const skills = execSync('ls -la src/skills/ 2>/dev/null || echo "No skills yet."', { encoding: 'utf-8' });
        context += `\n--- YOUR SKILLS ---\n${skills}\n`;
    } catch { context += "\n--- YOUR SKILLS ---\nNone yet.\n"; }

    try {
        const recentLog = execSync('ls -t workspace/logs/*.md 2>/dev/null | head -1 | xargs cat 2>/dev/null | tail -50 || echo "No logs yet."', { encoding: 'utf-8' });
        context += `\n--- RECENT LOG (last 50 lines) ---\n${recentLog.slice(0, 1500)}\n`;
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
        let turnCount = 0;
        const MAX_TURNS = 10; // Prevent infinite loops

        // Inner Loop: ReAct Cycle
        while (turnCount < MAX_TURNS) {
            process.stdout.write(chalk.yellow("Thinking... \r"));

            const responseJson = await agent.chat(currentInput);
            let response: any;

            try {
                response = JSON.parse(responseJson);
            } catch {
                console.log(chalk.red("Error parsing JSON from agent:"), responseJson);
                currentInput = "Error: Your last response was not valid JSON. Please try again.";
                turnCount++;
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

            turnCount++;
        }
    }
}

main();
