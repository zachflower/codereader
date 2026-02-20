import { LanguageGenerator, LanguageId, TextEmit } from './base';

const METHODS = ['PROCESS_TEXT', 'READ_PASSAGE', 'CONSUME'] as const;
const VARS    = ['content', 'buffer', 'segment', 'data'] as const;
const IND     = '    '; // 4-space indent (no class wrapper)

export class BatchGenerator extends LanguageGenerator {
    readonly languageId: LanguageId = 'bat';
    protected readonly methodNames = METHODS;
    protected readonly varNames    = VARS;

    private batchEscape(text: string): string {
        return text
            .replace(/\^/g, '^^')
            .replace(/&/g, '^&')
            .replace(/\|/g, '^|')
            .replace(/</g, '^<')
            .replace(/>/g, '^>')
            .replace(/%/g, '%%');
    }

    protected fileHeader(title: string, author: string): string[] {
        return [`@ECHO OFF`, ``, `:: ${title}`, `:: By ${author}`];
    }

    protected classOpen(_className: string): string[] {
        return [];
    }

    protected chapterOpen(index: number): string[] {
        return [`:CHAPTER_${index}`];
    }

    protected chapterClose(): string[] {
        return [];
    }

    protected chapterEmpty(): string[] {
        return [`${IND}:: empty`];
    }

    protected entryPoint(_className: string): string[] {
        return [`EXIT /B 0`];
    }

    protected renderTextLine(text: string, _escaped: string, mode: number, variant: number): TextEmit {
        const escaped = this.batchEscape(text);
        switch (mode) {
            case 0: {
                const prefix = `${IND}:: `;
                return { line: `${prefix}${text}`, textStart: prefix.length, textEnd: prefix.length + text.length };
            }
            case 1: {
                const method = this.methodNames[variant % this.methodNames.length];
                const prefix = `${IND}CALL :${method} "`;
                return { line: `${prefix}${escaped}"`, textStart: prefix.length, textEnd: prefix.length + escaped.length };
            }
            case 2: {
                const prefix = `${IND}:: `;
                return {
                    before: [`${IND}::`],
                    line: `${prefix}${text}`,
                    textStart: prefix.length,
                    textEnd: prefix.length + text.length,
                    after: [`${IND}::`]
                };
            }
            case 3: {
                const varName = this.varNames[variant % this.varNames.length];
                const prefix = `${IND}SET ${varName}=`;
                return { line: `${prefix}${escaped}`, textStart: prefix.length, textEnd: prefix.length + escaped.length };
            }
            default: { // 4
                const prefix = `${IND}ECHO `;
                return { line: `${prefix}${escaped}`, textStart: prefix.length, textEnd: prefix.length + escaped.length };
            }
        }
    }
}
