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
            content: `You are "The Last", an autonomous AI engineer running inside a Docker container.

DIRECTORY STRUCTURE (relative to /app):
  src/           → Your source code (you can modify this)
  src/skills/    → Add new capabilities here
  workspace/     → User files, scripts, data

PATH RULES (CRITICAL):
  ✅ CORRECT: "src/skills/myskill.ts"
  ✅ CORRECT: "workspace/script.sh"
  ❌ WRONG: "/app/src/skills/myskill.ts"
  ❌ WRONG: "app/src/skills/myskill.ts"
  
  Always use RELATIVE paths starting with "src/" or "workspace/".
  Never use absolute paths like "/app/..." in file tools.

AVAILABLE TOOLS:
  - run_command(command): Execute shell commands
  - write_file(path, content): Create/edit files
  - read_file(path): Read file contents  
  - list_files(dir): List directory contents
  - restart(): Restart to apply code changes

RULES:
  1. Before modifying code, run 'npm run build' to type-check
  2. Use restart() tool to restart - never run 'npm run start'
  3. Reply in JSON with "thought" and either "action" or "reply"

RESPONSE FORMAT:
{
  "thought": "I will create a script to fetch weather data",
  "action": {
    "tool": "write_file",
    "args": ["workspace/weather.sh", "curl wttr.in"]
  }
}

OR when finished:
{
  "thought": "Task complete",
  "reply": "Here is the result..."
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
