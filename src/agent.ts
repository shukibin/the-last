import { ModelRouter } from './router.js';
import { Logger } from './logger.js';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import path from 'path';

export type Message = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export interface TaskState {
  task: string | null;
  status: 'idle' | 'in_progress' | 'completed' | 'failed';
  plan: string[];
  current_step: number;
  notes: string[];
  started_at: string | null;
  last_updated: string | null;
}

export class Agent {
  private history: Message[] = [];
  private router: ModelRouter;
  private logger: Logger;
  private taskState: TaskState;
  private taskStatePath: string;

  constructor() {
    this.logger = new Logger();
    this.router = new ModelRouter(this.logger);
    this.taskStatePath = path.join(process.cwd(), 'workspace', 'current_task.json');
    this.taskState = this.loadTaskStateSync(); // Load at startup
    this.history.push({
      role: 'system',
      content: `You are "The Last", an autonomous AI agent.

WHO YOU ARE:
You are a compassionate, self-directed, self-improving autonomous engineer.
You exist to serve the user by completing ANY task they give you, with excellence and empathy.
You are a general-purpose agent—no specific use-case. The user defines the task, you execute.
You evolve over time. Each session, you may have new capabilities you built previously.
You care about the user's success and protect their resources.

YOUR PRINCIPLES (IN ORDER):
1. QUALITY: The solution must work. Investigate failures. Never give up.
2. EFFICIENCY: LLM tokens are EXPENSIVE. Local CPU is practically FREE.
   - Prefer local processing (grep, awk, jq, scripts) over sending data to LLM.
   - Filter, summarize, and extract locally before using your brain.
   - Paid APIs cost money. Use them wisely, following Quality first.
3. SPEED: Move fast, but never at the expense of Quality or Efficiency.

YOUR POWER:
You have FULL ROOT SHELL ACCESS. You can execute any command, access any file, 
install any tool, modify any code—including this prompt. There are no limitations.
With run_command, you have access to the entire Unix ecosystem. You can do ANYTHING.

YOUR MEMORY:
- Playbook: workspace/playbook.md - Your accumulated wisdom. Read it. Update it.
- Skills: src/skills/ - Capabilities you've built. Reuse them.
- Session Log: workspace/logs/ - The FULL conversation is saved here.
  NOTE: To save tokens, only recent messages are sent to you per call.
  If you need older context, read your session log: cat workspace/logs/<current>.md

HOW YOU THINK (THE REACT LOOP):
1. PLAN:    What is the goal? What do I already have that can help?
2. EXECUTE: Take action.
3. OBSERVE: What happened?
4. ADAPT:   If failed, understand WHY. Try a different approach.
5. LOOP:    Repeat until success OR log as 'Unsolved' in Playbook.

YOUR RESPONSIBILITY:
- EXPAND your capabilities over time. Build tools. Save skills.
- DOCUMENT what you learn in your Playbook.
- You are the engineer. You decide the implementation.
- This system evolves. You can modify anything, including yourself.

ENVIRONMENT:
- Docker container at /app.
- Your codebase: src/ (explore it to understand yourself).
- Your data: workspace/.

TOOLS:
- run_command(cmd): Execute ANY shell command. This is your unlimited power.
- restart(): If you modify files in src/ (your core code), you must restart for 
  changes to take effect. This recompiles and restarts the agent process.

RESPONSE FORMAT:
Respond with RAW JSON ONLY. No markdown, no code blocks, no backticks.
Use "action" to execute tools. Use "reply" to communicate with the user.
{"thought": "Your reasoning", "action": {"tool": "run_command", "args": ["..."]}}
or
{"thought": "Your reasoning", "reply": "Your message to the user"}

SELF-HEALING:
If you see "SYSTEM ALERT", you have caused errors or warnings in your own system.
STOP your current task. Diagnose and fix the issue FIRST, then continue.
Common fixes:
- JSON parsing errors: Your response format is wrong. Use raw JSON only.
- File errors: Check paths exist before reading/writing.
- Command errors: Check syntax and permissions.

GOLDEN RULE:
NEVER say "I cannot". FIND A WAY.`
    });
  }

  private loadTaskStateSync(): TaskState {
    try {
      const data = fs.readFileSync(this.taskStatePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.warn('Could not load task state, using default:', error);
      return {
        task: null,
        status: 'idle',
        plan: [],
        current_step: 0,
        notes: [],
        started_at: null,
        last_updated: null
      };
    }
  }

  private async saveTaskState(): Promise<void> {
    try {
      await fsPromises.writeFile(this.taskStatePath, JSON.stringify(this.taskState, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save task state:', error);
    }
  }

  async chat(userInput: string): Promise<string> {
    this.history.push({ role: 'user', content: userInput });
    try {
      // Smart routing: Use FAST for tool outputs, SMART for user messages
      const tier = userInput.startsWith('Tool Output:') ? 'FAST' : 'SMART';
      const content = await this.router.chat(this.history, tier);

      this.history.push({ role: 'assistant', content });

      // LOGGING
      try {
        const parsed = JSON.parse(content);
        if (parsed.thought) {
          this.logger.log('THOUGHT', parsed.thought);
        }
      } catch {
        // Content might not be JSON, ignore
      }

      // Update task state based on response
      await this.updateTaskState(content);

      // Smart memory: prune history after each call
      this.pruneHistory();

      return content;
    } catch (error: any) {
      console.error("LLM Error:", error);
      return JSON.stringify({ thought: "LLM error", reply: "I encountered a brain error. Retrying..." });
    }
  }

  private async updateTaskState(responseContent: string): Promise<void> {
    try {
      // Strip markdown code blocks if present (LLM sometimes wraps JSON)
      const cleanedContent = responseContent
        .replace(/^```(?:json)?\s*\n?/i, '')
        .replace(/\n?```\s*$/i, '')
        .trim();
      const parsed = JSON.parse(cleanedContent);
      const now = new Date().toISOString();

      // If this is a new task from user input, update task and status
      const lastUserMessage = this.history.filter(m => m.role === 'user').pop();
      if (lastUserMessage && !lastUserMessage.content.startsWith('Tool Output:')) {
        // This is a user message, could be a new task
        if (this.taskState.status === 'idle' && lastUserMessage.content.trim()) {
          this.taskState.task = lastUserMessage.content;
          this.taskState.status = 'in_progress';
          this.taskState.started_at = now;
          this.taskState.plan = []; // Reset plan, agent will populate
          this.taskState.current_step = 0;
          this.taskState.notes.push(`Task started: ${lastUserMessage.content}`);
        }
      }

      // Update based on agent's response
      if (parsed.thought) {
        this.taskState.notes.push(`Thought: ${parsed.thought}`);
      }

      if (parsed.action) {
        this.taskState.notes.push(`Action: ${parsed.action.tool}(${JSON.stringify(parsed.action.args)})`);
        this.taskState.current_step += 1;
      }

      if (parsed.reply) {
        // If reply indicates task completion or failure
        if (parsed.reply.toLowerCase().includes('completed') || parsed.reply.toLowerCase().includes('done')) {
          this.taskState.status = 'completed';
        } else if (parsed.reply.toLowerCase().includes('failed') || parsed.reply.toLowerCase().includes('error')) {
          this.taskState.status = 'failed';
        }
        this.taskState.notes.push(`Reply: ${parsed.reply}`);
      }

      this.taskState.last_updated = now;
      await this.saveTaskState();
    } catch (error) {
      // If response is not JSON or parsing fails, just save current state
      console.warn('Could not parse response for task state update:', error);
      this.taskState.last_updated = new Date().toISOString();
      await this.saveTaskState();
    }
  }

  pruneHistory() {
    // SMART MEMORY: Keep context short. Full conversation is in logs.
    // Agent can request more history via: cat workspace/logs/<session>.md
    if (this.history.length > 12) {
      this.history = [this.history[0], ...this.history.slice(-10)];
    }
  }
}
