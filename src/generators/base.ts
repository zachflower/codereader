import { Book, BookChapter } from '../epubParser';

export interface GenerationResult {
    code: string;
    // line number → [startChar, endChar] of the actual book text within that line
    textLineRanges: Map<number, [number, number]>;
}

export type LanguageId = 'python' | 'javascript' | 'php';

// Describes how a single text line should be emitted.
// `before`/`after` carry non-text lines surrounding it (e.g. block-comment delimiters).
export interface TextEmit {
    before?: string[];
    line: string;
    textStart: number;
    textEnd: number;
    after?: string[];
}

// 8 spaces – all generators indent method bodies 4 (class) + 4 (method body)
export const INDENT = '        ';

// ── Abstract base ─────────────────────────────────────────────────────────────

export abstract class LanguageGenerator {
    abstract readonly languageId: LanguageId;

    protected abstract readonly methodNames: readonly string[];
    protected abstract readonly varNames: readonly string[];

    // Slots filled by each concrete language
    protected abstract fileHeader(title: string, author: string): string[];
    protected abstract classOpen(className: string): string[];
    protected abstract chapterOpen(index: number): string[];
    protected abstract chapterClose(): string[];
    protected abstract chapterEmpty(): string[];
    protected abstract entryPoint(className: string): string[];
    protected abstract renderTextLine(text: string, escaped: string, mode: number, variant: number): TextEmit;

    // Template method — orchestrates the full generation
    generate(book: Book): GenerationResult {
        const textLineRanges = new Map<number, [number, number]>();
        const lines: string[] = [];

        const emit = (line: string) => lines.push(line);
        const emitText = (line: string, textStart: number, textEnd: number) => {
            textLineRanges.set(lines.length, [textStart, textEnd]);
            lines.push(line);
        };

        const className = this.toClassName(book.title);

        for (const line of this.fileHeader(book.title, book.author)) { emit(line); }
        emit('');
        for (const line of this.classOpen(className)) { emit(line); }

        book.chapters.forEach((chapter, i) => {
            this.generateChapter(chapter, i + 1, emit, emitText);
        });

        for (const line of this.entryPoint(className)) { emit(line); }

        return { code: lines.join('\n'), textLineRanges };
    }

    private generateChapter(
        chapter: BookChapter,
        index: number,
        emit: (line: string) => void,
        emitText: (line: string, textStart: number, textEnd: number) => void
    ): void {
        for (const line of this.chapterOpen(index)) { emit(line); }

        if (!chapter.content) {
            for (const line of this.chapterEmpty()) { emit(line); }
            emit('');
            return;
        }

        const paragraphs = chapter.content
            .split('\n\n')
            .map(p => p.trim().replace(/\n/g, ' '))
            .filter(p => p.length > 0);

        let seed = index * 31;
        for (const para of paragraphs) {
            for (const text of this.splitAtSentences(para)) {
                const escaped = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
                seed = this.nextSeed(seed);
                const mode = seed % 5;
                const variant = this.nextSeed(seed) % 4;

                const r = this.renderTextLine(text, escaped, mode, variant);
                for (const b of r.before ?? []) { emit(b); }
                emitText(r.line, r.textStart, r.textEnd);
                for (const a of r.after ?? []) { emit(a); }
            }
        }

        for (const line of this.chapterClose()) { emit(line); }
        emit('');
    }

    // ── Shared utilities ──────────────────────────────────────────────────────

    protected splitAtSentences(text: string, maxLen = 160): string[] {
        if (text.length <= maxLen) { return [text]; }
        const parts = text.match(/[^.!?]*[.!?]+(?:\s|$)|[^.!?]+$/g) ?? [text];
        const result: string[] = [];
        let current = '';
        for (const part of parts) {
            const trimmed = part.trim();
            if (!trimmed) { continue; }
            if (!current) {
                current = trimmed;
            } else if (current.length + 1 + trimmed.length <= maxLen) {
                current += ' ' + trimmed;
            } else {
                result.push(current);
                current = trimmed;
            }
        }
        if (current) { result.push(current); }
        return result.length ? result : [text];
    }

    protected nextSeed(seed: number): number {
        return ((seed * 1664525 + 1013904223) & 0x7fffffff);
    }

    protected toClassName(str: string): string {
        return str.replace(/[^a-zA-Z0-9]/g, '') || 'Book';
    }
}
