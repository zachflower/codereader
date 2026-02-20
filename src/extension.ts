import * as vscode from 'vscode';

import { CodeReaderContentProvider } from './contentProvider';
import { Storage } from './storage';
import { LANGUAGE_OPTIONS, LanguageId } from './generators';

function applyHighlights(
    editor: vscode.TextEditor,
    storage: Storage,
    highlightDecorationType: vscode.TextEditorDecorationType,
    provider: CodeReaderContentProvider
) {
    const hash = Storage.hash(editor.document.uri.path);
    const savedHighlights = storage.getHighlights(hash);
    const textLineRanges = provider.getTextLineRanges(editor.document.uri);

    const decorationRanges: vscode.Range[] = [];
    for (const h of savedHighlights) {
        const saved = h.range;
        for (let line = saved.start.line; line <= saved.end.line; line++) {
            const textRange = textLineRanges.get(line);
            if (!textRange || line >= editor.document.lineCount) { continue; }
            const [textStart, textEnd] = textRange;

            let startChar: number;
            let endChar: number;
            if (saved.start.line === saved.end.line) {
                startChar = Math.max(saved.start.character, textStart);
                endChar = Math.min(saved.end.character, textEnd);
            } else if (line === saved.start.line) {
                startChar = Math.max(saved.start.character, textStart);
                endChar = textEnd;
            } else if (line === saved.end.line) {
                startChar = textStart;
                endChar = Math.min(saved.end.character, textEnd);
            } else {
                startChar = textStart;
                endChar = textEnd;
            }

            if (startChar < endChar) {
                decorationRanges.push(new vscode.Range(line, startChar, line, endChar));
            }
        }
    }
    editor.setDecorations(highlightDecorationType, decorationRanges);
}

async function openEpub(
    epubFileUri: vscode.Uri,
    storage: Storage,
    highlightDecorationType: vscode.TextEditorDecorationType,
    provider: CodeReaderContentProvider,
    wordWrapAppliedDocs: Set<string>
): Promise<vscode.TextEditor | undefined> {
    const codereaderUri = epubFileUri.with({ scheme: 'codereader' });
    const doc = await vscode.workspace.openTextDocument(codereaderUri);
    const lang = vscode.workspace.getConfiguration('codereader').get<LanguageId>('language', 'python');
    await vscode.languages.setTextDocumentLanguage(doc, lang);
    const editor = await vscode.window.showTextDocument(doc, { preview: false });

    // Apply word wrap settings once per document lifetime
    const key = codereaderUri.toString();
    if (!wordWrapAppliedDocs.has(key)) {
        wordWrapAppliedDocs.add(key);
        const crConfig = vscode.workspace.getConfiguration('codereader');
        const autoWordWrap = crConfig.get<boolean>('wordWrap', true);

        if (autoWordWrap) {
            // editor.action.toggleWordWrap is a per-editor override that doesn't modify
            // any settings file and has no effect on other open editors.
            const currentWrap = vscode.workspace
                .getConfiguration('editor', doc.uri)
                .get<string>('wordWrap', 'off');
            if (currentWrap === 'off') {
                await vscode.commands.executeCommand('editor.action.toggleWordWrap');
            }
        }
    }

    const hash = Storage.hash(epubFileUri.fsPath);
    const progress = storage.getProgress(hash);
    if (progress) {
        const range = new vscode.Range(progress.line, 0, progress.line, 0);
        editor.revealRange(range, vscode.TextEditorRevealType.AtTop);
    }
    applyHighlights(editor, storage, highlightDecorationType, provider);
    return editor;
}

class EpubEditorProvider implements vscode.CustomReadonlyEditorProvider {
    constructor(
        private readonly storage: Storage,
        private readonly highlightDecorationType: vscode.TextEditorDecorationType,
        private readonly provider: CodeReaderContentProvider,
        private readonly wordWrapAppliedDocs: Set<string>
    ) {}

    openCustomDocument(uri: vscode.Uri): vscode.CustomDocument {
        return { uri, dispose: () => {} };
    }

    async resolveCustomEditor(document: vscode.CustomDocument, webviewPanel: vscode.WebviewPanel): Promise<void> {
        webviewPanel.webview.html = `<!DOCTYPE html><html><body style="background:#1e1e1e;color:#ccc;font-family:sans-serif;padding:2em">Opening in CodeReader...</body></html>`;
        try {
            await openEpub(document.uri, this.storage, this.highlightDecorationType, this.provider, this.wordWrapAppliedDocs);
        } catch (e) {
            vscode.window.showErrorMessage(`Failed to open EPUB: ${e}`);
        }
        setTimeout(() => webviewPanel.dispose(), 50);
    }
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "codereader" is now active!');

    const storage = new Storage(context);
    const provider = new CodeReaderContentProvider();
    const providerRegistration = vscode.workspace.registerTextDocumentContentProvider('codereader', provider);

    const wordWrapAppliedDocs = new Set<string>();
    context.subscriptions.push(
        vscode.workspace.onDidCloseTextDocument(doc => {
            if (doc.uri.scheme === 'codereader') {
                wordWrapAppliedDocs.delete(doc.uri.toString());
                provider.clearLanguage(doc.uri);
            }
        })
    );

    const highlightDecorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(255, 255, 0, 0.3)',
        isWholeLine: false
    });

    // ── Open EPUB command ──────────────────────────────────────────────────────
    const openEpubDisposable = vscode.commands.registerCommand('codereader.openEpub', async () => {
        const fileUri = await vscode.window.showOpenDialog({
            canSelectFiles: true, canSelectFolders: false, canSelectMany: false,
            filters: { 'EPUB Files': ['epub'] }
        });
        if (fileUri && fileUri[0]) {
            try {
                await openEpub(fileUri[0], storage, highlightDecorationType, provider, wordWrapAppliedDocs);
            } catch (e) {
                vscode.window.showErrorMessage(`Failed to open EPUB: ${e}`);
            }
        }
    });

    // ── Highlight selection command (palette + context menu) ───────────────────
    const highlightDisposable = vscode.commands.registerCommand('codereader.highlightSelection', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.uri.scheme !== 'codereader') { return; }
        const selection = editor.selection;
        if (selection.isEmpty) { return; }

        const hash = Storage.hash(editor.document.uri.path);
        storage.saveHighlight(hash, { range: selection });
        applyHighlights(editor, storage, highlightDecorationType, provider);
    });

    // ── Remove highlight at cursor command ─────────────────────────────────────
    const removeHighlightDisposable = vscode.commands.registerCommand('codereader.removeHighlight', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.uri.scheme !== 'codereader') { return; }

        const pos = editor.selection.active;
        const hash = Storage.hash(editor.document.uri.path);
        storage.removeHighlightAt(hash, pos.line, pos.character);
        applyHighlights(editor, storage, highlightDecorationType, provider);
    });

    // ── Auto-highlight on selection ────────────────────────────────────────────
    let selectionDebounce: ReturnType<typeof setTimeout> | undefined;
    const selectionDisposable = vscode.window.onDidChangeTextEditorSelection(e => {
        if (e.textEditor.document.uri.scheme !== 'codereader') { return; }
        const selection = e.selections[0];
        if (selection.isEmpty) { return; }

        clearTimeout(selectionDebounce);
        selectionDebounce = setTimeout(() => {
            const hash = Storage.hash(e.textEditor.document.uri.path);
            storage.saveHighlight(hash, { range: selection });
            applyHighlights(e.textEditor, storage, highlightDecorationType, provider);
        }, 600);
    });

    // ── Hover tooltip on highlights ────────────────────────────────────────────
    const hoverDisposable = vscode.languages.registerHoverProvider(
        { scheme: 'codereader' },
        {
            provideHover(document, position) {
                const hash = Storage.hash(document.uri.path);
                const highlights = storage.getHighlights(hash);
                const hit = highlights.find(h => {
                    const r = h.range;
                    return new vscode.Range(
                        r.start.line, r.start.character,
                        r.end.line, r.end.character
                    ).contains(position);
                });
                if (!hit) { return; }

                const text = document.getText(new vscode.Range(
                    hit.range.start.line, hit.range.start.character,
                    hit.range.end.line, hit.range.end.character
                ));
                const removeArg = encodeURIComponent(JSON.stringify({
                    line: position.line, character: position.character,
                    fsPath: document.uri.path
                }));
                const removeCmd = `command:codereader.removeHighlightAt?${removeArg}`;
                const md = new vscode.MarkdownString(
                    `**Highlighted passage**\n\n> ${text.replace(/\n/g, '\n> ')}\n\n[Remove highlight](${removeCmd})`
                );
                md.isTrusted = true;
                return new vscode.Hover(md);
            }
        }
    );

    // ── Remove highlight at specific position (used by hover tooltip) ──────────
    const removeAtDisposable = vscode.commands.registerCommand('codereader.removeHighlightAt', (args: { line: number; character: number; fsPath: string }) => {
        const hash = Storage.hash(args.fsPath);
        storage.removeHighlightAt(hash, args.line, args.character);
        const editor = vscode.window.visibleTextEditors.find(
            e => e.document.uri.scheme === 'codereader' && e.document.uri.path === args.fsPath
        );
        if (editor) { applyHighlights(editor, storage, highlightDecorationType, provider); }
    });

    // ── Progress tracking ──────────────────────────────────────────────────────
    const textEditorDisposable = vscode.window.onDidChangeTextEditorVisibleRanges(e => {
        if (e.textEditor.document.uri.scheme !== 'codereader') { return; }
        if (e.visibleRanges.length > 0) {
            const hash = Storage.hash(e.textEditor.document.uri.path);
            storage.saveProgress(hash, e.visibleRanges[0].start.line);
        }
    });

    const epubEditorProvider = new EpubEditorProvider(storage, highlightDecorationType, provider, wordWrapAppliedDocs);
    const editorProviderRegistration = vscode.window.registerCustomEditorProvider(
        'codereader.epubEditor',
        epubEditorProvider
    );

    // ── Status bar language indicator ──────────────────────────────────────
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'codereader.switchLanguage';
    statusBarItem.tooltip = 'CodeReader: Switch rendering language';

    const updateStatusBar = () => {
        const editor = vscode.window.activeTextEditor;
        if (editor?.document.uri.scheme === 'codereader') {
            const lang = provider.getLanguage(editor.document.uri)
                ?? vscode.workspace.getConfiguration('codereader').get<LanguageId>('language', 'python');
            const option = LANGUAGE_OPTIONS.find(o => o.id === lang);
            statusBarItem.text = `$(file-code) ${option?.label ?? lang}`;
            statusBarItem.show();
        } else {
            statusBarItem.hide();
        }
    };

    context.subscriptions.push(
        statusBarItem,
        vscode.window.onDidChangeActiveTextEditor(updateStatusBar)
    );
    updateStatusBar();

    // ── Switch language command ─────────────────────────────────────────
    const switchLanguageDisposable = vscode.commands.registerCommand('codereader.switchLanguage', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.uri.scheme !== 'codereader') { return; }

        const uri = editor.document.uri;
        const current = provider.getLanguage(uri)
            ?? vscode.workspace.getConfiguration('codereader').get<LanguageId>('language', 'python');
        const items = LANGUAGE_OPTIONS.map(o => ({
            label: o.label,
            id: o.id,
            description: o.id === current ? '(active)' : undefined,
        }));

        const picked = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select rendering language',
        });
        if (!picked || picked.id === current) { return; }

        // Store the override for this editor only, then re-render it
        provider.setLanguage(uri, picked.id as LanguageId);
        provider.invalidate(uri);
        await vscode.languages.setTextDocumentLanguage(editor.document, picked.id);
        updateStatusBar();
    });

    // ── Re-render on language config change (from any source) ──────────────
    const configChangeDisposable = vscode.workspace.onDidChangeConfiguration(e => {
        if (!e.affectsConfiguration('codereader.language')) { return; }
        const newLang = vscode.workspace.getConfiguration('codereader').get<LanguageId>('language', 'python');

        updateStatusBar();

        for (const ed of vscode.window.visibleTextEditors) {
            if (ed.document.uri.scheme !== 'codereader') { continue; }
            // Skip editors that have a per-editor language override
            if (provider.getLanguage(ed.document.uri) !== undefined) { continue; }
            provider.invalidate(ed.document.uri);
            vscode.languages.setTextDocumentLanguage(ed.document, newLang);
        }
    });

    context.subscriptions.push(
        openEpubDisposable, highlightDisposable, removeHighlightDisposable,
        removeAtDisposable, selectionDisposable, hoverDisposable,
        textEditorDisposable, editorProviderRegistration, providerRegistration,
        switchLanguageDisposable, configChangeDisposable
    );
}

export function deactivate() { }
