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
import { BashGenerator } from './bash';
import { BatchGenerator } from './batch';
import { PowerShellGenerator } from './powershell';
import { ClojureGenerator } from './clojure';

export const LANGUAGE_OPTIONS: { id: LanguageId; label: string }[] = [
    { id: 'shellscript', label: 'Bash' },
    { id: 'bat',         label: 'Batch' },
    { id: 'c',           label: 'C' },
    { id: 'csharp',      label: 'C#' },
    { id: 'cpp',         label: 'C++' },
    { id: 'clojure',     label: 'Clojure' },
    { id: 'go',          label: 'Go' },
    { id: 'java',        label: 'Java' },
    { id: 'javascript',  label: 'JavaScript' },
    { id: 'objectivec',  label: 'Objective-C' },
    { id: 'php',         label: 'PHP' },
    { id: 'powershell',  label: 'PowerShell' },
    { id: 'python',      label: 'Python' },
    { id: 'ruby',        label: 'Ruby' },
    { id: 'rust',        label: 'Rust' },
    { id: 'swift',       label: 'Swift' },
    { id: 'typescript',  label: 'TypeScript' },
    { id: 'vb',          label: 'Visual Basic' },
];

export function createGenerator(lang: LanguageId): { generate(book: Book): GenerationResult } {
    switch (lang) {
        case 'shellscript': return new BashGenerator();
        case 'bat':         return new BatchGenerator();
        case 'c':           return new CGenerator();
        case 'csharp':      return new CSharpGenerator();
        case 'cpp':         return new CppGenerator();
        case 'clojure':     return new ClojureGenerator();
        case 'go':          return new GoGenerator();
        case 'java':        return new JavaGenerator();
        case 'javascript':  return new JavaScriptGenerator();
        case 'objectivec':  return new ObjectiveCGenerator();
        case 'php':         return new PhpGenerator();
        case 'powershell':  return new PowerShellGenerator();
        case 'python':      return new PythonGenerator();
        case 'ruby':        return new RubyGenerator();
        case 'rust':        return new RustGenerator();
        case 'swift':       return new SwiftGenerator();
        case 'typescript':  return new TypeScriptGenerator();
        case 'vb':          return new VBGenerator();
        default:            return new PythonGenerator();
    }
}
