import { LanguageGenerator, LanguageId, TextEmit, INDENT } from './base';

const METHODS = ['process_text', 'read_passage', 'consume'] as const;
const VARS    = ['content', 'buffer', 'segment', 'data'] as const;

export class CGenerator extends LanguageGenerator {
    readonly languageId: LanguageId = 'c';
    protected readonly methodNames = METHODS;
    protected readonly varNames    = VARS;

    protected fileHeader(title: string, author: string): string[] {
        return [
            `/*`,
            ` * ${title}`,
            ` * By ${author}`,
            ` */`,
            '',
            `#include <stdio.h>`,
            `#include <stdlib.h>`,
            `#include <string.h>`
        ];
    }

    protected classOpen(className: string): string[] {
        return [
            `typedef struct {`,
            `    int current_chapter;`,
            `} ${className};`,
            ''
        ];
    }

    protected chapterOpen(index: number): string[] {
        return [`int chapter_${index}(${this.className} *b) {`];
    }

    protected chapterClose(): string[] {
        return [`    return 1;`, `}`];
    }

    protected chapterEmpty(): string[] {
        return [`    /* empty */`, `    return 1;`, `}`];
    }

    protected entryPoint(className: string): string[] {
        return [
            `int main(void) {`,
            `    ${className} book = {0};`,
            `    chapter_1(&book);`,
            `    return 0;`,
            `}`
        ];
    }

    protected renderTextLine(text: string, escaped: string, mode: number, variant: number): TextEmit {
        switch (mode) {
            case 0: {
                const prefix = `${INDENT}/* `;
                return { line: `${prefix}${text} */`, textStart: prefix.length, textEnd: prefix.length + text.length };
            }
            case 1: {
                const method = this.methodNames[variant % this.methodNames.length];
                const prefix = `${INDENT}${method}(b, "`;
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
                const prefix = `${INDENT}char *${varName} = "`;
                return { line: `${prefix}${escaped}";`, textStart: prefix.length, textEnd: prefix.length + escaped.length };
            }
            default: { // 4
                const prefix = `${INDENT}printf("`;
                return { line: `${prefix}${escaped}\\n");`, textStart: prefix.length, textEnd: prefix.length + escaped.length };
            }
        }
    }
}
