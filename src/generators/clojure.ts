import { LanguageGenerator, LanguageId, TextEmit } from './base';

const METHODS = ['process-text', 'read-passage', 'consume'] as const;
const VARS    = ['content', 'buffer', 'segment', 'data'] as const;
const IND     = '  '; // Clojure idiomatic 2-space indent

export class ClojureGenerator extends LanguageGenerator {
    readonly languageId: LanguageId = 'clojure';
    protected readonly methodNames = METHODS;
    protected readonly varNames    = VARS;

    protected fileHeader(title: string, author: string): string[] {
        return [`; ${title}`, `; By ${author}`, ``, `(ns book.core)`];
    }

    protected classOpen(_className: string): string[] {
        return [];
    }

    protected chapterOpen(index: number): string[] {
        return [`(defn chapter-${index} []`];
    }

    protected chapterClose(): string[] {
        return [`)`];
    }

    protected chapterEmpty(): string[] {
        return [`${IND}; empty`, `)`];
    }

    protected entryPoint(_className: string): string[] {
        return [
            `(defn -main []`,
            `${IND}(chapter-1)`,
            `)`
        ];
    }

    protected renderTextLine(text: string, escaped: string, mode: number, variant: number): TextEmit {
        switch (mode) {
            case 0: {
                const prefix = `${IND}; `;
                return { line: `${prefix}${text}`, textStart: prefix.length, textEnd: prefix.length + text.length };
            }
            case 1: {
                const method = this.methodNames[variant % this.methodNames.length];
                const prefix = `${IND}(${method} "`;
                return { line: `${prefix}${escaped}")`, textStart: prefix.length, textEnd: prefix.length + escaped.length };
            }
            case 2: {
                const prefix = `${IND}`;
                return {
                    before: [`(comment`],
                    line: `${prefix}${text}`,
                    textStart: prefix.length,
                    textEnd: prefix.length + text.length,
                    after: [`)`]
                };
            }
            case 3: {
                const varName = this.varNames[variant % this.varNames.length];
                const prefix = `${IND}(def ${varName} "`;
                return { line: `${prefix}${escaped}")`, textStart: prefix.length, textEnd: prefix.length + escaped.length };
            }
            default: { // 4
                const prefix = `${IND}(println "`;
                return { line: `${prefix}${escaped}")`, textStart: prefix.length, textEnd: prefix.length + escaped.length };
            }
        }
    }
}
