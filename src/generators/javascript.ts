import { LanguageGenerator, LanguageId, TextEmit, INDENT } from './base';

const METHODS = ['_processText', '_readPassage', '_consume'] as const;
const VARS    = ['_content', '_buffer', '_segment', '_data'] as const;

export class JavaScriptGenerator extends LanguageGenerator {
    readonly languageId: LanguageId = 'javascript';
    protected readonly methodNames = METHODS;
    protected readonly varNames    = VARS;

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
