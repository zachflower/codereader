export type { LanguageId, GenerationResult } from './base';

import { LanguageId, GenerationResult } from './base';
import { Book } from '../epubParser';
import { PythonGenerator } from './python';
import { JavaScriptGenerator } from './javascript';
import { PhpGenerator } from './php';

export const LANGUAGE_OPTIONS: { id: LanguageId; label: string }[] = [
    { id: 'python',     label: 'Python' },
    { id: 'javascript', label: 'JavaScript' },
    { id: 'php',        label: 'PHP' },
];

export function createGenerator(lang: LanguageId): { generate(book: Book): GenerationResult } {
    switch (lang) {
        case 'javascript': return new JavaScriptGenerator();
        case 'php':        return new PhpGenerator();
        default:           return new PythonGenerator();
    }
}
