import { Book, BookChapter } from './epubParser';

export interface GenerationResult {
    code: string;
    // line number → [startChar, endChar] of the actual book text within that line
    textLineRanges: Map<number, [number, number]>;
}

export type LanguageId = 'python' | 'javascript' | 'php';

// Describes how a single text line should be emitted.
// `before`/`after` are non-text lines surrounding the content line (e.g. block comment delimiters).
interface TextEmit {
    before?: string[];
    line: string;
    textStart: number;
    textEnd: number;
    after?: string[];
}

// 8 spaces — all generators indent method bodies with 4 (class) + 4 (method body)
const INDENT = '        ';

// ── Abstract base ─────────────────────────────────────────────────────────────

abstract class LanguageGenerator {
    abstract readonly languageId: LanguageId;

    protected abstract readonly methodNames: readonly string[];
    protected abstract readonly varNames: readonly string[];

    // Slots filled by each concrete generator
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

// ── Python ────────────────────────────────────────────────────────────────────

const PY_METHODS = ['_process_text', '_read_passage', '_consume'] as const;
const PY_VARS    = ['_content', '_buffer', '_segment', '_data'] as const;

class PythonGenerator extends LanguageGenerator {
    readonly languageId: LanguageId = 'python';
    protected readonly methodNames = PY_METHODS;
    protected readonly varNames    = PY_VARS;

    protected fileHeader(title: string, author: string): string[] {
        return [`"""`, title, `By ${author}`, `"""`, '', `import sys`, `import os`];
    }

    protected classOpen(className: string): string[] {
        return [
            `class ${className}:`,
            `    def __init__(self):`,
            `        self.current_chapter = 0`,
            ''
        ];
    }

    protected chapterOpen(index: number): string[] {
        return [`    def chapter_${index}(self):`];
    }

    protected chapterClose(): string[] {
        return [`        return True`];
    }

    protected chapterEmpty(): string[] {
        return [`        pass`];
    }

    protected entryPoint(className: string): string[] {
        return [
            `if __name__ == "__main__":`,
            `    book = ${className}()`,
            `    book.read()`
        ];
    }

    protected renderTextLine(text: string, escaped: string, mode: number, variant: number): TextEmit {
        switch (mode) {
            case 0: {
                const prefix = `${INDENT}# `;
                return { line: `${prefix}${text}`, textStart: prefix.length, textEnd: prefix.length + text.length };
            }
            case 1: {
                const method = this.methodNames[variant % this.methodNames.length];
                const prefix = `${INDENT}self.${method}("`;
                return { line: `${prefix}${escaped}")`, textStart: prefix.length, textEnd: prefix.length + escaped.length };
            }
            case 2: {
                return {
                    before: [`${INDENT}"""`],
                    line: `${INDENT}${text}`,
                    textStart: INDENT.length,
                    textEnd: INDENT.length + text.length,
                    after: [`${INDENT}"""`]
                };
            }
            case 3: {
                const varName = this.varNames[variant % this.varNames.length];
                const prefix = `${INDENT}${varName} = "`;
                return { line: `${prefix}${escaped}"`, textStart: prefix.length, textEnd: prefix.length + escaped.length };
            }
            default: { // 4
                const prefix = `${INDENT}sys.stdout.write("`;
                return { line: `${prefix}${escaped}\\n")`, textStart: prefix.length, textEnd: prefix.length + escaped.length };
            }
        }
    }
}

// ── JavaScript ────────────────────────────────────────────────────────────────

const JS_METHODS = ['_processText', '_readPassage', '_consume'] as const;
const JS_VARS    = ['_content', '_buffer', '_segment', '_data'] as const;

class JavaScriptGenerator extends LanguageGenerator {
    readonly languageId: LanguageId = 'javascript';
    protected readonly methodNames = JS_METHODS;
    protected readonly varNames    = JS_VARS;

    protected fileHeader(title: string, author: string): string[] {
        return [`/**`, ` * ${title}`, ` * By ${author}`, ` */`, '', `'use strict';`];
    }

    protected classOpen(className: string): string[] {
        return [
            `class ${className} {`,
            `    constructor() {`,
            `        this.currentChapter = 0;`,
            `    }`,
            ''
        ];
    }

    protected chapterOpen(index: number): string[] {
        return [`    chapter${index}() {`];
    }

    protected chapterClose(): string[] {
        return [`        return true;`, `    }`];
    }

    protected chapterEmpty(): string[] {
        return [`        // empty`, `    }`];
    }

    protected entryPoint(className: string): string[] {
        return [`}`, '', `const book = new ${className}();`, `book.read();`];
    }

    protected renderTextLine(text: string, escaped: string, mode: number, variant: number): TextEmit {
        switch (mode) {
            case 0: {
                const prefix = `${INDENT}// `;
                return { line: `${prefix}${text}`, textStart: prefix.length, textEnd: prefix.length + text.length };
            }
            case 1: {
                const method = this.methodNames[variant % this.methodNames.length];
                const prefix = `${INDENT}this.${method}("`;
                return { line: `${prefix}${escaped}");`, textStart: prefix.length, textEnd: prefix.length + escaped.length };
            }
            case 2: {
                const prefix = `${INDENT} * `;
                return {
                    before: [`${INDENT}/*`],
                    line: `${prefix}${text}`,
                    textStart: prefix.length,
                    textEnd: prefix.length + text.length,
                    after: [`${INDENT} */`]
                };
            }
            case 3: {
                const varName = this.varNames[variant % this.varNames.length];
                const prefix = `${INDENT}const ${varName} = "`;
                return { line: `${prefix}${escaped}";`, textStart: prefix.length, textEnd: prefix.length + escaped.length };
            }
            default: { // 4
                const prefix = `${INDENT}console.log("`;
                return { line: `${prefix}${escaped}");`, textStart: prefix.length, textEnd: prefix.length + escaped.length };
            }
        }
    }
}

// ── PHP ───────────────────────────────────────────────────────────────────────

const PHP_METHODS = ['processText', 'readPassage', 'consume'] as const;
const PHP_VARS    = ['content', 'buffer', 'segment', 'data'] as const;

class PhpGenerator extends LanguageGenerator {
    readonly languageId: LanguageId = 'php';
    protected readonly methodNames = PHP_METHODS;
    protected readonly varNames    = PHP_VARS;

    protected fileHeader(title: string, author: string): string[] {
        return [`<?php`, `/**`, ` * ${title}`, ` * By ${author}`, ` */`];
    }

    protected classOpen(className: string): string[] {
        return [
            `class ${className} {`,
            `    private $current_chapter = 0;`,
            ''
        ];
    }

    protected chapterOpen(index: number): string[] {
        return [`    public function chapter_${index}() {`];
    }

    protected chapterClose(): string[] {
        return [`        return true;`, `    }`];
    }

    protected chapterEmpty(): string[] {
        return [`        // empty`, `    }`];
    }

    protected entryPoint(className: string): string[] {
        return [`}`, '', `$book = new ${className}();`, `$book->read();`];
    }

    protected renderTextLine(text: string, escaped: string, mode: number, variant: number): TextEmit {
        switch (mode) {
            case 0: {
                const prefix = `${INDENT}// `;
                return { line: `${prefix}${text}`, textStart: prefix.length, textEnd: prefix.length + text.length };
            }
            case 1: {
                const method = this.methodNames[variant % this.methodNames.length];
                const prefix = `${INDENT}$this->${method}("`;
                return { line: `${prefix}${escaped}");`, textStart: prefix.length, textEnd: prefix.length + escaped.length };
            }
            case 2: {
                const prefix = `${INDENT} * `;
                return {
                    before: [`${INDENT}/*`],
                    line: `${prefix}${text}`,
                    textStart: prefix.length,
                    textEnd: prefix.length + text.length,
                    after: [`${INDENT} */`]
                };
            }
            case 3: {
                const varName = this.varNames[variant % this.varNames.length];
                const prefix = `${INDENT}$${varName} = "`;
                return { line: `${prefix}${escaped}";`, textStart: prefix.length, textEnd: prefix.length + escaped.length };
            }
            default: { // 4
                const prefix = `${INDENT}echo "`;
                return { line: `${prefix}${escaped}\\n";`, textStart: prefix.length, textEnd: prefix.length + escaped.length };
            }
        }
    }
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createGenerator(lang: LanguageId): { generate(book: Book): GenerationResult } {
    switch (lang) {
        case 'javascript': return new JavaScriptGenerator();
        case 'php':        return new PhpGenerator();
        default:           return new PythonGenerator();
    }
}
