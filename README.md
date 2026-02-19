# CodeReader

**Shhh... you're working.**

CodeReader is a VS Code extension that lets you read EPUB ebooks disguised as Python code. Perfect for "reading documentation" or "code reviews" when you're actually catching up on your favorite novel.

## Features

- **Stealth Mode**: Converts EPUB content into syntax-highlighted Python code (Classes, functions, docstrings, comments).
- **Progress Tracking**: Remembers your scroll position for each book automatically.
- **Highlights**: Select text and run `CodeReader: Highlight Selection` to save favorite passages.
- **Read-Only**: The virtual document is read-only, preventing accidental "edits" to your book.

## Usage

1. Open VS Code.
2. Run command `CodeReader: Open EPUB` (Ctrl+Shift+P).
3. Select an `.epub` file from your computer.
4. Enjoy your "code review".

## Commands

- `codereader.openEpub`: Open file picker to select an ebook.
- `codereader.highlightSelection`: Highlight the currently selected text.

## Requirements

- VS Code 1.96.0 or higher.

## Extension Settings

None yet. It just works.

## Known Issues

- Complex EPUB filtering is basic; might show some weird characters if the EPUB is heavily formatted.
- Images are not supported (that would break the disguise!).

## Release Notes

### 0.0.1

- Initial release.
- Basic EPUB support.
- Python-like code generation.
- Progress saving.
- Simple highlighting.
