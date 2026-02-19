import { Book, BookChapter } from './epubParser';

export class PythonGenerator {
    generate(book: Book): string {
        let code = `"""\n${book.title}\nBy ${book.author}\n"""\n\n`;
        code += `import sys\nimport os\n\n`;
        code += `class ${this.toClassName(book.title)}:\n`;
        code += `    def __init__(self):\n`;
        code += `        self.current_chapter = 0\n\n`;

        book.chapters.forEach((chapter, index) => {
            code += this.generateChapter(chapter, index + 1);
        });

        code += `if __name__ == "__main__":\n`;
        code += `    book = ${this.toClassName(book.title)}()\n`;
        code += `    book.read()`;

        return code;
    }

    private generateChapter(chapter: BookChapter, index: number): string {
        let chapterCode = `    def chapter_${index}(self):\n`;

        // Strategy: Mix of comments, docstrings, and variable assignments
        if (!chapter.content) {
            return chapterCode + `        pass\n\n`;
        }

        const lines = chapter.content.split('\n').filter(line => line.trim().length > 0);

        // Chunk lines into "blocks" of code
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].replace(/"/g, '\\"'); // Escape quotes

            // Randomly decide format
            const mode = i % 3;
            if (mode === 0) {
                chapterCode += `        # ${line}\n`;
            } else if (mode === 1) {
                chapterCode += `        self._process_text("${line}")\n`;
            } else {
                chapterCode += `        """\n        ${line}\n        """\n`;
            }
        }

        chapterCode += `        return True\n\n`;
        return chapterCode;
    }

    private toClassName(str: string): string {
        return str.replace(/[^a-zA-Z0-9]/g, '');
    }
}
