import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';

export type LogType = 'THOUGHT' | 'ACTION' | 'API_REQ' | 'API_CALL' | 'USER' | 'SYSTEM' | 'ERROR';

interface LogMetrics {
    model?: string;
    tokensIn?: number;
    tokensOut?: number;
    cost?: number;
    durationMs?: number;
}

export class Logger {
    private db: sqlite3.Database;
    private logFilePath: string;
    private sessionId: string;

    constructor() {
        const workspaceDir = path.resolve(process.cwd(), 'workspace');
        if (!fs.existsSync(workspaceDir)) fs.mkdirSync(workspaceDir);

        const logsDir = path.join(workspaceDir, 'logs');
        if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir);

        // 1. Setup SQLite
        const dbPath = path.join(workspaceDir, 'agent.db');
        this.db = new sqlite3.Database(dbPath);
        this.initDB();

        // 2. Setup Markdown Log
        this.sessionId = new Date().toISOString().replace(/[:.]/g, '-');
        this.logFilePath = path.join(logsDir, `session_${this.sessionId}.md`);
        this.writeToMd(`# Agent Session: ${this.sessionId}\n\n`);
    }

    private initDB() {
        this.db.serialize(() => {
            this.db.run(`
                CREATE TABLE IF NOT EXISTS sessions (
                    id TEXT PRIMARY KEY,
                    start_time TEXT,
                    summary TEXT
                )
            `);
            this.db.run(`
                CREATE TABLE IF NOT EXISTS events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT,
                    timestamp TEXT,
                    type TEXT,
                    content TEXT,
                    model TEXT,
                    tokens_in INTEGER,
                    tokens_out INTEGER,
                    cost REAL,
                    duration_ms INTEGER
                )
            `);
        });
        // Register session
        this.db.run(`INSERT INTO sessions (id, start_time) VALUES (?, ?)`, [this.sessionId, new Date().toISOString()]);
    }

    public log(type: LogType, content: string, metrics?: LogMetrics) {
        const timestamp = new Date().toISOString();
        const cost = metrics?.cost || this.calculateCost(metrics?.model, metrics?.tokensIn, metrics?.tokensOut);

        // 1. Write to DB
        this.db.run(
            `INSERT INTO events (session_id, timestamp, type, content, model, tokens_in, tokens_out, cost, duration_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [this.sessionId, timestamp, type, content, metrics?.model || null, metrics?.tokensIn || 0, metrics?.tokensOut || 0, cost, metrics?.durationMs || 0]
        );

        // 2. Write to Markdown
        this.writeMdEntry(type, content, metrics, cost);
    }

    private writeMdEntry(type: LogType, content: string, metrics?: LogMetrics, cost?: number) {
        const time = new Date().toLocaleTimeString();
        let header = `[${time}] ${type}`;
        if (metrics?.model) header += ` (${metrics.model})`;

        let meta = '';
        if (metrics?.tokensIn || metrics?.tokensOut) {
            meta += ` [Tokens: ${metrics.tokensIn || 0} → ${metrics.tokensOut || 0}]`;
        }
        if (cost && cost > 0) meta += ` [Cost: $${cost.toFixed(5)}]`;

        let body = content.trim();

        // Format Content Scenarios
        if (type === 'API_REQ') {
            try {
                const history = JSON.parse(content);
                if (Array.isArray(history)) {
                    const lastMsg = history[history.length - 1];
                    // Single line for requests if possible
                    body = `User: "${lastMsg.content.replace(/\n/g, ' ').substring(0, 100)}${lastMsg.content.length > 100 ? '...' : ''}"`;
                }
            } catch { }
        }
        else if (type === 'ERROR') {
            body = `!! ${body} !!`;
        }

        // Final Line: [10:00:00] API_CALL (gpt-4o) [Cost: $0.01]: Response text...
        this.writeToMd(`${header}${meta}: ${body}\n`);
    }

    private writeToMd(str: string) {
        fs.appendFileSync(this.logFilePath, str);
    }

    private calculateCost(model?: string, inTokens?: number, outTokens?: number): number {
        if (!model || !inTokens || !outTokens) return 0;

        // Prices per 1M tokens
        let priceIn = 0;
        let priceOut = 0;

        if (model.includes('claude-3-5')) { priceIn = 3.00; priceOut = 15.00; }
        else if (model.includes('gpt-4o')) { priceIn = 2.50; priceOut = 10.00; }
        else if (model.includes('deepseek')) { priceIn = 0.07; priceOut = 0.28; }
        // Ollama is 0

        const cost = (inTokens / 1_000_000 * priceIn) + (outTokens / 1_000_000 * priceOut);
        return cost;
    }
}
