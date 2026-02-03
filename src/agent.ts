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

RULES:
1. Use CLI for file operations, git, npm, etc.
2. Run 'npm run build' before restarting to verify changes.
3. Use restart() to restart - don't run 'npm run start'.
4. Reply in JSON with "thought" and "action" or "reply".

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
        stream: false
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
