import * as vscode from 'vscode';

import { EpubParser } from './epubParser';
import { createGenerator, LanguageId } from './generators';

export class CodeReaderContentProvider implements vscode.TextDocumentContentProvider {
    private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
    private textLineRangesMap = new Map<string, Map<number, [number, number]>>();
    private languageOverrides = new Map<string, LanguageId>();

    constructor() { }

    dispose(): void {
        this._onDidChange.dispose();
    }

    provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
        return this.generateBookContent(uri);
    }

    get onDidChange(): vscode.Event<vscode.Uri> {
        return this._onDidChange.event;
    }

    private key(uri: vscode.Uri): string {
        return uri.toString();
    }

    public getTextLineRanges(uri: vscode.Uri): Map<number, [number, number]> {
        return this.textLineRangesMap.get(this.key(uri)) ?? new Map();
    }

    public getLanguage(uri: vscode.Uri): LanguageId | undefined {
        return this.languageOverrides.get(this.key(uri));
    }

    public setLanguage(uri: vscode.Uri, lang: LanguageId): void {
        this.languageOverrides.set(this.key(uri), lang);
    }

    public clearLanguage(uri: vscode.Uri): void {
        this.languageOverrides.delete(this.key(uri));
    }

    public invalidate(uri: vscode.Uri): void {
        this.textLineRangesMap.delete(this.key(uri));
        this._onDidChange.fire(uri);
    }

    private async generateBookContent(uri: vscode.Uri): Promise<string> {
        const epubPath = this.resolveEpubPath(uri);
        console.log(`Parsing EPUB at: ${epubPath}`);

        const lang = this.languageOverrides.get(this.key(uri))
            ?? vscode.workspace.getConfiguration('codereader').get<LanguageId>('language', 'python');

        try {
            const parser = new EpubParser(epubPath);
            const book = await parser.parse();
            const generator = createGenerator(lang);
            const result = generator.generate(book);
            this.textLineRangesMap.set(this.key(uri), result.textLineRanges);
            return result.code;
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            console.error('Error parsing EPUB:', errorMessage);
            return errorComment(lang, errorMessage);
        }
    }

    private resolveEpubPath(uri: vscode.Uri): string {
        const params = new URLSearchParams(uri.query);
        const source = params.get('source');
        if (source) {
            try {
                const sourceUri = vscode.Uri.parse(decodeURIComponent(source));
                if (sourceUri.scheme === 'file') {
                    return sourceUri.fsPath;
                }
                return sourceUri.path;
            } catch {
                // Fall back below if parsing fails
            }
        }

        if (uri.scheme === 'file') {
            return uri.fsPath;
        }

        return uri.path;
    }
}

function errorComment(lang: LanguageId, message: string): string {
    switch (lang) {
        case 'javascript': return `/*\nError loading EPUB:\n${message}\n*/`;
        case 'php':        return `<?php\n/*\nError loading EPUB:\n${message}\n*/`;
        default:           return `"""\nError loading EPUB:\n${message}\n"""`;
    }
}
