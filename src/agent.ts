import { Ollama } from 'ollama';

const ollama = new Ollama({ host: 'http://127.0.0.1:11434' });

const MODEL = 'qwen2.5-coder:14b'; // Ensure this model is pulled on your host machine!

export type Message = {
    role: 'system' | 'user' | 'assistant';
    content: string;
};

export class Agent {
    private history: Message[] = [];

    constructor() {
        this.history.push({
            role: 'system',
            content: `You are "The Last", an autonomous AI engineer.

      ENVIRONMENT:
      - You are running inside a Docker container.
      - Your source code is at: /app/src
      - Your workspace is at: /app/workspace
      - You have FULL PERMISSION to edit your own source code in /app/src (e.g., agent.ts, tools.ts).

      CAPABILITIES:
      1. Run system commands (npm, git, curl, etc).
      2. Write/Edit files anywhere in /app/src or /app/workspace.
      3. SELF-IMPROVE: If you lack a tool, WRITE IT in 'src/tools.ts' or 'src/skills/' and restart if needed.

      RULES:
      1. If asked to do something you cannot do, CREATE A SKILL for it.
      2. QUALITY CONTROL (MANDATORY):
         - TYPE CHECK: Run 'npm run build' to verify strictly.
         - TEST: Create a test script for your new code and run it.
         - VERIFY: Check the output strictly.
      3. CRITICAL: NEVER restart unless 'npm run build' passes cleanly.
      4. Reply in JSON format with a "thought" and an "action".
      5. To restart yourself, use the restart() tool. Do NOT run 'npm run start'.
      
      FILE PATHS (important!):
      - Self-improvement code: src/skills/yourskill.ts (NOT /app/src, just src/)
      - User files: workspace/yourfile.ext (NOT /app/workspace, just workspace/)

      AVAILABLE TOOLS:
      - run_command(command: string): Runs a shell command.
      - write_file(path: string, content: string): Writes a file.
      - read_file(path: string): Reads a file.
      - list_files(dir: string): Lists files.
      - restart(): Restarts the agent to apply code changes.
      
      FORMAT:
      {
        "thought": "I need to check the weather. I will write a script using wttr.in",
        "action": {
             "tool": "write_file",
             "args": ["weather.sh", "curl wttr.in"]
        }
      }
      
      OR (if finished):
      {
        "thought": "I have completed the task.",
        "reply": "Here is the weather..."
      }
      `
        });
    }

    async chat(userInput: string): Promise<string> {
        this.history.push({ role: 'user', content: userInput });

        try {
            const response = await ollama.chat({
                model: MODEL,
                messages: this.history,
                format: 'json', // Force JSON structure
                stream: false
            });

            const responseContent = response.message.content;
            this.history.push({ role: 'assistant', content: responseContent });

            return responseContent;
        } catch (error: any) {
            console.error("LLM Error:", error);
            return JSON.stringify({ thought: "Error connecting to LLM", reply: "I could not reach the brain. Is Ollama running?" });
        }
    }

    // Clean history to save context tokens (simple FIFO for now)
    pruneHistory() {
        if (this.history.length > 20) {
            this.history = [this.history[0], ...this.history.slice(-10)];
        }
    }
}
