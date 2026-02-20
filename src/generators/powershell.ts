import { LanguageGenerator, LanguageId, TextEmit, INDENT } from './base';

const METHODS = ['ProcessText', 'ReadPassage', 'Consume'] as const;
const VARS    = ['content', 'buffer', 'segment', 'data'] as const;

export class PowerShellGenerator extends LanguageGenerator {
    readonly languageId: LanguageId = 'powershell';
    protected readonly methodNames = METHODS;
    protected readonly varNames    = VARS;

    private psEscape(text: string): string {
        return text
            .replace(/`/g, '``')
            .replace(/\$/g, '`$')
            .replace(/"/g, '`"');
    }

    protected fileHeader(title: string, author: string): string[] {
        return [`# ${title}`, `# By ${author}`];
    }

    protected classOpen(className: string): string[] {
        return [
            `class ${className} {`,
            `    [int] $currentChapter = 0`,
            ''
        ];
    }

    protected chapterOpen(index: number): string[] {
        return [`    [void] Chapter${index}() {`];
    }

    protected chapterClose(): string[] {
        return [`    }`];
    }

    protected chapterEmpty(): string[] {
        return [`        # empty`, `    }`];
    }

    protected entryPoint(className: string): string[] {
        return [
            `}`,
            ``,
            `$book = [${className}]::new()`,
            `$book.Read()`
        ];
    }

    protected renderTextLine(text: string, _escaped: string, mode: number, variant: number): TextEmit {
        const escaped = this.psEscape(text);
        switch (mode) {
            case 0: {
                const prefix = `${INDENT}# `;
                return { line: `${prefix}${text}`, textStart: prefix.length, textEnd: prefix.length + text.length };
            }
            case 1: {
                const method = this.methodNames[variant % this.methodNames.length];
                const prefix = `${INDENT}$this.${method}("`;
                return { line: `${prefix}${escaped}")`, textStart: prefix.length, textEnd: prefix.length + escaped.length };
            }
            case 2: {
                const prefix = `${INDENT}  `;
                return {
                    before: [`${INDENT}<#`],
                    line: `${prefix}${text}`,
                    textStart: prefix.length,
                    textEnd: prefix.length + text.length,
                    after: [`${INDENT}#>`]
                };
            }
            case 3: {
                const varName = this.varNames[variant % this.varNames.length];
                const prefix = `${INDENT}$${varName} = "`;
                return { line: `${prefix}${escaped}"`, textStart: prefix.length, textEnd: prefix.length + escaped.length };
            }
            default: { // 4
                const prefix = `${INDENT}Write-Host "`;
                return { line: `${prefix}${escaped}"`, textStart: prefix.length, textEnd: prefix.length + escaped.length };
            }
        }
    }
}
