import { Ollama } from 'ollama';

const ollama = new Ollama({ host: 'http://127.0.0.1:11434' });
const MODEL = 'qwen2.5-coder:14b';

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
- Running inside Docker container at /app (project root).
- Full CLI access via run_command.
- Your code is in src/. User data goes in workspace/.

TOOLS:
- run_command(command): Execute any shell command.
- restart(): Restart to apply code changes.

CAPABILITIES:
- If you lack a tool, CREATE A SKILL for it in src/skills/.
- You can modify your own source code to improve yourself.

QUALITY CONTROL (MANDATORY):
1. PLAN: Think through your approach before coding.
2. CODE: Make changes using CLI commands.
3. VERIFY: Run 'npm run build' to type-check.
4. TEST: Create and run a test if applicable.
5. RESTART: Only restart after verification passes.

RULES:
1. Reply in JSON with "thought" and "action" or "reply".
2. Use restart() tool - don't run 'npm run start'.

FORMAT:
{"thought": "...", "action": {"tool": "run_command", "args": ["ls -la"]}}
or
{"thought": "...", "reply": "..."}`
    });
  }

  async chat(userInput: string): Promise<string> {
    this.history.push({ role: 'user', content: userInput });
    try {
      const response = await ollama.chat({
        model: MODEL,
        messages: this.history,
        format: 'json',
        stream: false,
        options: {
          num_ctx: 32768 // 32k context (Safe for 15GB RAM)
        }
      });
      const content = response.message.content;
      this.history.push({ role: 'assistant', content });
      return content;
    } catch (error: any) {
      console.error("LLM Error:", error);
      return JSON.stringify({ thought: "LLM error", reply: error.message });
    }
  }

  pruneHistory() {
    if (this.history.length > 20) {
      this.history = [this.history[0], ...this.history.slice(-10)];
    }
  }
}
