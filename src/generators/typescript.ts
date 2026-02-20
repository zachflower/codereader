import { LanguageGenerator, LanguageId, TextEmit, INDENT } from './base';

const METHODS = ['processText', 'readPassage', 'consume'] as const;
const VARS    = ['content', 'buffer', 'segment', 'data'] as const;

export class TypeScriptGenerator extends LanguageGenerator {
    readonly languageId: LanguageId = 'typescript';
    protected readonly methodNames = METHODS;
    protected readonly varNames    = VARS;

    protected fileHeader(title: string, author: string): string[] {
        return [`/**`, ` * ${title}`, ` * By ${author}`, ` */`, '', `'use strict';`];
    }

    protected classOpen(className: string): string[] {
        return [
            `class ${className} {`,
            `    private currentChapter: number = 0;`,
            ''
        ];
    }

    protected chapterOpen(index: number): string[] {
        return [`    chapter${index}(): void {`];
    }

    protected chapterClose(): string[] {
        return [`        return;`, `    }`];
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
                const prefix = `${INDENT}const ${varName}: string = "`;
                return { line: `${prefix}${escaped}";`, textStart: prefix.length, textEnd: prefix.length + escaped.length };
            }
            default: { // 4
                const prefix = `${INDENT}console.log("`;
                return { line: `${prefix}${escaped}");`, textStart: prefix.length, textEnd: prefix.length + escaped.length };
            }
        }
    }
}
