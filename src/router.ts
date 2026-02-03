import Anthropic from '@anthropic-ai/sdk';
import { Ollama } from 'ollama';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export type ModelTier = 'SMART' | 'FAST';

export class ModelRouter {
    private anthropic: Anthropic | null = null;
    private ollama: Ollama;

    // Models
    private readonly CLAUDE_MODEL = 'claude-3-5-sonnet-20241022';
    private readonly OLLAMA_MODEL = 'qwen2.5-coder:14b'; // Local fallback/Fast

    constructor() {
        // Initialize Ollama (Local)
        this.ollama = new Ollama({ host: 'http://host.docker.internal:11434' });

        // Initialize Anthropic (Cloud)
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (apiKey && apiKey.startsWith('sk-')) {
            this.anthropic = new Anthropic({ apiKey });
            console.log("✅ Brain Upgrade: Anthropic (Claude 3.5 Sonnet) connected.");
        } else {
            console.warn("⚠️ No Anthropic API Key found in .env. using Local Ollama only.");
        }
    }

    async chat(messages: any[], tier: ModelTier = 'FAST'): Promise<string> {
        // ROUTING LOGIC
        if (tier === 'SMART' && this.anthropic) {
            return this.callClaude(messages);
        }
        return this.callOllama(messages);
    }

    private async callClaude(history: any[]): Promise<string> {
        try {
            // Extract system message
            const systemMessage = history.find(m => m.role === 'system')?.content || '';
            const userMessages = history.filter(m => m.role !== 'system');

            const msg = await this.anthropic!.messages.create({
                model: this.CLAUDE_MODEL,
                max_tokens: 8192,
                system: systemMessage,
                messages: userMessages.map(m => ({
                    role: m.role as 'user' | 'assistant',
                    content: m.content
                }))
            });

            // Handle TextBlock (content is array)
            const textBlock = msg.content[0];
            if (textBlock.type === 'text') {
                return textBlock.text;
            }
            return JSON.stringify(msg.content);

        } catch (error: any) {
            console.error("❌ Claude API Error:", error.message);
            console.log("🔄 Falling back to Local Ollama...");
            return this.callOllama(history);
        }
    }

    private async callOllama(history: any[]): Promise<string> {
        try {
            const response = await this.ollama.chat({
                model: this.OLLAMA_MODEL,
                messages: history,
                format: 'json',
                stream: false,
                options: {
                    num_ctx: 16384
                }
            });
            return response.message.content;
        } catch (error: any) {
            throw new Error(`Ollama Error: ${error.message}`);
        }
    }
}
