import * as vscode from 'vscode';

import { CodeReaderContentProvider } from './contentProvider';
import { Storage, Highlight } from './storage';

class EpubEditorProvider implements vscode.CustomReadonlyEditorProvider {
    constructor(
        private readonly storage: Storage,
        private readonly highlightDecorationType: vscode.TextEditorDecorationType
    ) {}

    openCustomDocument(uri: vscode.Uri): vscode.CustomDocument {
        return { uri, dispose: () => {} };
    }

    async resolveCustomEditor(document: vscode.CustomDocument, webviewPanel: vscode.WebviewPanel): Promise<void> {
        webviewPanel.dispose();
        const codereaderUri = document.uri.with({ scheme: 'codereader' });
        try {
            const doc = await vscode.workspace.openTextDocument(codereaderUri);
            await vscode.languages.setTextDocumentLanguage(doc, 'python');
            const editor = await vscode.window.showTextDocument(doc, { preview: false });

            const hash = Storage.hash(document.uri.fsPath);
            const progress = this.storage.getProgress(hash);
            if (progress) {
                const range = new vscode.Range(progress.line, 0, progress.line, 0);
                editor.revealRange(range, vscode.TextEditorRevealType.AtTop);
            }
            const highlights = this.storage.getHighlights(hash);
            editor.setDecorations(this.highlightDecorationType, highlights.map(h => h.range));
        } catch (e) {
            vscode.window.showErrorMessage(`Failed to open EPUB: ${e}`);
        }
    }
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "codereader" is now active!');

    const storage = new Storage(context);
    const provider = new CodeReaderContentProvider();
    const providerRegistration = vscode.workspace.registerTextDocumentContentProvider('codereader', provider);

    // Highlight decoration type
    const highlightDecorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(255, 255, 0, 0.3)',
        isWholeLine: false
    });

    let openEpubDisposable = vscode.commands.registerCommand('codereader.openEpub', async () => {
        const fileUri = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: {
                'EPUB Files': ['epub']
            }
        });

        if (fileUri && fileUri[0]) {
            const epubUri = fileUri[0];
            const uri = epubUri.with({ scheme: 'codereader' });

            try {
                const doc = await vscode.workspace.openTextDocument(uri);
                await vscode.languages.setTextDocumentLanguage(doc, 'python');
                const editor = await vscode.window.showTextDocument(doc, { preview: false });

                // Restore progress
                const hash = Storage.hash(epubUri.fsPath);
                const progress = storage.getProgress(hash);
                if (progress) {
                    const range = new vscode.Range(progress.line, 0, progress.line, 0);
                    editor.revealRange(range, vscode.TextEditorRevealType.AtTop);
                }

                // Restore highlights
                const highlights = storage.getHighlights(hash);
                editor.setDecorations(highlightDecorationType, highlights.map(h => h.range));

            } catch (e) {
                vscode.window.showErrorMessage(`Failed to open EPUB: ${e}`);
            }
        }
    });

    let highlightDisposable = vscode.commands.registerCommand('codereader.highlightSelection', () => {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.uri.scheme === 'codereader') {
            const selection = editor.selection;
            if (!selection.isEmpty) {
                const uri = editor.document.uri;
                // The path component of our URI is the fsPath of the epub
                const epubFsPath = uri.path;
                // Note: URI.path might act differently on windows vs linux? 
                // It's safer to use the original fsPath passed to openTextDocument if we can reconstruct it.
                // In our case: `codereader:/home/user/book.epub` -> path is `/home/user/book.epub`.
                const hash = Storage.hash(epubFsPath);

                const highlight: Highlight = { range: selection };
                storage.saveHighlight(hash, highlight);

                // Re-apply all highlights (appending to existing list for visual update - optimal way is to merge but sequential add logic in storage is simplest)
                // NOTE: storage.saveHighlight pushes to array. So we should re-fetch all.
                const highlights = storage.getHighlights(hash);
                editor.setDecorations(highlightDecorationType, highlights.map(h => h.range));
            }
        }
    });

    // Track visible ranges for progress
    // We update progress when the user stops scrolling for a bit, or closes the editor.
    let textEditorDisposable = vscode.window.onDidChangeTextEditorVisibleRanges(e => {
        if (e.textEditor.document.uri.scheme === 'codereader') {
            if (e.visibleRanges.length > 0) {
                const epubFsPath = e.textEditor.document.uri.path;
                const hash = Storage.hash(epubFsPath);
                const firstVisibleLine = e.visibleRanges[0].start.line;
                storage.saveProgress(hash, firstVisibleLine);
            }
        }
    });

    const epubEditorProvider = new EpubEditorProvider(storage, highlightDecorationType);
    const editorProviderRegistration = vscode.window.registerCustomEditorProvider(
        'codereader.epubEditor',
        epubEditorProvider
    );

    context.subscriptions.push(openEpubDisposable, highlightDisposable, textEditorDisposable, editorProviderRegistration, providerRegistration);
}

export function deactivate() { }
