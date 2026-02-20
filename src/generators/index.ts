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
import { CSharpGenerator } from './csharp';
import { VBGenerator } from './vb';
import { TypeScriptGenerator } from './typescript';
import { ObjectiveCGenerator } from './objectivec';
import { JavaGenerator } from './java';
import { SwiftGenerator } from './swift';

export const LANGUAGE_OPTIONS: { id: LanguageId; label: string }[] = [
    { id: 'python',     label: 'Python' },
    { id: 'javascript', label: 'JavaScript' },
    { id: 'php',        label: 'PHP' },
    { id: 'go',         label: 'Go' },
    { id: 'c',          label: 'C' },
    { id: 'cpp',        label: 'C++' },
    { id: 'rust',       label: 'Rust' },
    { id: 'ruby',       label: 'Ruby' },
    { id: 'csharp',     label: 'C#' },
    { id: 'vb',         label: 'Visual Basic' },
    { id: 'typescript', label: 'TypeScript' },
    { id: 'objectivec', label: 'Objective-C' },
    { id: 'java',       label: 'Java' },
    { id: 'swift',      label: 'Swift' },
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
        case 'csharp':     return new CSharpGenerator();
        case 'vb':         return new VBGenerator();
        case 'typescript': return new TypeScriptGenerator();
        case 'objectivec': return new ObjectiveCGenerator();
        case 'java':       return new JavaGenerator();
        case 'swift':      return new SwiftGenerator();
        default:           return new PythonGenerator();
    }
}
