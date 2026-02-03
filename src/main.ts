import inquirer from 'inquirer';
import chalk from 'chalk';
import { Agent } from './agent.js';
import { tools, ToolName } from './tools.js';

const agent = new Agent();

async function main() {
    console.log(chalk.green.bold("Starting 'The Last' Agent..."));
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
