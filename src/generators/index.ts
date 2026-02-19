export type { LanguageId, GenerationResult } from './base';

import { LanguageId, GenerationResult } from './base';
import { Book } from '../epubParser';
import { PythonGenerator } from './python';
import { JavaScriptGenerator } from './javascript';
import { PhpGenerator } from './php';
import { GoGenerator } from './go';
import { CGenerator } from './c';
import { CppGenerator } from './cpp';
import { RustGenerator } from './rust';
import { RubyGenerator } from './ruby';

export const LANGUAGE_OPTIONS: { id: LanguageId; label: string }[] = [
    { id: 'python',     label: 'Python' },
    { id: 'javascript', label: 'JavaScript' },
    { id: 'php',        label: 'PHP' },
    { id: 'go',         label: 'Go' },
    { id: 'c',          label: 'C' },
    { id: 'cpp',        label: 'C++' },
    { id: 'rust',       label: 'Rust' },
    { id: 'ruby',       label: 'Ruby' },
];

export function createGenerator(lang: LanguageId): { generate(book: Book): GenerationResult } {
    switch (lang) {
        case 'javascript': return new JavaScriptGenerator();
        case 'php':        return new PhpGenerator();
        case 'go':         return new GoGenerator();
        case 'c':          return new CGenerator();
        case 'cpp':        return new CppGenerator();
        case 'rust':       return new RustGenerator();
        case 'ruby':       return new RubyGenerator();
        default:           return new PythonGenerator();
    }
}
