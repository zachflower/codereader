import { LanguageGenerator, LanguageId, TextEmit, INDENT } from './base';

const METHODS = ['_process_text', '_read_passage', '_consume'] as const;
const VARS    = ['_content', '_buffer', '_segment', '_data'] as const;

export class PythonGenerator extends LanguageGenerator {
    readonly languageId: LanguageId = 'python';
    protected readonly methodNames = METHODS;
    protected readonly varNames    = VARS;

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
