import * as vscode from 'vscode';

export interface ReadingProgress {
    line: number;
    timestamp: number;
}

export interface Highlight {
    // Book-relative coordinates: renderer-independent positions.
    // startBookLine/endBookLine are 0-based indices into the ordered list of
    // text-containing lines from textLineRanges. startCharOffset/endCharOffset
    // are character offsets from the start of the text region in that line.
    startBookLine: number;
    startCharOffset: number;
    endBookLine: number;
    endCharOffset: number;
    color?: string;
    text?: string;
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
        const highlights = this.context.globalState.get<Highlight[]>(key) || [];
        highlights.push(highlight);
        this.context.globalState.update(key, highlights);
    }

    public removeHighlightAt(bookHash: string, bookLine: number, charOffset: number) {
        const key = `highlights_${bookHash}`;
        const highlights = this.context.globalState.get<Highlight[]>(key) || [];
        const filtered = highlights.filter(h => {
            if (bookLine < h.startBookLine || bookLine > h.endBookLine) { return true; }
            if (h.startBookLine === h.endBookLine) {
                return charOffset < h.startCharOffset || charOffset > h.endCharOffset;
            }
            if (bookLine === h.startBookLine) { return charOffset < h.startCharOffset; }
            if (bookLine === h.endBookLine) { return charOffset > h.endCharOffset; }
            return false; // cursor on a middle line of the range → remove
        });
        this.context.globalState.update(key, filtered);
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
