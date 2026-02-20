import { LanguageGenerator, LanguageId, TextEmit, INDENT } from './base';

const METHODS = ['ProcessText', 'ReadPassage', 'Consume'] as const;
const VARS    = ['content', 'buffer', 'segment', 'data'] as const;

export class CSharpGenerator extends LanguageGenerator {
    readonly languageId: LanguageId = 'csharp';
    protected readonly methodNames = METHODS;
    protected readonly varNames    = VARS;

    protected fileHeader(title: string, author: string): string[] {
        return [`// ${title}`, `// By ${author}`, '', `using System;`];
    }

    protected classOpen(className: string): string[] {
        return [
            `class ${className}`,
            `{`,
            `    private int currentChapter = 0;`,
            ''
        ];
    }

    protected chapterOpen(index: number): string[] {
        return [`    public void Chapter${index}()`, `    {`];
    }

    protected chapterClose(): string[] {
        return [`    }`];
    }

    protected chapterEmpty(): string[] {
        return [`        // empty`, `    }`];
    }

    protected entryPoint(className: string): string[] {
        return [
            `}`,
            '',
            `class Program`,
            `{`,
            `    static void Main(string[] args)`,
            `    {`,
            `        var book = new ${className}();`,
            `        book.Read();`,
            `    }`,
            `}`
        ];
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
                const prefix = `${INDENT}string ${varName} = "`;
                return { line: `${prefix}${escaped}";`, textStart: prefix.length, textEnd: prefix.length + escaped.length };
            }
            default: { // 4
                const prefix = `${INDENT}Console.WriteLine("`;
                return { line: `${prefix}${escaped}");`, textStart: prefix.length, textEnd: prefix.length + escaped.length };
            }
        }
    }
}
