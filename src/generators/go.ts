import { LanguageGenerator, LanguageId, TextEmit, INDENT } from './base';

const METHODS = ['processText', 'readPassage', 'consume'] as const;
const VARS    = ['content', 'buffer', 'segment', 'data'] as const;

export class GoGenerator extends LanguageGenerator {
    readonly languageId: LanguageId = 'go';
    protected readonly methodNames = METHODS;
    protected readonly varNames    = VARS;

    protected fileHeader(title: string, author: string): string[] {
        return [`// ${title}`, `// By ${author}`, '', `package main`, '', `import "fmt"`];
    }

    protected classOpen(className: string): string[] {
        return [
            `type ${className} struct {`,
            `    currentChapter int`,
            `}`,
            ''
        ];
    }

    protected chapterOpen(index: number): string[] {
        return [`func (b *${this.className}) chapter${index}() {`];
    }

    protected chapterClose(): string[] {
        return [`    return`, `}`];
    }

    protected chapterEmpty(): string[] {
        return [`    // empty`, `}`];
    }

    protected entryPoint(className: string): string[] {
        return [
            `func main() {`,
            `    book := &${className}{}`,
            `    book.Read()`,
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
                const prefix = `${INDENT}b.${method}("`;
                return { line: `${prefix}${escaped}")`, textStart: prefix.length, textEnd: prefix.length + escaped.length };
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
                const prefix = `${INDENT}${varName} := "`;
                return { line: `${prefix}${escaped}"`, textStart: prefix.length, textEnd: prefix.length + escaped.length };
            }
            default: { // 4
                const prefix = `${INDENT}fmt.Println("`;
                return { line: `${prefix}${escaped}")`, textStart: prefix.length, textEnd: prefix.length + escaped.length };
            }
        }
    }
}
