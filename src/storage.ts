import * as vscode from 'vscode';

export interface ReadingProgress {
    line: number;
    timestamp: number;
}

export interface Highlight {
    range: vscode.Range;
    color?: string; // Future proofing
    text?: string; // The text highlighted
}

export class Storage {
    constructor(private context: vscode.ExtensionContext) { }

    public saveProgress(bookHash: string, line: number) {
        const key = `progress_${bookHash}`;
        const progress: ReadingProgress = {
            line,
            timestamp: Date.now()
        };
        this.context.globalState.update(key, progress);
    }

    public getProgress(bookHash: string): ReadingProgress | undefined {
        const key = `progress_${bookHash}`;
        return this.context.globalState.get<ReadingProgress>(key);
    }

    public saveHighlight(bookHash: string, highlight: Highlight) {
        const key = `highlights_${bookHash}`;
        let highlights = this.context.globalState.get<Highlight[]>(key) || [];
        highlights.push(highlight);
        this.context.globalState.update(key, highlights);
    }

    public getHighlights(bookHash: string): Highlight[] {
        const key = `highlights_${bookHash}`;
        return this.context.globalState.get<Highlight[]>(key) || [];
    }

    // Simple hash for file path to use as key
    public static hash(str: string): string {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(16);
    }
}
