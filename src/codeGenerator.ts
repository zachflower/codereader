import { Book, BookChapter } from './epubParser';

export interface GenerationResult {
    code: string;
    // line number → [startChar, endChar] of the actual book text within that line
    textLineRanges: Map<number, [number, number]>;
}

const METHOD_NAMES = ['_process_text', '_read_passage', '_consume'];
const VAR_NAMES = ['_content', '_buffer', '_segment', '_data'];

export class PythonGenerator {
    generate(book: Book): GenerationResult {
        const textLineRanges = new Map<number, [number, number]>();
        const lines: string[] = [];

        const emit = (line: string) => lines.push(line);
        const emitText = (line: string, textStart: number, textEnd: number) => {
            textLineRanges.set(lines.length, [textStart, textEnd]);
            lines.push(line);
        };

        emit(`"""`);
        emit(book.title);
        emit(`By ${book.author}`);
        emit(`"""`);
        emit('');
        emit(`import sys`);
        emit(`import os`);
        emit('');
        emit(`class ${this.toClassName(book.title)}:`);
        emit(`    def __init__(self):`);
        emit(`        self.current_chapter = 0`);
        emit('');

        book.chapters.forEach((chapter, index) => {
            this.generateChapter(chapter, index + 1, emit, emitText);
        });

        emit(`if __name__ == "__main__":`);
        emit(`    book = ${this.toClassName(book.title)}()`);
        emit(`    book.read()`);

        return { code: lines.join('\n'), textLineRanges };
    }

    private generateChapter(
        chapter: BookChapter,
        index: number,
        emit: (line: string) => void,
        emitText: (line: string, textStart: number, textEnd: number) => void
    ): void {
        emit(`    def chapter_${index}(self):`);

        if (!chapter.content) {
            emit(`        pass`);
            emit('');
            return;
        }

        const paragraphs = chapter.content
            .split('\n\n')
            .map(p => p.trim().replace(/\n/g, ' '))
            .filter(p => p.length > 0);

        let seed = index * 31;
        for (const para of paragraphs) {
            const displayLines = this.splitAtSentences(para);
            for (const text of displayLines) {
                const escaped = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
                seed = this.nextSeed(seed);
                const mode = seed % 5;
                const variant = this.nextSeed(seed) % 4;

                switch (mode) {
                    case 0: {
                        const prefix = `        # `;
                        emitText(`${prefix}${text}`, prefix.length, prefix.length + text.length);
                        break;
                    }
                    case 1: {
                        const method = METHOD_NAMES[variant % METHOD_NAMES.length];
                        const prefix = `        self.${method}("`;
                        emitText(`${prefix}${escaped}")`, prefix.length, prefix.length + escaped.length);
                        break;
                    }
                    case 2: {
                        const indent = `        `;
                        emit(`        """`);
                        emitText(`${indent}${text}`, indent.length, indent.length + text.length);
                        emit(`        """`);
                        break;
                    }
                    case 3: {
                        const varName = VAR_NAMES[variant % VAR_NAMES.length];
                        const prefix = `        ${varName} = "`;
                        emitText(`${prefix}${escaped}"`, prefix.length, prefix.length + escaped.length);
                        break;
                    }
                    case 4: {
                        const prefix = `        sys.stdout.write("`;
                        emitText(`${prefix}${escaped}\\n")`, prefix.length, prefix.length + escaped.length);
                        break;
                    }
                }
            }
        }

        emit(`        return True`);
        emit('');
    }

    private splitAtSentences(text: string, maxLen: number = 160): string[] {
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

    private nextSeed(seed: number): number {
        return ((seed * 1664525 + 1013904223) & 0x7fffffff);
    }

    private toClassName(str: string): string {
        return str.replace(/[^a-zA-Z0-9]/g, '') || 'Book';
    }
}
