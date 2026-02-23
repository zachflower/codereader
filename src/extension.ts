import * as vscode from 'vscode';

import { CodeReaderContentProvider } from './contentProvider';
import { Storage } from './storage';
import { LANGUAGE_OPTIONS, LanguageId } from './generators';

// Returns array indexed by bookLineIndex → [renderedLine, textStart, textEnd].
// bookLineIndex is each entry's rank in the sorted textLineRanges map, making
// it stable across renderer changes (same Nth piece of book text regardless of language).
function buildBookToRenderedLineMap(textLineRanges: Map<number, [number, number]>): Array<[number, number, number]> {
    const sorted = [...textLineRanges.keys()].sort((a, b) => a - b);
    return sorted.map(renderedLine => {
        const [textStart, textEnd] = textLineRanges.get(renderedLine)!;
        return [renderedLine, textStart, textEnd] as [number, number, number];
    });
}

// Returns Map<renderedLine → bookLineIndex>.
function buildRenderedToBookLineMap(textLineRanges: Map<number, [number, number]>): Map<number, number> {
    const sorted = [...textLineRanges.keys()].sort((a, b) => a - b);
    const map = new Map<number, number>();
    sorted.forEach((renderedLine, idx) => map.set(renderedLine, idx));
    return map;
}

function escapeMarkdown(text: string): string {
    return text.replace(/[[\]()\\`*_~#|>!]/g, '\\$&');
}

function applyHighlights(
    editor: vscode.TextEditor,
    storage: Storage,
    highlightDecorationType: vscode.TextEditorDecorationType,
    provider: CodeReaderContentProvider
) {
    const hash = Storage.hash(editor.document.uri.path);
    const savedHighlights = storage.getHighlights(hash);
    const textLineRanges = provider.getTextLineRanges(editor.document.uri);
    const bookToRendered = buildBookToRenderedLineMap(textLineRanges);

    const decorationRanges: vscode.Range[] = [];
    for (const h of savedHighlights) {
        if (typeof h.startBookLine !== 'number') { continue; } // skip legacy format
        for (let bookLine = h.startBookLine; bookLine <= h.endBookLine; bookLine++) {
            const info = bookToRendered[bookLine];
            if (!info) { continue; }
            const [renderedLine, textStart, textEnd] = info;
            if (renderedLine >= editor.document.lineCount) { continue; }

            let startChar: number;
            let endChar: number;
            if (h.startBookLine === h.endBookLine) {
                startChar = textStart + h.startCharOffset;
                endChar = textStart + h.endCharOffset;
            } else if (bookLine === h.startBookLine) {
                startChar = textStart + h.startCharOffset;
                endChar = textEnd;
            } else if (bookLine === h.endBookLine) {
                startChar = textStart;
                endChar = textStart + h.endCharOffset;
            } else {
                startChar = textStart;
                endChar = textEnd;
            }

            startChar = Math.min(Math.max(startChar, textStart), textEnd);
            endChar = Math.min(Math.max(endChar, textStart), textEnd);

            if (startChar < endChar) {
                decorationRanges.push(new vscode.Range(renderedLine, startChar, renderedLine, endChar));
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
    const codereaderUri = epubFileUri.with({
        scheme: 'codereader',
        query: `source=${encodeURIComponent(epubFileUri.toString())}`
    });
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
            // Toggle word wrap on if not already enabled.
            // editor.action.toggleWordWrap applies a per-editor override without
            // modifying settings files or affecting other editors.
            const currentWrap = vscode.workspace
                .getConfiguration('editor', doc.uri)
                .get<string>('wordWrap');
            if (!currentWrap || currentWrap === 'off') {
                await vscode.commands.executeCommand('editor.action.toggleWordWrap');
            }
        }
    }

    const hash = Storage.hash(epubFileUri.path);
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

let selectionDebounce: ReturnType<typeof setTimeout> | undefined;
let progressDebounce: ReturnType<typeof setTimeout> | undefined;

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "codereader" is now active!');

    const storage = new Storage(context);
    const provider = new CodeReaderContentProvider();
    const providerRegistration = vscode.workspace.registerTextDocumentContentProvider('codereader', provider);

    const wordWrapAppliedDocs = new Set<string>();
    context.subscriptions.push(
        vscode.workspace.onDidCloseTextDocument(doc => {
            if (doc.uri.scheme === 'codereader') {
                setTimeout(() => {
                    const stillVisible = vscode.window.visibleTextEditors.some(
                        e => e.document.uri.toString() === doc.uri.toString()
                    );
                    if (!stillVisible) {
                        wordWrapAppliedDocs.delete(doc.uri.toString());
                        provider.clearLanguage(doc.uri);
                    }
                }, 0);
            }
        })
    );

    const highlightDecorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(255, 255, 0, 0.3)',
        isWholeLine: false
    });
    const saveHighlightFromSelection = (editor: vscode.TextEditor, selection: vscode.Selection) => {
        const textLineRanges = provider.getTextLineRanges(editor.document.uri);
        const renderedToBook = buildRenderedToBookLineMap(textLineRanges);
        const startBookLine = renderedToBook.get(selection.start.line);
        const endBookLine = renderedToBook.get(selection.end.line);
        if (startBookLine === undefined || endBookLine === undefined) { return; }
        const [startTextStart] = textLineRanges.get(selection.start.line)!;
        const [endTextStart] = textLineRanges.get(selection.end.line)!;

        const hash = Storage.hash(editor.document.uri.path);
        storage.saveHighlight(hash, {
            startBookLine,
            startCharOffset: selection.start.character - startTextStart,
            endBookLine,
            endCharOffset: selection.end.character - endTextStart,
        });
        applyHighlights(editor, storage, highlightDecorationType, provider);
    };

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

    // ── Remove highlight at cursor command ─────────────────────────────────────
    const removeHighlightDisposable = vscode.commands.registerCommand('codereader.removeHighlight', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.uri.scheme !== 'codereader') { return; }

        const pos = editor.selection.active;
        const textLineRanges = provider.getTextLineRanges(editor.document.uri);
        const renderedToBook = buildRenderedToBookLineMap(textLineRanges);
        const bookLine = renderedToBook.get(pos.line);
        if (bookLine === undefined) { return; }
        const [textStart] = textLineRanges.get(pos.line)!;

        const hash = Storage.hash(editor.document.uri.path);
        storage.removeHighlightAt(hash, bookLine, pos.character - textStart);
        applyHighlights(editor, storage, highlightDecorationType, provider);
    });

    // ── Auto-highlight on selection ────────────────────────────────────────────
    const selectionDisposable = vscode.window.onDidChangeTextEditorSelection(e => {
        if (e.textEditor.document.uri.scheme !== 'codereader') { return; }
        const selection = e.selections[0];
        if (selection.isEmpty) { return; }

        clearTimeout(selectionDebounce);
        selectionDebounce = setTimeout(() => {
            saveHighlightFromSelection(e.textEditor, selection);
        }, 600);
    });

    // ── Hover tooltip on highlights ────────────────────────────────────────────
    const hoverDisposable = vscode.languages.registerHoverProvider(
        { scheme: 'codereader' },
        {
            provideHover(document, position) {
                const hash = Storage.hash(document.uri.path);
                const highlights = storage.getHighlights(hash);
                const textLineRanges = provider.getTextLineRanges(document.uri);
                const renderedToBook = buildRenderedToBookLineMap(textLineRanges);
                const bookToRendered = buildBookToRenderedLineMap(textLineRanges);

                const hoverBookLine = renderedToBook.get(position.line);
                if (hoverBookLine === undefined) { return; }
                const [hoverTextStart] = textLineRanges.get(position.line)!;
                const hoverCharOffset = position.character - hoverTextStart;

                const hit = highlights.find(h => {
                    if (typeof h.startBookLine !== 'number') { return false; }
                    if (hoverBookLine < h.startBookLine || hoverBookLine > h.endBookLine) { return false; }
                    if (h.startBookLine === h.endBookLine) {
                        return hoverCharOffset >= h.startCharOffset && hoverCharOffset <= h.endCharOffset;
                    }
                    if (hoverBookLine === h.startBookLine) { return hoverCharOffset >= h.startCharOffset; }
                    if (hoverBookLine === h.endBookLine) { return hoverCharOffset <= h.endCharOffset; }
                    return true;
                });
                if (!hit) { return; }

                let text = '';
                const startInfo = bookToRendered[hit.startBookLine];
                const endInfo = bookToRendered[hit.endBookLine];
                if (startInfo && endInfo) {
                    const [startRenderedLine, startTextStart] = startInfo;
                    const [endRenderedLine, endTextStart] = endInfo;
                    text = document.getText(new vscode.Range(
                        startRenderedLine, startTextStart + hit.startCharOffset,
                        endRenderedLine, endTextStart + hit.endCharOffset
                    ));
                }

                const removeArg = encodeURIComponent(JSON.stringify({
                    bookLine: hoverBookLine, charOffset: hoverCharOffset,
                    fsPath: document.uri.path
                }));
                const removeCmd = `command:codereader.removeHighlightAt?${removeArg}`;
                const escapedText = escapeMarkdown(text);
                const md = new vscode.MarkdownString(
                    `**Highlighted passage**\n\n> ${escapedText.replace(/\n/g, '\n> ')}\n\n[Remove highlight](${removeCmd})`
                );
                md.isTrusted = { enabledCommands: ['codereader.removeHighlightAt'] };
                return new vscode.Hover(md);
            }
        }
    );

    // ── Remove highlight at specific position (used by hover tooltip) ──────────
    const removeAtDisposable = vscode.commands.registerCommand('codereader.removeHighlightAt', (args: { bookLine: number; charOffset: number; fsPath: string }) => {
        const hash = Storage.hash(args.fsPath);
        storage.removeHighlightAt(hash, args.bookLine, args.charOffset);
        const editor = vscode.window.visibleTextEditors.find(
            e => e.document.uri.scheme === 'codereader' && e.document.uri.path === args.fsPath
        );
        if (editor) { applyHighlights(editor, storage, highlightDecorationType, provider); }
    });

    // ── Progress tracking ──────────────────────────────────────────────────────
    const textEditorDisposable = vscode.window.onDidChangeTextEditorVisibleRanges(e => {
        if (e.textEditor.document.uri.scheme !== 'codereader') { return; }
        if (e.visibleRanges.length > 0) {
            clearTimeout(progressDebounce);
            progressDebounce = setTimeout(() => {
                const hash = Storage.hash(e.textEditor.document.uri.path);
                storage.saveProgress(hash, e.visibleRanges[0].start.line);
            }, 500);
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
            vscode.commands.executeCommand('setContext', 'codereader.isActive', true);
            const lang = provider.getLanguage(editor.document.uri)
                ?? vscode.workspace.getConfiguration('codereader').get<LanguageId>('language', 'python');
            const option = LANGUAGE_OPTIONS.find(o => o.id === lang);
            statusBarItem.text = `$(file-code) ${option?.label ?? lang}`;
            statusBarItem.show();
        } else {
            vscode.commands.executeCommand('setContext', 'codereader.isActive', false);
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
        openEpubDisposable, removeHighlightDisposable,
        removeAtDisposable, selectionDisposable, hoverDisposable,
        textEditorDisposable, editorProviderRegistration, providerRegistration,
        switchLanguageDisposable, configChangeDisposable,
        highlightDecorationType, provider
    );
}

export function deactivate() {
    clearTimeout(selectionDebounce);
    clearTimeout(progressDebounce);
}
