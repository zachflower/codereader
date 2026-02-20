import { LanguageGenerator, LanguageId, TextEmit, INDENT } from './base';

const METHODS = ['ProcessText', 'ReadPassage', 'Consume'] as const;
const VARS    = ['content', 'buffer', 'segment', 'data'] as const;

export class VBGenerator extends LanguageGenerator {
    readonly languageId: LanguageId = 'vb';
    protected readonly methodNames = METHODS;
    protected readonly varNames    = VARS;

    protected fileHeader(title: string, author: string): string[] {
        return [`' ${title}`, `' By ${author}`, '', `Imports System`];
    }

    protected classOpen(className: string): string[] {
        return [
            `Class ${className}`,
            `    Private currentChapter As Integer = 0`,
            ''
        ];
    }

    protected chapterOpen(index: number): string[] {
        return [`    Public Sub Chapter${index}()`];
    }

    protected chapterClose(): string[] {
        return [`    End Sub`];
    }

    protected chapterEmpty(): string[] {
        return [`        ' empty`, `    End Sub`];
    }

    protected entryPoint(className: string): string[] {
        return [
            `End Class`,
            '',
            `Module Program`,
            `    Sub Main()`,
            `        Dim book As New ${className}()`,
            `        book.Read()`,
            `    End Sub`,
            `End Module`
        ];
    }

    protected renderTextLine(text: string, _escaped: string, mode: number, variant: number): TextEmit {
        // VB uses "" to escape double-quotes, not \"
        const vbStr = text.replace(/"/g, '""');
        switch (mode) {
            case 0: {
                const prefix = `${INDENT}' `;
                return { line: `${prefix}${text}`, textStart: prefix.length, textEnd: prefix.length + text.length };
            }
            case 1: {
                const method = this.methodNames[variant % this.methodNames.length];
                const prefix = `${INDENT}Me.${method}("`;
                return { line: `${prefix}${vbStr}")`, textStart: prefix.length, textEnd: prefix.length + vbStr.length };
            }
            case 2: {
                const prefix = `${INDENT}' `;
                return {
                    before: [`${INDENT}'`],
                    line: `${prefix}${text}`,
                    textStart: prefix.length,
                    textEnd: prefix.length + text.length,
                    after: [`${INDENT}'`]
                };
            }
            case 3: {
                const varName = this.varNames[variant % this.varNames.length];
                const prefix = `${INDENT}Dim ${varName} As String = "`;
                return { line: `${prefix}${vbStr}"`, textStart: prefix.length, textEnd: prefix.length + vbStr.length };
            }
            default: { // 4
                const prefix = `${INDENT}Console.WriteLine("`;
                return { line: `${prefix}${vbStr}")`, textStart: prefix.length, textEnd: prefix.length + vbStr.length };
            }
        }
    }
}
