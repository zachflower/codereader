import * as vscode from 'vscode';

import { EpubParser } from './epubParser';
import { PythonGenerator } from './codeGenerator';

export class CodeReaderContentProvider implements vscode.TextDocumentContentProvider {
    private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
    private textLineNumbersMap = new Map<string, Set<number>>();

    constructor() { }

    provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
        return this.generateBookContent(uri);
    }

    get onDidChange(): vscode.Event<vscode.Uri> {
        return this._onDidChange.event;
    }

    public getTextLineNumbers(uri: vscode.Uri): Set<number> {
        return this.textLineNumbersMap.get(uri.toString()) ?? new Set();
    }

    private async generateBookContent(uri: vscode.Uri): Promise<string> {
        const epubPath = uri.path;
        console.log(`Parsing EPUB at: ${epubPath}`);

        try {
            const parser = new EpubParser(epubPath);
            const book = await parser.parse();
            const generator = new PythonGenerator();
            const result = generator.generate(book);
            this.textLineNumbersMap.set(uri.toString(), result.textLineNumbers);
            return result.code;
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            console.error('Error parsing EPUB:', errorMessage);
            return `"""\nError loading EPUB:\n${errorMessage}\n"""`;
        }
    }
}
