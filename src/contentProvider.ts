import * as vscode from 'vscode';

import { EpubParser } from './epubParser';
import { PythonGenerator } from './codeGenerator';

export class CodeReaderContentProvider implements vscode.TextDocumentContentProvider {
    // Event emitter to signal when content changes
    private _onDidChange = new vscode.EventEmitter<vscode.Uri>();

    constructor() { }

    provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
        return this.generateBookContent(uri);
    }

    get onDidChange(): vscode.Event<vscode.Uri> {
        return this._onDidChange.event;
    }

    // Helper to trigger update if needed (not strictly needed for static content, but good practice)
    public update(uri: vscode.Uri) {
        this._onDidChange.fire(uri);
    }

    private async generateBookContent(uri: vscode.Uri): Promise<string> {
        // The URI path is the path to the EPUB file.
        // However, VS Code URIs are encoded. We need to decode the FS path.
        // Wait, the URI passed here is the 'codereader://...' one.
        // We probably encoded the real file path in the query or path.

        // Let's assume the path part of the URI is the absolute path to the epub.
        const epubPath = uri.path;

        // Use console.log for debugging
        console.log(`Parsing EPUB at: ${epubPath}`);

        try {
            const parser = new EpubParser(epubPath);
            const book = await parser.parse();

            const generator = new PythonGenerator();
            return generator.generate(book);

        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            console.error('Error parsing EPUB:', errorMessage);
            return `"""\nError loading EPUB:\n${errorMessage}\n"""`;
        }
    }
}
