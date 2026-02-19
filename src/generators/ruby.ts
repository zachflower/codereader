import { LanguageGenerator, LanguageId, TextEmit, INDENT } from './base';

const METHODS = ['process_text', 'read_passage', 'consume'] as const;
const VARS    = ['content', 'buffer', 'segment', 'data'] as const;

export class RubyGenerator extends LanguageGenerator {
    readonly languageId: LanguageId = 'ruby';
    protected readonly methodNames = METHODS;
    protected readonly varNames    = VARS;

    protected fileHeader(title: string, author: string): string[] {
        return [`# ${title}`, `# By ${author}`, '', `# frozen_string_literal: true`];
    }

    protected classOpen(className: string): string[] {
        return [
            `class ${className}`,
            `  def initialize`,
            `    @current_chapter = 0`,
            `  end`,
            ''
        ];
    }

    protected chapterOpen(index: number): string[] {
        return [`  def chapter_${index}`];
    }

    protected chapterClose(): string[] {
        return [`        true`, `  end`];
    }

    protected chapterEmpty(): string[] {
        return [`        # empty`, `  end`];
    }

    protected entryPoint(className: string): string[] {
        return [
            `end`,
            '',
            `book = ${className}.new`,
            `book.read`
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
                const prefix = `${INDENT}${method}("`;
                return { line: `${prefix}${escaped}")`, textStart: prefix.length, textEnd: prefix.length + escaped.length };
            }
            case 2: {
                const prefix = `${INDENT}`;
                return {
                    before: [`=begin`],
                    line: `${prefix}${text}`,
                    textStart: prefix.length,
                    textEnd: prefix.length + text.length,
                    after: [`=end`]
                };
            }
            case 3: {
                const varName = this.varNames[variant % this.varNames.length];
                const prefix = `${INDENT}${varName} = "`;
                return { line: `${prefix}${escaped}"`, textStart: prefix.length, textEnd: prefix.length + escaped.length };
            }
            default: { // 4
                const prefix = `${INDENT}puts "`;
                return { line: `${prefix}${escaped}"`, textStart: prefix.length, textEnd: prefix.length + escaped.length };
            }
        }
    }
}
